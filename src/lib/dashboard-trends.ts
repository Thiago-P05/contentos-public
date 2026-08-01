import { getDashboardRangeBounds } from "@/lib/dashboard-range";
import { createDashboardMetricRecord, DASHBOARD_METRIC_KEYS } from "@/lib/dashboard-metrics";
import { averageMetricsOf, METRIC_AGGREGATION, sumMetricsOf } from "@/lib/metric-aggregation";
import type {
  DashboardPerformanceAvailabilityStatus,
  DashboardRange,
  DashboardTrendMetricKey,
  Platform,
} from "@/lib/types";

const TIMEZONE = "America/Buenos_Aires";
const INSTAGRAM_CONSOLIDATION_DELAY_MS = 48 * 60 * 60 * 1000;
const TREND_METRIC_KEYS: DashboardTrendMetricKey[] = [
  "views",
  "comments",
  "likes",
  "shares",
  "saves",
  "reach",
  "contentInteractions",
  "profileVisits",
  "linkClicks",
  "avgWatchTimeMs",
  "skipRate",
];
const SUM_METRICS = sumMetricsOf(TREND_METRIC_KEYS);
const AVERAGE_METRICS = averageMetricsOf(TREND_METRIC_KEYS);
const METRIC_KEYS: DashboardTrendMetricKey[] = [...SUM_METRICS, ...AVERAGE_METRICS];

type BucketType = "hour" | "day" | "week" | "month";

type TrendInput = {
  contentItemId: string;
  capturedAt: string;
  sourcePlatform?: Platform;
  metrics: Partial<Record<DashboardTrendMetricKey, number | null>>;
};
type BucketMetrics = Record<DashboardTrendMetricKey, number>;
type ObservationFlags = Record<DashboardTrendMetricKey, boolean>;

type BucketAccumulator = {
  totals: BucketMetrics;
  counts: BucketMetrics;
  observed: ObservationFlags;
};

type BucketPoint = {
  bucketStart: string;
  bucketEnd: string;
  label: string;
  publishedAt: string;
  isPending: boolean;
  hasObservedData: boolean;
  observedMetrics: DashboardTrendMetricKey[];
  metrics: BucketMetrics;
};

type PerformanceTotals = {
  totalViews: number | null;
  totalReach: number | null;
  totalComments: number | null;
  avgEngagementRate: number | null;
  avgWatchTimeMs: number | null;
};

type PerformanceAvailability = {
  status: DashboardPerformanceAvailabilityStatus;
  message: string;
};
function formatter(options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, ...options });
}

function dateParts(value: Date) {
  const parts = formatter({ year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  return {
    year: Number(parts.find((part) => part.type === "year")?.value ?? "0"),
    month: Number(parts.find((part) => part.type === "month")?.value ?? "0"),
    day: Number(parts.find((part) => part.type === "day")?.value ?? "0"),
  };
}
function dateTimeParts(value: Date) {
  const parts = formatter({ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false }).formatToParts(value);
  return {
    year: Number(parts.find((part) => part.type === "year")?.value ?? "0"),
    month: Number(parts.find((part) => part.type === "month")?.value ?? "0"),
    day: Number(parts.find((part) => part.type === "day")?.value ?? "0"),
    hour: Number(parts.find((part) => part.type === "hour")?.value ?? "0"),
  };
}

function utcDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

function utcDateTime(year: number, month: number, day: number, hour: number) {
  return new Date(Date.UTC(year, month - 1, day, hour));
}

function shiftDays(value: Date, amount: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
}

function shiftMonths(value: Date, amount: number) {
  const next = new Date(value);
  next.setUTCMonth(next.getUTCMonth() + amount);
  return next;
}
function bucketTypeFor(range: DashboardRange): BucketType {
  if (range === "day") return "hour";
  if (range === "week") return "day";
  if (range === "month") return "day";
  if (range === "quarter") return "week";
  return "month";
}


function bucketStart(value: Date, bucketType: BucketType) {
  if (bucketType === "hour") {
    const parts = dateTimeParts(value);
    return utcDateTime(parts.year, parts.month, parts.day, parts.hour);
  }

  const parts = dateParts(value);
  const day = utcDate(parts.year, parts.month, parts.day);

  if (bucketType === "day") return day;
  if (bucketType === "week") return shiftDays(day, -((day.getUTCDay() + 6) % 7));
  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1));
}

function resolveBucketLimits(
  range: DashboardRange,
  bucketType: BucketType,
  bounds: ReturnType<typeof getDashboardRangeBounds>,
  firstSnapshotAt: Date,
  lastSnapshotAt: Date,
) {
  if (range === "all") {
    return {
      first: bucketStart(firstSnapshotAt, bucketType),
      last: bucketStart(lastSnapshotAt, bucketType),
    };
  }

  const first = new Date(bounds.start!);
  const last = new Date(bounds.end!);

  if (bucketType === "hour") {
    last.setUTCHours(last.getUTCHours() + 23);
    return { first, last };
  }

  if (bucketType === "week") {
    first.setUTCDate(first.getUTCDate() - ((first.getUTCDay() + 6) % 7));
    last.setUTCDate(last.getUTCDate() - ((last.getUTCDay() + 6) % 7));
    return { first, last };
  }

  if (bucketType === "month") {
    first.setUTCDate(1);
    last.setUTCDate(1);
    return { first, last };
  }

  return { first, last };
}

function bucketLabel(value: Date, bucketType: BucketType) {
  if (bucketType === "hour") return String(value.getUTCHours()).padStart(2, "0") + ":00";
  if (bucketType === "month") {
    const names = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    return names[value.getUTCMonth()] + " " + String(value.getUTCFullYear()).slice(-2);
  }
  return String(value.getUTCDate()).padStart(2, "0") + "/" + String(value.getUTCMonth() + 1).padStart(2, "0");
}
function emptyMetrics(): BucketMetrics {
  return createDashboardMetricRecord(0);
}

function emptyObserved(): ObservationFlags {
  return DASHBOARD_METRIC_KEYS.reduce((record, key) => {
    record[key] = false;
    return record;
  }, {} as ObservationFlags);
}

function createAccumulator(): BucketAccumulator {
  return { totals: emptyMetrics(), counts: emptyMetrics(), observed: emptyObserved() };
}



function emptyResult(message = "Sin datos observados para este periodo.") {
  return {
    totals: {
      totalViews: null,
      totalReach: null,
      totalComments: null,
      avgEngagementRate: null,
      avgWatchTimeMs: null,
    },
    availability: {
      status: "empty" as const,
      message,
    },
    series: [] as BucketPoint[],
  };
}

function summarizeAvailability(series: BucketPoint[]): PerformanceAvailability {
  if (series.length === 0) {
    return {
      status: "empty",
      message: "Sin datos observados para este periodo.",
    };
  }

  const observedBuckets = series.filter((point) => point.hasObservedData).length;
  const pendingBuckets = series.filter((point) => point.isPending).length;

  if (observedBuckets === 0 && pendingBuckets > 0) {
    return {
      status: "partial",
      message: "Instagram puede demorar hasta 48 h en consolidar metricas. Los dias recientes quedan pendientes.",
    };
  }

  if (observedBuckets === 0) {
    return {
      status: "empty",
      message: "Sin datos observados para este periodo.",
    };
  }

  if (pendingBuckets > 0) {
    return {
      status: "partial",
      message: "Instagram puede demorar hasta 48 h en consolidar metricas. Los dias recientes quedan pendientes.",
    };
  }

  if (observedBuckets === series.length) {
    return {
      status: "ok",
      message: "Datos observados en todo el periodo seleccionado.",
    };
  }

  return {
    status: "partial",
    message: "Faltan observaciones en parte del periodo seleccionado.",
  };
}

function summarizeTotals(accumulators: BucketAccumulator[]): PerformanceTotals {
  const sumTotals = emptyMetrics();
  const averageTotals = emptyMetrics();
  const averageCounts = emptyMetrics();
  const observed = emptyObserved();

  for (const accumulator of accumulators) {
    for (const metricKey of SUM_METRICS) {
      if (!accumulator.observed[metricKey]) {
        continue;
      }

      observed[metricKey] = true;
      sumTotals[metricKey] += accumulator.totals[metricKey];
    }

    for (const metricKey of AVERAGE_METRICS) {
      if (!accumulator.observed[metricKey]) {
        continue;
      }

      observed[metricKey] = true;
      averageTotals[metricKey] += accumulator.totals[metricKey];
      averageCounts[metricKey] += accumulator.counts[metricKey];
    }
  }

  const interactionsObserved = observed.likes || observed.comments || observed.shares || observed.saves;
  const interactions = sumTotals.likes + sumTotals.comments + sumTotals.shares + sumTotals.saves;
  const avgEngagementRate =
    observed.views && sumTotals.views > 0 && interactionsObserved
      ? (interactions / sumTotals.views) * 100
      : null;

  return {
    totalViews: observed.views ? sumTotals.views : null,
    totalReach: observed.reach ? sumTotals.reach : null,
    totalComments: observed.comments ? sumTotals.comments : null,
    avgEngagementRate,
    avgWatchTimeMs:
      observed.avgWatchTimeMs && averageCounts.avgWatchTimeMs > 0
        ? averageTotals.avgWatchTimeMs / averageCounts.avgWatchTimeMs
        : null,
  };
}
function nextBucket(value: Date, bucketType: BucketType) {
  if (bucketType === "hour") return new Date(value.getTime() + 60 * 60 * 1000);
  if (bucketType === "day") return shiftDays(value, 1);
  if (bucketType === "week") return shiftDays(value, 7);
  return shiftMonths(value, 1);
}

function finalize(accumulator?: BucketAccumulator): BucketMetrics {
  if (!accumulator) return emptyMetrics();
  const metrics = emptyMetrics();
  for (const key of METRIC_KEYS) {
    const total = accumulator.totals[key];
    const count = accumulator.counts[key];
    metrics[key] = METRIC_AGGREGATION[key] === "average" && count > 0 ? total / count : total;
  }
  return metrics;
}

export function buildDashboardMetricSeries(
  snapshots: TrendInput[],
  range: DashboardRange,
  anchor?: string | null,
  now = new Date(),
) {
  if (snapshots.length === 0) {
    return [];
  }

  const orderedSnapshots = [...snapshots].sort(
    (left, right) => new Date(left.capturedAt).getTime() - new Date(right.capturedAt).getTime(),
  );
  const firstSnapshotAt = new Date(orderedSnapshots[0]!.capturedAt);
  const lastSnapshotAt = new Date(orderedSnapshots[orderedSnapshots.length - 1]!.capturedAt);
  const bucketType = bucketTypeFor(range);
  const bounds = getDashboardRangeBounds(range, anchor, now);
  const { first, last } = resolveBucketLimits(
    range,
    bucketType,
    bounds,
    firstSnapshotAt,
    lastSnapshotAt,
  );

  const baselineSnapshots = new Map<
    string,
    Partial<Record<DashboardTrendMetricKey, number | null>>
  >();
  const bucketSnapshots = new Map<
    string,
    Map<string, Partial<Record<DashboardTrendMetricKey, number | null>>>
  >();

  for (const snapshot of orderedSnapshots) {
    const bucketDate = bucketStart(new Date(snapshot.capturedAt), bucketType);

    if (bucketDate.getTime() < first.getTime()) {
      baselineSnapshots.set(snapshot.contentItemId, snapshot.metrics);
      continue;
    }

    if (bucketDate.getTime() > last.getTime()) {
      continue;
    }

    const key = bucketDate.toISOString();
    const contentSnapshots =
      bucketSnapshots.get(key) ??
      new Map<string, Partial<Record<DashboardTrendMetricKey, number | null>>>();

    contentSnapshots.set(snapshot.contentItemId, snapshot.metrics);
    bucketSnapshots.set(key, contentSnapshots);
  }

  const aggregateAbsoluteMetrics = (
    contentMap: Map<string, Partial<Record<DashboardTrendMetricKey, number | null>>>,
  ) => {
    const bucket: BucketAccumulator = {
      totals: emptyMetrics(),
      counts: emptyMetrics(),
      observed: emptyObserved(),
    };

    for (const metrics of contentMap.values()) {
      for (const metricKey of METRIC_KEYS) {
        const value = metrics[metricKey];
        if (typeof value !== "number" || Number.isNaN(value)) {
          continue;
        }
        bucket.totals[metricKey] += value;
        bucket.counts[metricKey] += 1;
      }
    }

    return finalize(bucket);
  };

  const lastKnownByContent = new Map(baselineSnapshots);

  const series = [];
  let current = new Date(first);
  while (current.getTime() <= last.getTime()) {
    const key = current.toISOString();
    const updates = bucketSnapshots.get(key);
    const metrics = emptyMetrics();

    for (const [contentItemId, nextMetrics] of updates?.entries() ?? []) {
      const previousMetrics = lastKnownByContent.get(contentItemId);

      for (const metricKey of METRIC_KEYS) {
        if (METRIC_AGGREGATION[metricKey] === "average") {
          continue;
        }

        const previousValue = previousMetrics ? previousMetrics[metricKey] : 0;
        const nextValue = nextMetrics[metricKey];
        
        if (typeof nextValue !== "number") {
          continue;
        }

        const baseline = typeof previousValue === "number" ? previousValue : 0;
        metrics[metricKey] += Math.max(nextValue - baseline, 0);
      }

      lastKnownByContent.set(contentItemId, nextMetrics);
    }

    const currentAbsolute = aggregateAbsoluteMetrics(lastKnownByContent);
    for (const metricKey of METRIC_KEYS) {
      if (METRIC_AGGREGATION[metricKey] === "average") {
        metrics[metricKey] = currentAbsolute[metricKey];
      }
    }

    series.push({
      label: bucketLabel(current, bucketType),
      publishedAt: key,
      metrics,
    });

    current = nextBucket(current, bucketType);
  }

  return series;
}

export function buildDashboardPerformance(
  snapshots: TrendInput[],
  range: DashboardRange,
  anchor?: string | null,
  now = new Date(),
) {
  if (snapshots.length === 0) {
    return emptyResult();
  }

  const orderedSnapshots = [...snapshots].sort(
    (left, right) => new Date(left.capturedAt).getTime() - new Date(right.capturedAt).getTime(),
  );
  const firstSnapshotAt = new Date(orderedSnapshots[0]!.capturedAt);
  const lastSnapshotAt = new Date(orderedSnapshots[orderedSnapshots.length - 1]!.capturedAt);
  const bucketType = bucketTypeFor(range);
  const bounds = getDashboardRangeBounds(range, anchor, now);
  const { first, last } = resolveBucketLimits(
    range,
    bucketType,
    bounds,
    firstSnapshotAt,
    lastSnapshotAt,
  );

  if (first.getTime() > last.getTime()) {
    return emptyResult();
  }

  const buckets: Array<{
    start: Date;
    endExclusive: Date;
    end: Date;
    label: string;
  }> = [];

  let current = new Date(first);
  while (current.getTime() <= last.getTime()) {
    const next = nextBucket(current, bucketType);
    buckets.push({
      start: new Date(current),
      endExclusive: next,
      end: new Date(next.getTime() - 1),
      label: bucketLabel(current, bucketType),
    });
    current = next;
  }

  const snapshotsByContent = new Map<string, Array<TrendInput & { capturedAtMs: number }>>();
  for (const snapshot of orderedSnapshots) {
    const contentSnapshots = snapshotsByContent.get(snapshot.contentItemId) ?? [];
    contentSnapshots.push({
      ...snapshot,
      capturedAtMs: new Date(snapshot.capturedAt).getTime(),
    });
    snapshotsByContent.set(snapshot.contentItemId, contentSnapshots);
  }

  const bucketAccumulators = buckets.map(() => createAccumulator());
  const bucketPending = buckets.map(() => false);
  const consolidationCutoffMs = now.getTime() - INSTAGRAM_CONSOLIDATION_DELAY_MS;

  for (const contentSnapshots of snapshotsByContent.values()) {
    const contentPlatform = contentSnapshots[0]?.sourcePlatform ?? null;
    const isInstagramContent = contentPlatform === "instagram";
    let cursor = 0;
    let previousSnapshot: (TrendInput & { capturedAtMs: number }) | null = null;

    for (let bucketIndex = 0; bucketIndex < buckets.length; bucketIndex += 1) {
      const bucket = buckets[bucketIndex]!;
      const bucketStartMs = bucket.start.getTime();
      const bucketEndMs = bucket.endExclusive.getTime();
      const bucketIsPendingForContent =
        isInstagramContent && bucketEndMs > consolidationCutoffMs;
      const previousScanLimitMs = isInstagramContent
        ? Math.min(bucketStartMs, consolidationCutoffMs)
        : bucketStartMs;
      const bucketEffectiveEndMs = isInstagramContent
        ? Math.min(bucketEndMs, consolidationCutoffMs)
        : bucketEndMs;

      if (bucketIsPendingForContent) {
        bucketPending[bucketIndex] = true;
      }

      while (
        cursor < contentSnapshots.length &&
        contentSnapshots[cursor]!.capturedAtMs < previousScanLimitMs
      ) {
        previousSnapshot = contentSnapshots[cursor]!;
        cursor += 1;
      }

      if (bucketEffectiveEndMs <= bucketStartMs) {
        continue;
      }

      let bucketLast: (TrendInput & { capturedAtMs: number }) | null = null;
      let bucketFirst: (TrendInput & { capturedAtMs: number }) | null = null;
      let bucketCursor = cursor;
      while (
        bucketCursor < contentSnapshots.length &&
        contentSnapshots[bucketCursor]!.capturedAtMs < bucketEffectiveEndMs
      ) {
        const candidate = contentSnapshots[bucketCursor]!;

        if (!bucketFirst) {
          bucketFirst = candidate;
        }

        bucketLast = candidate;
        bucketCursor += 1;
      }

      cursor = bucketCursor;

      if (!bucketLast) {
        continue;
      }

      const accumulator = bucketAccumulators[bucketIndex]!;

      for (const metricKey of AVERAGE_METRICS) {
        const value = bucketLast.metrics[metricKey];
        if (typeof value !== "number" || Number.isNaN(value)) {
          continue;
        }

        accumulator.totals[metricKey] += value;
        accumulator.counts[metricKey] += 1;
        accumulator.observed[metricKey] = true;
      }

      const deltaBaseline =
        previousSnapshot ??
        (bucketFirst && bucketLast && bucketFirst !== bucketLast ? bucketFirst : null);

      for (const metricKey of SUM_METRICS) {
        const previousValue = deltaBaseline ? deltaBaseline.metrics[metricKey] : 0;
        const nextValue = bucketLast.metrics[metricKey];

        if (typeof nextValue !== "number") {
          continue;
        }

        const baseline = typeof previousValue === "number" ? previousValue : 0;
        accumulator.totals[metricKey] += Math.max(nextValue - baseline, 0);
        accumulator.observed[metricKey] = true;
      }

      previousSnapshot = bucketLast;
      cursor = bucketCursor;
    }
  }

  const series: BucketPoint[] = buckets.map((bucket, index) => {
    const accumulator = bucketAccumulators[index]!;
    const metrics = emptyMetrics();
    const observedMetrics = METRIC_KEYS.filter((metricKey) => accumulator.observed[metricKey]);

    for (const metricKey of SUM_METRICS) {
      metrics[metricKey] = accumulator.totals[metricKey];
    }

    for (const metricKey of AVERAGE_METRICS) {
      metrics[metricKey] =
        accumulator.counts[metricKey] > 0
          ? accumulator.totals[metricKey] / accumulator.counts[metricKey]
          : 0;
    }

    return {
      bucketStart: bucket.start.toISOString(),
      bucketEnd: bucket.end.toISOString(),
      label: bucket.label,
      publishedAt: bucket.start.toISOString(),
      isPending: bucketPending[index] ?? false,
      hasObservedData: observedMetrics.length > 0,
      observedMetrics,
      metrics,
    };
  });

  const availability = summarizeAvailability(series);
  if (availability.status === "empty") {
    return emptyResult(availability.message);
  }

  return {
    totals: summarizeTotals(bucketAccumulators),
    availability,
    series,
  };
}
