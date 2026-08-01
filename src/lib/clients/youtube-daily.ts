import { BACKFILL_START_ISO } from "@/lib/constants";
import type { PlatformConnectionCredentials, PlatformDailyInsightInput } from "@/lib/types";

const YOUTUBE_DAILY_LOOKBACK_DAYS = 90;
const YOUTUBE_DAILY_REFRESH_OVERLAP_DAYS = 7;

type YouTubeAnalyticsResponse = {
  columnHeaders?: Array<{ name?: string }>;
  rows?: Array<Array<string | number>>;
};

type FetchYouTubeDailyInsightsOptions = { since?: string | null };

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function addUtcDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function resolveStartDate(since?: string | null) {
  const today = startOfUtcDay(new Date());
  const lookbackStart = addUtcDays(today, -YOUTUBE_DAILY_LOOKBACK_DAYS);
  const backfillStart = startOfUtcDay(new Date(BACKFILL_START_ISO));
  const requestedStart = since ? startOfUtcDay(new Date(`${since}T00:00:00.000Z`)) : null;
  const overlapStart = requestedStart ? addUtcDays(requestedStart, -YOUTUBE_DAILY_REFRESH_OVERLAP_DAYS) : null;
  const candidates = [lookbackStart, backfillStart, overlapStart].filter(
    (value): value is Date => Boolean(value && !Number.isNaN(value.getTime())),
  );

  return candidates.reduce((latest, current) =>
    current.getTime() > latest.getTime() ? current : latest,
  );
}

function asNumber(value: string | number | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function fetchAnalytics(
  connection: PlatformConnectionCredentials,
  startDate: string,
  endDate: string,
) {
  const url = new URL("https://youtubeanalytics.googleapis.com/v2/reports");
  url.searchParams.set("ids", "channel==MINE");
  url.searchParams.set("startDate", startDate);
  url.searchParams.set("endDate", endDate);
  url.searchParams.set("dimensions", "day");
  url.searchParams.set("sort", "day");
  url.searchParams.set(
    "metrics",
    [
      "views",
      "engagedViews",
      "likes",
      "comments",
      "shares",
      "estimatedMinutesWatched",
      "averageViewDuration",
      "subscribersGained",
      "subscribersLost",
    ].join(","),
  );
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${connection.accessToken}` },
    cache: "no-store",
  });

  if (!response.ok) {
    const rawBody = await response.text();
    throw new Error(
      `YouTube Analytics API error: ${response.status} ${response.statusText}${rawBody ? ` - ${rawBody}` : ""}`,
    );
  }

  return response.json() as Promise<YouTubeAnalyticsResponse>;
}

export async function fetchYouTubeDailyInsights(
  connection: PlatformConnectionCredentials,
  options?: FetchYouTubeDailyInsightsOptions,
): Promise<PlatformDailyInsightInput[]> {
  const startDate = resolveStartDate(options?.since);
  const endDate = addUtcDays(startOfUtcDay(new Date()), -1);

  if (startDate > endDate) return [];

  const payload = await fetchAnalytics(connection, dateOnly(startDate), dateOnly(endDate));
  const names = (payload.columnHeaders ?? []).map((header) => header.name ?? "");

  return (payload.rows ?? []).flatMap((values) => {
    const row = Object.fromEntries(names.map((name, index) => [name, values[index]]));
    const insightDate = typeof row.day === "string" ? row.day : null;
    if (!insightDate) return [];

    const subscribersGained = asNumber(row.subscribersGained as string | number | undefined);

    return [
      {
        platform: "youtube",
        connectionId: connection.id,
        insightDate,
        period: "day",
        views: asNumber(row.views as string | number | undefined),
        impressions: null,
        reach: null,
        likes: asNumber(row.likes as string | number | undefined),
        comments: asNumber(row.comments as string | number | undefined),
        shares: asNumber(row.shares as string | number | undefined),
        saves: null,
        contentInteractions: null,
        profileVisits: null,
        linkClicks: null,
        follows: subscribersGained,
        followerCount: null,
        watchTimeMinutes: asNumber(row.estimatedMinutesWatched as string | number | undefined),
        averageViewDurationSeconds: asNumber(row.averageViewDuration as string | number | undefined),
        subscribersGained,
        subscribersLost: asNumber(row.subscribersLost as string | number | undefined),
        rawPayload: {
          source: "youtube-analytics-v2",
          columns: names,
          values,
          engagedViews: asNumber(row.engagedViews as string | number | undefined),
        },
      },
    ];
  });
}
