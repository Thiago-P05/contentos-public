import type { DashboardTrendMetricKey } from "@/lib/types";
import { metricValue } from "@/lib/utils";

export type LibraryMetricItem = {
  publishedAt: string;
  latestMetrics: Record<string, number | null>;
};

const VIEW_ALIASES = [
  "views",
  "viewCount",
  "view_count",
  "video_views",
  "play_count",
  "reach",
] as const;
const REACH_ALIASES = ["reach", "impressions", "views", "viewCount", "view_count"] as const;
const LIKE_ALIASES = ["likes", "likeCount", "like_count"] as const;
const COMMENT_ALIASES = ["comments", "commentCount", "comment_count"] as const;
const SHARE_ALIASES = ["shares", "shareCount", "share_count"] as const;
const SAVE_ALIASES = ["saves", "saved", "save_count", "saved_count"] as const;

function toFiniteNumber(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return value;
}

function getMetricWithAliases(
  metrics: Record<string, number | null>,
  aliases: readonly string[],
) {
  return toFiniteNumber(metricValue(metrics, ...aliases));
}

function toPublishedAtMs(value: string) {
  const parsed = new Date(value).getTime();
  if (Number.isNaN(parsed)) {
    return 0;
  }

  return parsed;
}

function toDateBucket(value: string) {
  if (value.length >= 10) {
    return value.slice(0, 10);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "unknown";
  }

  return parsed.toISOString().slice(0, 10);
}

export function getLibraryItemViews(item: LibraryMetricItem) {
  return getMetricWithAliases(item.latestMetrics, VIEW_ALIASES);
}

export function getLibraryItemReach(item: LibraryMetricItem) {
  return getMetricWithAliases(item.latestMetrics, REACH_ALIASES);
}

export function getLibraryItemLikes(item: LibraryMetricItem) {
  return getMetricWithAliases(item.latestMetrics, LIKE_ALIASES);
}

export function getLibraryItemComments(item: LibraryMetricItem) {
  return getMetricWithAliases(item.latestMetrics, COMMENT_ALIASES);
}

export function getLibraryItemShares(item: LibraryMetricItem) {
  return getMetricWithAliases(item.latestMetrics, SHARE_ALIASES);
}

export function getLibraryItemSaves(item: LibraryMetricItem) {
  return getMetricWithAliases(item.latestMetrics, SAVE_ALIASES);
}

export function getLibraryItemInteractions(item: LibraryMetricItem) {
  return (
    getLibraryItemLikes(item) +
    getLibraryItemComments(item) +
    getLibraryItemShares(item) +
    getLibraryItemSaves(item)
  );
}

export function getLibraryItemEngagementRate(item: LibraryMetricItem) {
  const views = getLibraryItemViews(item);
  if (views <= 0) {
    return 0;
  }

  return (getLibraryItemInteractions(item) / views) * 100;
}

export type LibrarySummary = {
  latestItems: LibraryMetricItem[];
  totalViews: number;
  totalInteractions: number;
  avgViewsPerItem: number;
  weightedEngagementRate: number;
  withDataCount: number;
  withoutDataCount: number;
  withDataPct: number;
  viewsSeries: Array<{ date: string; value: number }>;
};

export type LibraryViewsSeriesSourcePoint = {
  bucketStart: string;
  observedMetrics: DashboardTrendMetricKey[];
  metrics: Partial<Record<DashboardTrendMetricKey, number>>;
};

export function buildLibrarySummary(items: LibraryMetricItem[], limit = 60): LibrarySummary {
  const latestItems = [...items]
    .sort((left, right) => toPublishedAtMs(right.publishedAt) - toPublishedAtMs(left.publishedAt))
    .slice(0, Math.max(1, limit));

  const totalViews = latestItems.reduce((sum, item) => sum + getLibraryItemViews(item), 0);
  const totalInteractions = latestItems.reduce(
    (sum, item) => sum + getLibraryItemInteractions(item),
    0,
  );
  const avgViewsPerItem = latestItems.length > 0 ? totalViews / latestItems.length : 0;
  const weightedEngagementRate =
    totalViews > 0 ? (totalInteractions / totalViews) * 100 : 0;
  const withDataCount = latestItems.filter((item) => {
    return (
      getLibraryItemViews(item) > 0 ||
      getLibraryItemLikes(item) > 0 ||
      getLibraryItemComments(item) > 0 ||
      getLibraryItemShares(item) > 0 ||
      getLibraryItemSaves(item) > 0
    );
  }).length;
  const withoutDataCount = Math.max(0, latestItems.length - withDataCount);
  const withDataPct = latestItems.length > 0 ? (withDataCount / latestItems.length) * 100 : 0;

  const viewsByDate = new Map<string, number>();
  for (const item of latestItems) {
    const date = toDateBucket(item.publishedAt);
    viewsByDate.set(date, (viewsByDate.get(date) ?? 0) + getLibraryItemViews(item));
  }

  const viewsSeries = [...viewsByDate.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([date, value]) => ({ date, value }));

  return {
    latestItems,
    totalViews,
    totalInteractions,
    avgViewsPerItem,
    weightedEngagementRate,
    withDataCount,
    withoutDataCount,
    withDataPct,
    viewsSeries,
  };
}

export function buildLibraryViewsSeriesFromPerformance(
  points: LibraryViewsSeriesSourcePoint[],
) {
  const viewsByDate = new Map<string, number>();

  for (const point of points) {
    if (!point.observedMetrics.includes("views")) {
      continue;
    }

    const value = typeof point.metrics.views === "number" ? point.metrics.views : 0;
    const date = toDateBucket(point.bucketStart);
    viewsByDate.set(date, (viewsByDate.get(date) ?? 0) + value);
  }

  return [...viewsByDate.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([date, value]) => ({ date, value }));
}
