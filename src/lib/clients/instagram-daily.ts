import { BACKFILL_START_ISO, INSTAGRAM_ACCOUNT_DAILY_LOOKBACK_DAYS } from "@/lib/constants";
import { env } from "@/lib/env";
import type { PlatformConnectionCredentials, PlatformDailyInsightInput } from "@/lib/types";

const INSTAGRAM_DAILY_REQUEST_CONCURRENCY = 4;

type InsightMetric = {
  name: string;
  title?: string;
  description?: string;
  values?: Array<{
    value?: number | { value?: number; follows?: number } | null;
    end_time?: string;
  }>;
  total_value?: { value?: number | { value?: number; follows?: number } | null };
};

type InsightResponse = { data: InsightMetric[] };

type MetricPlan = {
  target:
    | "views"
    | "reach"
    | "contentInteractions"
    | "profileVisits"
    | "linkClicks"
    | "follows"
    | "followerCount";
  candidates: readonly string[];
  metricType?: "total_value";
};

export const INSTAGRAM_DAILY_METRIC_PLAN: readonly MetricPlan[] = [
  { target: "views", candidates: ["views", "content_views"], metricType: "total_value" },
  { target: "reach", candidates: ["reach"] },
  {
    target: "contentInteractions",
    candidates: ["total_interactions"],
    metricType: "total_value",
  },
  { target: "profileVisits", candidates: ["profile_views"], metricType: "total_value" },
  {
    target: "linkClicks",
    candidates: ["website_clicks", "profile_links_taps"],
    metricType: "total_value",
  },
  {
    // "Seguidores ganados": follower_count diario = nuevos seguidores por dia (>= 0).
    // NO usar la metrica de altas y bajas: es delta neto y puede ser negativo.
    target: "follows",
    candidates: ["follower_count"],
  },
  { target: "followerCount", candidates: ["follower_count"] },
];

type InsightWindow = { since: string; until: string };
type DailyInsightWindow = InsightWindow & { insightDate: string };
type FetchInstagramDailyInsightsOptions = { since?: string | Date | null };

type MetricFetchAttempt = {
  metric: string;
  status: "ok" | "error";
  error?: string;
};

type MetricFetchResult = {
  insightMetric: InsightMetric | null;
  selectedMetric: string | null;
  attempts: MetricFetchAttempt[];
};

type DailyTraceContext = {
  fetchedAt: string;
  requestedSince: string;
  requestedUntilExclusive: string;
};

async function fetchGraph<T>(url: URL | string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    const rawBody = await response.text();
    throw new Error(
      "Instagram API error: " +
        response.status +
        " " +
        response.statusText +
        (rawBody ? " - " + rawBody : ""),
    );
  }
  return (await response.json()) as T;
}

const formatDateOnly = (date: Date) => date.toISOString().slice(0, 10);

const startOfUtcDay = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const addUtcDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

function coerceInsightNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "follows" in value && typeof value.follows === "number") {
    return value.follows;
  }
  if (value && typeof value === "object" && "value" in value && typeof value.value === "number") {
    return value.value;
  }
  return null;
}

function normalizeInsightDate(endTime: string) {
  const parsed = new Date(endTime);
  if (Number.isNaN(parsed.getTime())) return endTime.slice(0, 10);
  parsed.setUTCDate(parsed.getUTCDate() - 1);
  return formatDateOnly(parsed);
}

function normalizeDateBoundary(value: string | Date | null | undefined) {
  if (!value) return null;
  const parsed =
    value instanceof Date ? new Date(value) : new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return startOfUtcDay(parsed);
}

function resolveInsightUntilDate() {
  return addUtcDays(startOfUtcDay(new Date()), 1);
}

function getInsightStartDate(since?: string | Date | null) {
  const untilDateExclusive = resolveInsightUntilDate();
  const lookbackStart = addUtcDays(
    untilDateExclusive,
    -INSTAGRAM_ACCOUNT_DAILY_LOOKBACK_DAYS,
  );
  const backfillStart = startOfUtcDay(new Date(BACKFILL_START_ISO));
  const requestedStart = normalizeDateBoundary(since);
  const candidates = [lookbackStart, backfillStart, requestedStart].filter(
    (value): value is Date => Boolean(value),
  );
  return candidates.reduce((latest, current) =>
    current.getTime() > latest.getTime() ? current : latest,
  );
}

function buildWindows(sinceDate: Date, untilDateExclusive: Date) {
  const windows: InsightWindow[] = [];
  let cursor = sinceDate;
  while (cursor < untilDateExclusive) {
    const next =
      addUtcDays(cursor, 29) < untilDateExclusive
        ? addUtcDays(cursor, 29)
        : untilDateExclusive;
    windows.push({ since: formatDateOnly(cursor), until: formatDateOnly(next) });
    cursor = addUtcDays(next, 1);
  }
  return windows;
}

function buildDailyWindows(sinceDate: Date, untilDateExclusive: Date) {
  const windows: DailyInsightWindow[] = [];
  let cursor = sinceDate;
  while (cursor < untilDateExclusive) {
    const next = addUtcDays(cursor, 1);
    windows.push({
      since: formatDateOnly(cursor),
      until: formatDateOnly(next),
      insightDate: formatDateOnly(cursor),
    });
    cursor = next;
  }
  return windows;
}

function getInsightHosts(connection: PlatformConnectionCredentials) {
  if (connection.id === "legacy-instagram-env") {
    return [env.INSTAGRAM_API_BASE_URL + "/" + env.INSTAGRAM_GRAPH_API_VERSION];
  }
  return [
    "https://graph.instagram.com/" + env.INSTAGRAM_GRAPH_API_VERSION,
    "https://graph.instagram.com",
    env.INSTAGRAM_API_BASE_URL + "/" + env.INSTAGRAM_GRAPH_API_VERSION,
  ];
}

function createEmptyDailyInsightRow(
  connectionId: string,
  insightDate: string,
  traceContext: DailyTraceContext,
): PlatformDailyInsightInput {
  return {
    platform: "instagram",
    connectionId,
    insightDate,
    period: "day",
    views: null,
    impressions: null,
    likes: null,
    comments: null,
    shares: null,
    saves: null,
    reach: null,
    contentInteractions: null,
    profileVisits: null,
    linkClicks: null,
    follows: null,
    watchTimeMinutes: null,
    averageViewDurationSeconds: null,
    subscribersGained: null,
    subscribersLost: null,
    followerCount: null,
    rawPayload: {
      __trace: {
        fetchedAt: traceContext.fetchedAt,
        requestedSince: traceContext.requestedSince,
        requestedUntilExclusive: traceContext.requestedUntilExclusive,
        metrics: {},
      },
    },
  };
}

function upsertMetricTrace(
  row: PlatformDailyInsightInput,
  target: MetricPlan["target"],
  traceEntry: {
    status: "ok" | "empty" | "error";
    since: string;
    until: string;
    selectedMetric: string | null;
    attempts: MetricFetchAttempt[];
    metricType: "total_value" | "values";
    observedValue: number | null;
    observedValueCount: number;
  },
  traceContext: DailyTraceContext,
) {
  const rawPayload = row.rawPayload ?? {};
  const existingTrace =
    (rawPayload.__trace as
      | {
          fetchedAt?: string;
          requestedSince?: string;
          requestedUntilExclusive?: string;
          metrics?: Record<string, unknown>;
        }
      | undefined) ?? {};
  const existingMetrics = existingTrace.metrics ?? {};

  row.rawPayload = {
    ...rawPayload,
    __trace: {
      fetchedAt: existingTrace.fetchedAt ?? traceContext.fetchedAt,
      requestedSince: existingTrace.requestedSince ?? traceContext.requestedSince,
      requestedUntilExclusive:
        existingTrace.requestedUntilExclusive ?? traceContext.requestedUntilExclusive,
      metrics: {
        ...existingMetrics,
        [target]: {
          ...traceEntry,
          recordedAt: new Date().toISOString(),
        },
      },
    },
  };
}

async function fetchDailyAccountMetric(
  connection: PlatformConnectionCredentials,
  plan: MetricPlan,
  since: string,
  until: string,
): Promise<MetricFetchResult> {
  const host = getInsightHosts(connection)[0]!;
  const attempts: MetricFetchAttempt[] = [];

  for (const metric of plan.candidates) {
    const url = new URL(host + "/" + connection.accountExternalId + "/insights");
    url.searchParams.set("metric", metric);
    url.searchParams.set("period", "day");
    url.searchParams.set("since", since);
    url.searchParams.set("until", until);
    url.searchParams.set("access_token", connection.accessToken);
    if (plan.metricType) {
      url.searchParams.set("metric_type", plan.metricType);
    }

    try {
      const response = await fetchGraph<InsightResponse>(url);
      attempts.push({ metric, status: "ok" });
      return {
        insightMetric: response.data[0] ?? null,
        selectedMetric: metric,
        attempts,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      attempts.push({ metric, status: "error", error: message });
      console.warn(
        `No se pudo obtener el insight diario ${metric} para Instagram cuenta ${connection.accountExternalId}: ${message}`,
      );
    }
  }

  return {
    insightMetric: null,
    selectedMetric: null,
    attempts,
  };
}

async function runWithConcurrency(
  tasks: Array<() => Promise<void>>,
  concurrency: number,
) {
  if (tasks.length === 0) return;
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, tasks.length) },
    async () => {
      while (cursor < tasks.length) {
        const currentIndex = cursor;
        cursor += 1;
        await tasks[currentIndex]!();
      }
    },
  );
  await Promise.all(workers);
}

export async function fetchInstagramDailyInsights(
  connection: PlatformConnectionCredentials,
  options?: FetchInstagramDailyInsightsOptions,
): Promise<PlatformDailyInsightInput[]> {
  if (connection.id === "legacy-instagram-env") {
    throw new Error("Los daily insights requieren una connection_id persistida.");
  }

  const sinceDate = getInsightStartDate(options?.since);
  const untilDateExclusive = resolveInsightUntilDate();
  const dailyWindows = buildDailyWindows(sinceDate, untilDateExclusive);
  const sharedWindows = buildWindows(sinceDate, untilDateExclusive);
  const traceContext: DailyTraceContext = {
    fetchedAt: new Date().toISOString(),
    requestedSince: formatDateOnly(sinceDate),
    requestedUntilExclusive: formatDateOnly(untilDateExclusive),
  };
  const rowsByDate = new Map<string, PlatformDailyInsightInput>();

  for (const window of dailyWindows) {
    rowsByDate.set(
      window.insightDate,
      createEmptyDailyInsightRow(connection.id, window.insightDate, traceContext),
    );
  }

  const ensureRow = (insightDate: string) => {
    const current = rowsByDate.get(insightDate);
    if (current) {
      return current;
    }

    const next = createEmptyDailyInsightRow(connection.id, insightDate, traceContext);
    rowsByDate.set(insightDate, next);
    return next;
  };

  const applyMetricValue = (
    current: PlatformDailyInsightInput,
    plan: MetricPlan,
    numericValue: number,
  ) => {
    if (plan.target === "views") {
      current.views = numericValue;
      current.impressions = numericValue;
    } else if (plan.target === "reach") {
      current.reach = numericValue;
    } else if (plan.target === "contentInteractions") {
      current.contentInteractions = numericValue;
    } else if (plan.target === "profileVisits") {
      current.profileVisits = numericValue;
    } else if (plan.target === "linkClicks") {
      current.linkClicks = numericValue;
    } else if (plan.target === "follows") {
      current.follows = numericValue;
    } else if (plan.target === "followerCount") {
      current.followerCount = numericValue;
    }
  };

  const tasks: Array<() => Promise<void>> = [];

  for (const plan of INSTAGRAM_DAILY_METRIC_PLAN) {
    const windows =
      plan.metricType === "total_value"
        ? dailyWindows
        : plan.target === "followerCount"
          ? sharedWindows.slice(-1)
          : sharedWindows;

    for (const window of windows) {
      tasks.push(async () => {
        const fetchResult = await fetchDailyAccountMetric(
          connection,
          plan,
          window.since,
          window.until,
        );

        if (plan.metricType === "total_value") {
          const insightDate = ("insightDate" in window ? window.insightDate : window.since) as string;
          const current = ensureRow(insightDate);
          const numericValue = fetchResult.insightMetric
            ? coerceInsightNumber(fetchResult.insightMetric.total_value?.value)
            : null;
          const traceStatus = !fetchResult.insightMetric
            ? "error"
            : numericValue === null
              ? "empty"
              : "ok";

          upsertMetricTrace(
            current,
            plan.target,
            {
              status: traceStatus,
              since: window.since,
              until: window.until,
              selectedMetric: fetchResult.selectedMetric,
              attempts: fetchResult.attempts,
              metricType: "total_value",
              observedValue: numericValue,
              observedValueCount: numericValue === null ? 0 : 1,
            },
            traceContext,
          );

          if (fetchResult.insightMetric && numericValue !== null) {
            applyMetricValue(current, plan, numericValue);
            current.rawPayload = {
              ...current.rawPayload,
              [fetchResult.insightMetric.name]: {
                since: window.since,
                until: window.until,
                value: fetchResult.insightMetric.total_value?.value ?? null,
                title: fetchResult.insightMetric.title ?? null,
                description: fetchResult.insightMetric.description ?? null,
              },
            };
          }

          rowsByDate.set(insightDate, current);
          return;
        }

        if (!fetchResult.insightMetric) {
          const current = ensureRow(window.since);
          upsertMetricTrace(
            current,
            plan.target,
            {
              status: "error",
              since: window.since,
              until: window.until,
              selectedMetric: fetchResult.selectedMetric,
              attempts: fetchResult.attempts,
              metricType: "values",
              observedValue: null,
              observedValueCount: 0,
            },
            traceContext,
          );
          rowsByDate.set(window.since, current);
          return;
        }

        let observedCount = 0;
        let lastObservedValue: number | null = null;

        for (const valueEntry of fetchResult.insightMetric.values ?? []) {
          if (!valueEntry.end_time) continue;
          const numericValue = coerceInsightNumber(valueEntry.value);
          if (numericValue === null) continue;

          const insightDate = normalizeInsightDate(valueEntry.end_time);
          const current = ensureRow(insightDate);

          applyMetricValue(current, plan, numericValue);
          current.rawPayload = {
            ...current.rawPayload,
            [fetchResult.insightMetric.name]: {
              end_time: valueEntry.end_time,
              value: valueEntry.value ?? null,
              title: fetchResult.insightMetric.title ?? null,
              description: fetchResult.insightMetric.description ?? null,
            },
          };
          upsertMetricTrace(
            current,
            plan.target,
            {
              status: "ok",
              since: window.since,
              until: window.until,
              selectedMetric: fetchResult.selectedMetric,
              attempts: fetchResult.attempts,
              metricType: "values",
              observedValue: numericValue,
              observedValueCount: 1,
            },
            traceContext,
          );
          rowsByDate.set(insightDate, current);
          observedCount += 1;
          lastObservedValue = numericValue;
        }

        if (observedCount === 0) {
          const fallbackDate = normalizeInsightDate(
            `${window.since}T23:59:59.000Z`,
          );
          const current = ensureRow(fallbackDate);
          upsertMetricTrace(
            current,
            plan.target,
            {
              status: "empty",
              since: window.since,
              until: window.until,
              selectedMetric: fetchResult.selectedMetric,
              attempts: fetchResult.attempts,
              metricType: "values",
              observedValue: lastObservedValue,
              observedValueCount: 0,
            },
            traceContext,
          );
          rowsByDate.set(fallbackDate, current);
        }
      });
    }
  }

  await runWithConcurrency(tasks, INSTAGRAM_DAILY_REQUEST_CONCURRENCY);

  return [...rowsByDate.values()].sort((left, right) =>
    left.insightDate.localeCompare(right.insightDate),
  );
}
