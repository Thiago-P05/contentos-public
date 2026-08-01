import type { DashboardTrendMetricKey } from "@/lib/types";

export type MetricAggregationKind = "sum" | "average";

/**
 * Unica fuente de verdad: como se agrega cada metrica entre buckets/dias.
 * Los consumidores eligen SU subconjunto de keys; la clase sale de aca.
 */
export const METRIC_AGGREGATION: Record<DashboardTrendMetricKey, MetricAggregationKind> = {
  views: "sum",
  comments: "sum",
  likes: "sum",
  shares: "sum",
  saves: "sum",
  reach: "sum",
  contentInteractions: "sum",
  profileVisits: "sum",
  linkClicks: "sum",
  follows: "sum",
  watchTimeMinutes: "sum",
  subscribersGained: "sum",
  subscribersLost: "sum",
  avgWatchTimeMs: "average",
  skipRate: "average",
  followerCount: "average",
  averageViewDurationSeconds: "average",
  engagementRate: "average",
  likeRate: "average",
  commentRate: "average",
  shareRate: "average",
  saveRate: "average",
  profileCtr: "average",
  linkCtr: "average",
  followConversion: "average",
  avgViewsPerPiece: "average",
  subsPerThousandViews: "average",
};

export function sumMetricsOf(keys: DashboardTrendMetricKey[]) {
  return keys.filter((key) => METRIC_AGGREGATION[key] === "sum");
}

export function averageMetricsOf(keys: DashboardTrendMetricKey[]) {
  return keys.filter((key) => METRIC_AGGREGATION[key] === "average");
}
