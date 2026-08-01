import { BACKFILL_START_ISO } from "@/lib/constants";
import type { MetricMap, NormalizedContentInput, PlatformConnectionCredentials } from "@/lib/types";

type YouTubeThumbnail = { url?: string };

type YouTubeVideo = {
  id?: string;
  snippet?: {
    title?: string;
    description?: string;
    publishedAt?: string;
    defaultLanguage?: string;
    thumbnails?: Record<string, YouTubeThumbnail | undefined>;
  };
  contentDetails?: { duration?: string };
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
  status?: { privacyStatus?: string };
};

type YouTubeChannelResponse = {
  items?: Array<{
    contentDetails?: { relatedPlaylists?: { uploads?: string } };
  }>;
};

type YouTubePlaylistItemsResponse = {
  nextPageToken?: string;
  items?: Array<{ contentDetails?: { videoId?: string } }>;
};

type YouTubePlaylistsResponse = {
  nextPageToken?: string;
  items?: Array<{ id?: string; snippet?: { title?: string } }>;
};

type YouTubeVideosResponse = { items?: YouTubeVideo[] };

const EXCLUDED_PLAYLIST_TITLES = new Set(["curso", "no listado"]);
const YOUTUBE_ANALYTICS_METRICS = [
  "averageViewDuration",
  "averageViewPercentage",
  "estimatedMinutesWatched",
  "subscribersGained",
] as const;

type YouTubeVideoAnalyticsMetrics = Pick<
  MetricMap,
  | "averageViewDurationSeconds"
  | "averageViewPercentage"
  | "watchTimeMinutes"
  | "subscribersGained"
>;

type YouTubeAnalyticsResponse = {
  columnHeaders?: Array<{ name?: string }>;
  rows?: Array<Array<string | number>>;
};

export type YouTubeVideosResult = {
  items: NormalizedContentInput[];
  excludedVideoIds: string[];
  analytics: {
    requestedVideoCount: number;
    reportedVideoCount: number;
    warning: string | null;
  };
};

async function fetchYouTubeJson<T>(url: URL, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!response.ok) {
    const rawBody = await response.text();
    throw new Error(
      `YouTube Data API error: ${response.status} ${response.statusText}${rawBody ? ` - ${rawBody}` : ""}`,
    );
  }

  return response.json() as Promise<T>;
}

function asNumber(value: string | undefined) {
  if (value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseIsoDuration(value: string | undefined) {
  if (!value) return null;
  const match = value.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/);

  if (!match) return null;

  const [, days, hours, minutes, seconds] = match;
  return (
    (Number(days ?? 0) * 86400) +
    (Number(hours ?? 0) * 3600) +
    (Number(minutes ?? 0) * 60) +
    Math.round(Number(seconds ?? 0))
  );
}

function getThumbnailUrl(thumbnails: NonNullable<YouTubeVideo["snippet"]>["thumbnails"]) {
  return (
    thumbnails?.maxres?.url ??
    thumbnails?.standard?.url ??
    thumbnails?.high?.url ??
    thumbnails?.medium?.url ??
    thumbnails?.default?.url ??
    null
  );
}

async function getUploadsPlaylistId(connection: PlatformConnectionCredentials) {
  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.searchParams.set("part", "contentDetails");
  url.searchParams.set("id", connection.accountExternalId);
  const payload = await fetchYouTubeJson<YouTubeChannelResponse>(url, connection.accessToken);
  const uploadsPlaylistId = payload.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;

  if (!uploadsPlaylistId) {
    throw new Error("YouTube no devolvio la playlist de uploads del canal.");
  }

  return uploadsPlaylistId;
}

function normalizePlaylistTitle(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function asAnalyticsNumber(value: string | number | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  return asNumber(value);
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

async function getPlaylistVideoIds(playlistId: string, accessToken: string) {
  const videoIds: string[] = [];
  let pageToken: string | null = null;

  do {
    const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
    url.searchParams.set("part", "contentDetails");
    url.searchParams.set("playlistId", playlistId);
    url.searchParams.set("maxResults", "50");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const payload = await fetchYouTubeJson<YouTubePlaylistItemsResponse>(url, accessToken);
    videoIds.push(
      ...(payload.items ?? [])
        .map((item) => item.contentDetails?.videoId)
        .filter((videoId): videoId is string => Boolean(videoId)),
    );
    pageToken = payload.nextPageToken ?? null;
  } while (pageToken);

  return videoIds;
}

async function getExcludedPlaylistVideoIds(accessToken: string) {
  const playlistIds: string[] = [];
  let pageToken: string | null = null;

  do {
    const url = new URL("https://www.googleapis.com/youtube/v3/playlists");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("mine", "true");
    url.searchParams.set("maxResults", "50");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const payload = await fetchYouTubeJson<YouTubePlaylistsResponse>(url, accessToken);
    playlistIds.push(
      ...(payload.items ?? [])
        .filter((playlist) => {
          const title = playlist.snippet?.title;
          return Boolean(title && EXCLUDED_PLAYLIST_TITLES.has(normalizePlaylistTitle(title)));
        })
        .map((playlist) => playlist.id)
        .filter((playlistId): playlistId is string => Boolean(playlistId)),
    );
    pageToken = payload.nextPageToken ?? null;
  } while (pageToken);

  const excludedVideoIds = new Set<string>();

  for (const playlistId of playlistIds) {
    for (const videoId of await getPlaylistVideoIds(playlistId, accessToken)) {
      excludedVideoIds.add(videoId);
    }
  }

  return excludedVideoIds;
}

async function fetchYouTubeVideoAnalytics(
  connection: PlatformConnectionCredentials,
  videoIds: string[],
) {
  const results = new Map<string, YouTubeVideoAnalyticsMetrics>();
  const startDate = dateOnly(new Date(BACKFILL_START_ISO));
  const endDate = dateOnly(new Date(Date.now() - 24 * 60 * 60 * 1000));

  if (startDate > endDate || videoIds.length === 0) {
    return results;
  }

  for (let index = 0; index < videoIds.length; index += 500) {
    const url = new URL("https://youtubeanalytics.googleapis.com/v2/reports");
    url.searchParams.set("ids", `channel==${connection.accountExternalId}`);
    url.searchParams.set("startDate", startDate);
    url.searchParams.set("endDate", endDate);
    url.searchParams.set("dimensions", "video");
    url.searchParams.set("filters", `video==${videoIds.slice(index, index + 500).join(",")}`);
    url.searchParams.set("metrics", YOUTUBE_ANALYTICS_METRICS.join(","));
    url.searchParams.set("maxResults", "500");

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

    const payload = (await response.json()) as YouTubeAnalyticsResponse;
    const names = (payload.columnHeaders ?? []).map((header) => header.name ?? "");

    for (const values of payload.rows ?? []) {
      const row = Object.fromEntries(names.map((name, valueIndex) => [name, values[valueIndex]]));
      const videoId = typeof row.video === "string" ? row.video : null;

      if (!videoId) continue;

      results.set(videoId, {
        averageViewDurationSeconds: asAnalyticsNumber(
          row.averageViewDuration as string | number | undefined,
        ),
        averageViewPercentage: asAnalyticsNumber(
          row.averageViewPercentage as string | number | undefined,
        ),
        watchTimeMinutes: asAnalyticsNumber(
          row.estimatedMinutesWatched as string | number | undefined,
        ),
        subscribersGained: asAnalyticsNumber(row.subscribersGained as string | number | undefined),
      });
    }
  }

  return results;
}

function normalizeYouTubeVideo(
  video: YouTubeVideo,
  connection: PlatformConnectionCredentials,
  analyticsMetrics?: YouTubeVideoAnalyticsMetrics,
): NormalizedContentInput | null {
  const videoId = video.id;
  const publishedAt = video.snippet?.publishedAt;

  if (!videoId || !publishedAt || Number.isNaN(new Date(publishedAt).getTime())) {
    return null;
  }

  if (new Date(publishedAt).getTime() < new Date(BACKFILL_START_ISO).getTime()) {
    return null;
  }

  const description = video.snippet?.description?.trim() || null;
  const metrics: MetricMap = {
    views: asNumber(video.statistics?.viewCount),
    likes: asNumber(video.statistics?.likeCount),
    comments: asNumber(video.statistics?.commentCount),
    ...analyticsMetrics,
  };

  return {
    platform: "youtube",
    connectionId: connection.id,
    externalId: videoId,
    publishedAt: new Date(publishedAt).toISOString(),
    title: video.snippet?.title ?? null,
    description,
    caption: description,
    durationSeconds: parseIsoDuration(video.contentDetails?.duration),
    permalink: `https://www.youtube.com/watch?v=${videoId}`,
    thumbnailUrl: getThumbnailUrl(video.snippet?.thumbnails),
    mediaUrl: null,
    metrics,
    rawPayload: video as Record<string, unknown>,
    textAssets: description
      ? [
          {
            sourceType: "official_caption",
            content: description,
            language: video.snippet?.defaultLanguage ?? null,
            rawPayload: { from: "youtube-description" },
          },
        ]
      : [],
  };
}

export async function fetchYouTubeVideos(
  connection: PlatformConnectionCredentials,
): Promise<YouTubeVideosResult> {
  const uploadsPlaylistId = await getUploadsPlaylistId(connection);
  const videoIds = await getPlaylistVideoIds(uploadsPlaylistId, connection.accessToken);
  const excludedVideoIds = await getExcludedPlaylistVideoIds(connection.accessToken);
  const videos: YouTubeVideo[] = [];

  for (let index = 0; index < videoIds.length; index += 50) {
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("part", "snippet,contentDetails,statistics,status");
    url.searchParams.set("id", videoIds.slice(index, index + 50).join(","));
    const payload = await fetchYouTubeJson<YouTubeVideosResponse>(url, connection.accessToken);

    videos.push(...(payload.items ?? []));
  }

  const includedVideos = videos.filter((video) => {
    if (!video.id || video.status?.privacyStatus === "unlisted" || excludedVideoIds.has(video.id)) {
      if (video.id) excludedVideoIds.add(video.id);
      return false;
    }

    return true;
  });
  let analyticsByVideoId = new Map<string, YouTubeVideoAnalyticsMetrics>();
  let analyticsWarning: string | null = null;

  try {
    analyticsByVideoId = await fetchYouTubeVideoAnalytics(
      connection,
      includedVideos.map((video) => video.id!).filter(Boolean),
    );
  } catch (error) {
    analyticsWarning = `YouTube Analytics no pudo cargar metricas por video: ${
      error instanceof Error ? error.message : "Unknown error"
    }`;
    console.warn(analyticsWarning);
  }

  if (!analyticsWarning && includedVideos.length > 0 && analyticsByVideoId.size === 0) {
    analyticsWarning = "YouTube Analytics no devolvio metricas por video para esta cuenta.";
  }

  const results = includedVideos
    .map((video) =>
      normalizeYouTubeVideo(
        video,
        connection,
        video.id ? analyticsByVideoId.get(video.id) : undefined,
      ),
    )
    .filter((item): item is NormalizedContentInput => Boolean(item));

  return {
    items: results,
    excludedVideoIds: [...excludedVideoIds],
    analytics: {
      requestedVideoCount: includedVideos.length,
      reportedVideoCount: analyticsByVideoId.size,
      warning: analyticsWarning,
    },
  };
}
