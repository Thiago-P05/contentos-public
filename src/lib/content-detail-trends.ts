import type { MetricMap } from "@/lib/types";

export type ContentDetailTrendPoint = {
  label: string;
  capturedAt: string;
  views: number;
  comments: number;
};

const VIEW_ALIASES = [
  "views",
  "viewCount",
  "view_count",
  "video_views",
  "play_count",
  "reach",
] as const;
const COMMENT_ALIASES = ["comments", "commentCount", "comment_count"] as const;

type DailySnapshotMetrics = {
  capturedAt: string;
  views: number;
  comments: number;
};

function getMetricByAliases(metrics: MetricMap, aliases: readonly string[]) {
  for (const alias of aliases) {
    const value = metrics[alias];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return 0;
}

function formatShortDate(dateBucket: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateBucket)) {
    return "Sin fecha";
  }

  return `${dateBucket.slice(8, 10)}/${dateBucket.slice(5, 7)}`;
}

function toDailySnapshotMetrics(snapshot: {
  capturedAt: string;
  metrics: MetricMap;
}): DailySnapshotMetrics {
  return {
    capturedAt: snapshot.capturedAt,
    views: getMetricByAliases(snapshot.metrics, VIEW_ALIASES),
    comments: getMetricByAliases(snapshot.metrics, COMMENT_ALIASES),
  };
}

export function buildContentDetailTrendPoints(
  snapshots: Array<{ capturedAt: string; metrics: MetricMap }>,
): ContentDetailTrendPoint[] {
  if (snapshots.length === 0) {
    return [];
  }

  const sorted = [...snapshots].sort((left, right) =>
    left.capturedAt.localeCompare(right.capturedAt),
  );
  const metricsByDate = new Map<string, DailySnapshotMetrics[]>();

  for (const snapshot of sorted) {
    const dateBucket = snapshot.capturedAt.slice(0, 10);
    const currentBucket = metricsByDate.get(dateBucket) ?? [];
    currentBucket.push(toDailySnapshotMetrics(snapshot));
    metricsByDate.set(dateBucket, currentBucket);
  }

  let previousLastSnapshot: DailySnapshotMetrics | null = null;

  return [...metricsByDate.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([dateBucket, dailySnapshots]) => {
      const firstSnapshot = dailySnapshots[0]!;
      const lastSnapshot = dailySnapshots[dailySnapshots.length - 1]!;
      const baselineSnapshot =
        previousLastSnapshot ??
        (dailySnapshots.length > 1 ? firstSnapshot : null);
      const viewsBaseline = baselineSnapshot?.views ?? 0;
      const commentsBaseline = baselineSnapshot?.comments ?? 0;

      previousLastSnapshot = lastSnapshot;

      return {
        capturedAt: lastSnapshot.capturedAt,
        label: formatShortDate(dateBucket),
        views: Math.max(lastSnapshot.views - viewsBaseline, 0),
        comments: Math.max(lastSnapshot.comments - commentsBaseline, 0),
      };
    });
}
