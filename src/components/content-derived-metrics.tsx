import {
  computeDerivedMetrics,
  createNullableDashboardMetricRecord,
  formatDashboardMetricValue,
} from "@/lib/dashboard-metrics";
import type { DashboardTrendMetricKey, MetricMap, Platform } from "@/lib/types";

const DETAIL_METRIC_CONFIG: Record<
  Platform,
  Array<{ key: DashboardTrendMetricKey; label: string }>
> = {
  instagram: [
    { key: "engagementRate", label: "Engagement rate" },
    { key: "commentRate", label: "Comment rate" },
    { key: "shareRate", label: "Share rate" },
    { key: "saveRate", label: "Save rate" },
    { key: "avgWatchTimeMs", label: "Avg watch time" },
    { key: "skipRate", label: "Skip rate" },
  ],
  tiktok: [
    { key: "engagementRate", label: "Engagement rate" },
    { key: "likeRate", label: "Like rate" },
    { key: "commentRate", label: "Comment rate" },
    { key: "shareRate", label: "Share rate" },
  ],
  youtube: [],
};

function toDashboardMetricRecord(metrics: MetricMap) {
  const record = createNullableDashboardMetricRecord(null);
  record.views = metrics.views ?? metrics.viewCount ?? metrics.reach ?? null;
  record.reach = metrics.reach ?? null;
  record.likes = metrics.likes ?? null;
  record.comments = metrics.comments ?? null;
  record.shares = metrics.shares ?? null;
  record.saves = metrics.saves ?? null;
  record.contentInteractions =
    metrics.total_interactions ??
    [metrics.likes, metrics.comments, metrics.shares, metrics.saves].reduce(
      (sum: number, value) => sum + (typeof value === "number" ? value : 0),
      0,
    );
  record.avgWatchTimeMs = metrics.ig_reels_avg_watch_time ?? null;
  record.skipRate = metrics.reels_skip_rate ?? null;
  record.watchTimeMinutes = metrics.estimatedMinutesWatched ?? null;
  record.averageViewDurationSeconds = metrics.averageViewDuration ?? null;
  return record;
}


export function ContentDerivedMetrics({
  platform,
  metrics,
  variant = "default",
}: {
  platform: Platform;
  metrics: MetricMap;
  variant?: "default" | "compact";
}) {
  const rawMetrics = toDashboardMetricRecord(metrics);
  const derivedMetrics = computeDerivedMetrics(rawMetrics) as Partial<Record<DashboardTrendMetricKey, number | null>>;
  const cards = DETAIL_METRIC_CONFIG[platform]
    .map((item) => ({ ...item, value: rawMetrics[item.key] ?? derivedMetrics[item.key] ?? null }))
    .filter((item) => item.value !== null);

  if (cards.length === 0) return null;

  const isCompact = variant === "compact";

  return (
    <div
      className={[
        "mt-4 grid gap-3",
        isCompact ? "sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5" : "sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6",
      ].join(" ")}
    >
      {cards.map((item) => {
        return (
          <div
            key={item.key}
            className={[
              "rounded-md border border-line bg-surface",
              isCompact ? "px-3 py-3" : "px-4 py-4",
            ].join(" ")}
          >
            <p className="font-mono text-label uppercase tracking-caps text-muted-foreground">{item.label}</p>
            <p
              className={[
                "mt-3 font-medium tracking-display text-foreground",
                isCompact ? "text-[0.95rem]" : "text-[1.05rem]",
              ].join(" ")}
            >
              {formatDashboardMetricValue(item.key, item.value)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
