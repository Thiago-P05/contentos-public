import { getDashboardRangeBounds } from "@/lib/dashboard-range";
import { createDashboardMetricRecord, createNullableDashboardMetricRecord } from "@/lib/dashboard-metrics";
import { averageMetricsOf, sumMetricsOf } from "@/lib/metric-aggregation";
import type { DashboardRange, DashboardTrendMetricKey, Platform } from "@/lib/types";
type DailyMetricKey = DashboardTrendMetricKey;
type BucketType = "day" | "week" | "month";

const DAILY_METRIC_KEYS: DashboardTrendMetricKey[] = ["views", "comments", "likes", "shares", "saves", "reach", "contentInteractions", "profileVisits", "linkClicks", "follows", "watchTimeMinutes", "subscribersGained", "subscribersLost", "avgWatchTimeMs", "skipRate", "followerCount", "averageViewDurationSeconds"];
const SUM_METRICS = sumMetricsOf(DAILY_METRIC_KEYS);
const AVG_METRICS = averageMetricsOf(DAILY_METRIC_KEYS);
const METRIC_ORDER: DashboardTrendMetricKey[] = [...SUM_METRICS, ...AVG_METRICS];
const MONTH_NAMES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const INSTAGRAM_CONSOLIDATION_DELAY_MS = 48 * 60 * 60 * 1000;

export type DailyPerformanceInput = {
  insightDate: string;
  platform: Platform;
  connectionId: string;
  metrics: Partial<Record<DailyMetricKey, number | null>>;
};

type BucketPoint = {
  bucketStart: string;
  bucketEnd: string;
  label: string;
  publishedAt: string;
  isPending: boolean;
  hasObservedData: boolean;
  observedMetrics: DashboardTrendMetricKey[];
  metrics: Record<DashboardTrendMetricKey, number>;
};

type BucketAccumulator = {
  sums: Record<DashboardTrendMetricKey, number>;
  counts: Record<DashboardTrendMetricKey, number>;
  observedMetrics: Set<DashboardTrendMetricKey>;
};

function emptyMetricRecord() {
  return createDashboardMetricRecord(0);
}

function createAccumulator(): BucketAccumulator {
  return { sums: emptyMetricRecord(), counts: emptyMetricRecord(), observedMetrics: new Set<DashboardTrendMetricKey>() };
}

function parseInsightDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}
function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}
function addDays(value: Date, amount: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
}
function addMonths(value: Date, amount: number) {
  const next = new Date(value);
  next.setUTCMonth(next.getUTCMonth() + amount);
  return next;
}
function getBucketType(range: DashboardRange): BucketType {
  if (range === "quarter") return "week";
  if (range === "year" || range === "all") return "month";
  return "day";
}
function getBucketStart(value: Date, bucketType: BucketType) {
  const day = startOfUtcDay(value);
  if (bucketType === "day") return day;
  if (bucketType === "week") return addDays(day, -((day.getUTCDay() + 6) % 7));
  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1));
}
function getNextBucketStart(value: Date, bucketType: BucketType) {
  if (bucketType === "day") return addDays(value, 1);
  if (bucketType === "week") return addDays(value, 7);
  return addMonths(value, 1);
}
function formatBucketLabel(value: Date, bucketType: BucketType) {
  if (bucketType === "month") return MONTH_NAMES[value.getUTCMonth()] + " " + String(value.getUTCFullYear()).slice(-2);
  return String(value.getUTCDate()).padStart(2, "0") + "/" + String(value.getUTCMonth() + 1).padStart(2, "0");
}

function getWindowBounds(rows: DailyPerformanceInput[], range: DashboardRange, anchor?: string | null, now = new Date()) {
  const bucketType = getBucketType(range);
  if (rows.length === 0) return null;
  if (range === "all") {
    const orderedDates = rows.map((row) => parseInsightDate(row.insightDate)).sort((a, b) => a.getTime() - b.getTime());
    return { bucketType, start: getBucketStart(orderedDates[0], bucketType), end: getBucketStart(orderedDates[orderedDates.length - 1], bucketType), filterStart: null, filterEnd: null };
  }
  const bounds = getDashboardRangeBounds(range, anchor, now);
  if (!bounds.start || !bounds.end) return null;
  return { bucketType, start: getBucketStart(bounds.start, bucketType), end: getBucketStart(bounds.end, bucketType), filterStart: startOfUtcDay(bounds.start), filterEnd: startOfUtcDay(bounds.end) };
}

function getAvailability(series: BucketPoint[]) {
  if (series.length === 0) return { status: "empty" as const, message: "Sin datos observados para este periodo." };
  const observedCount = series.filter((point) => point.hasObservedData).length;
  const pendingCount = series.filter((point) => point.isPending).length;
  if (observedCount === 0 && pendingCount > 0) return { status: "partial" as const, message: "Instagram puede demorar hasta 48 h en consolidar metricas. Los dias recientes quedan pendientes." };
  if (observedCount === 0) return { status: "empty" as const, message: "Sin datos observados para este periodo." };
  if (pendingCount > 0) return { status: "partial" as const, message: "Instagram puede demorar hasta 48 h en consolidar metricas. Los dias recientes quedan pendientes." };
  if (observedCount === series.length) return { status: "ok" as const, message: "Datos observados en todo el periodo seleccionado." };
  return { status: "partial" as const, message: "Faltan observaciones en parte del periodo seleccionado." };
}

export function buildDashboardPerformanceFromDailyInsights(rows: DailyPerformanceInput[], range: DashboardRange, anchor?: string | null, now = new Date()) {
  const windowBounds = getWindowBounds(rows, range, anchor, now);
  if (!windowBounds) {
    return { totals: createNullableDashboardMetricRecord(null), availability: { status: "empty" as const, message: "Sin datos observados para este periodo." }, series: [] as BucketPoint[] };
  }
  const includesInstagram = rows.some((row) => row.platform === "instagram");
  const consolidationCutoffMs = now.getTime() - INSTAGRAM_CONSOLIDATION_DELAY_MS;
  const filteredRows = rows.filter((row) => {
    const rowDate = startOfUtcDay(parseInsightDate(row.insightDate));
    if (windowBounds.filterStart && rowDate.getTime() < windowBounds.filterStart.getTime()) return false;
    if (windowBounds.filterEnd && rowDate.getTime() > windowBounds.filterEnd.getTime()) return false;
    return true;
  });
  const buckets: Array<{ start: Date; end: Date; label: string }> = [];
  for (let current = new Date(windowBounds.start); current.getTime() <= windowBounds.end.getTime(); current = getNextBucketStart(current, windowBounds.bucketType)) {
    const next = getNextBucketStart(current, windowBounds.bucketType);
    buckets.push({ start: new Date(current), end: new Date(next.getTime() - 1), label: formatBucketLabel(current, windowBounds.bucketType) });
  }
  const bucketIndexByStart = new Map(buckets.map((bucket, index) => [bucket.start.toISOString(), index]));
  const accumulators = buckets.map(() => createAccumulator());
  for (const row of filteredRows) {
    const bucketKey = getBucketStart(parseInsightDate(row.insightDate), windowBounds.bucketType).toISOString();
    const bucketIndex = bucketIndexByStart.get(bucketKey);
    if (bucketIndex === undefined) continue;
    const accumulator = accumulators[bucketIndex];
    for (const metric of SUM_METRICS) {
      const value = row.metrics[metric];
      if (typeof value === "number" && Number.isFinite(value)) { accumulator.sums[metric] += value; accumulator.observedMetrics.add(metric); }
    }
    for (const metric of AVG_METRICS) {
      const value = row.metrics[metric];
      if (typeof value === "number" && Number.isFinite(value)) { accumulator.sums[metric] += value; accumulator.counts[metric] += 1; accumulator.observedMetrics.add(metric); }
    }
  }
  const series: BucketPoint[] = buckets.map((bucket, index) => {
    const accumulator = accumulators[index];
    const metrics = emptyMetricRecord();
    for (const metric of SUM_METRICS) metrics[metric] = accumulator.sums[metric];
    for (const metric of AVG_METRICS) metrics[metric] = accumulator.counts[metric] > 0 ? accumulator.sums[metric] / accumulator.counts[metric] : 0;
    const observedMetrics = METRIC_ORDER.filter((metric) => accumulator.observedMetrics.has(metric));
    const isPending = includesInstagram && bucket.end.getTime() > consolidationCutoffMs;
    return { bucketStart: bucket.start.toISOString(), bucketEnd: bucket.end.toISOString(), label: bucket.label, publishedAt: bucket.start.toISOString(), isPending, hasObservedData: observedMetrics.length > 0, observedMetrics, metrics };
  });
  const availability = getAvailability(series);
  if (availability.status === "empty") {
    return { totals: createNullableDashboardMetricRecord(null), availability, series };
  }
  const totals = createNullableDashboardMetricRecord(null);
  for (const metric of SUM_METRICS) {
    let observed = false;
    let total = 0;
    for (const accumulator of accumulators) { if (accumulator.observedMetrics.has(metric)) { observed = true; total += accumulator.sums[metric]; } }
    totals[metric] = observed ? total : null;
  }
  for (const metric of AVG_METRICS) {
    let total = 0;
    let count = 0;
    for (const accumulator of accumulators) { total += accumulator.sums[metric]; count += accumulator.counts[metric]; }
    totals[metric] = count > 0 ? total / count : null;
  }
  return {
    totals,
    availability,
    series,
  };
}



