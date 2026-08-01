import { cache } from "react";
import { after } from "next/server";
import {
  buildContentCatalogCacheKey,
  buildContentLibraryCacheKey,
  buildDashboardOverviewCacheKey,
  CONTENT_CATALOG_TTL_SECONDS,
  DASHBOARD_OVERVIEW_TTL_SECONDS,
  getCachedJson,
  getDashboardCacheGeneration,
  setCachedJson,
} from "@/lib/cache/read-cache";
import { getDefaultPlatformConnectionBriefFields } from "@/lib/connection-briefs";
import {
  buildCompetitionWindowAggregate,
  getTopCompetitorPostsByComments,
  getTopCompetitorPostsByViews,
} from "@/lib/competition/metrics";
import { buildDashboardPerformanceFromDailyInsights, type DailyPerformanceInput } from "@/lib/daily-dashboard-performance";
import { getDashboardPreviousAnchor, getDashboardRangeBounds } from "@/lib/dashboard-range";
import {
  computeDerivedMetrics,
  createDashboardMetricRecord,
  createNullableDashboardMetricRecord,
  DASHBOARD_METRIC_KEYS,
} from "@/lib/dashboard-metrics";
import { getMissingEnvKeys, hasInstagramLegacyConfig, hasSupabaseConfig } from "@/lib/env";
import { createServerTimer } from "@/lib/perf/server-timing";
import { resolvePreferredConnectionId } from "@/lib/preferred-connection";
import {
  getLatestMetrics,
  toAIInsight,
  toContentItem,
  toMetricSnapshot,
  toPlatformComment,
  toPlatformConnection,
  toPlatformConnectionBrief,
  toPlatformConnectionCredentials,
  toAutomationOutput,
  toAutomationRun,
  toAutomationRunItem,
  toCompetitorAnalysisHistoryItem,
  toCompetitorAnalysisReport,
  toCompetitorAnalysisRun,
  toCompetitorContentSnapshot,
  toCompetitorProfile,
  toSyncRun,
  toTextAsset,
} from "@/lib/supabase/mappers";
import {
  fetchConnectionBriefRow,
  fetchConnectionBriefRows,
  fetchConnectionById,
  fetchConnectionRows,
  fetchContentRowById,
  fetchContentLibraryInsightIds,
  fetchContentLibraryRows,
  fetchContentRows,
  fetchInsightRowByContentItem,
  fetchInsightRows,
  fetchLatestSnapshotRows,
  fetchLatestContentLibrarySnapshotRows,
  fetchSnapshotRows,
  fetchPlatformCommentRows,
  fetchPlatformDailyInsightRows,
  fetchSnapshotRowsByContentItem,
  fetchAutomationOutputRows,
  fetchAutomationRunItemRows,
  fetchAutomationRunRow,
  fetchAutomationRunRows,
  fetchSyncRunRows,
  fetchTextAssetRowsByContentItem,
  fetchTextAssetRowsByContentItems,
  fetchCompetitorAnalysisRunRow,
  fetchCompetitorAnalysisRunRows,
  fetchCompetitorContentSnapshotRows,
  fetchCompetitorProfileById,
  fetchCompetitorProfileRows,
} from "@/lib/supabase/queries";
import {
  DATABASE_SETUP_ISSUE,
  SUPABASE_UNAVAILABLE_ISSUE,
  isRecoverableSetupError,
  isTransientSupabaseError,
} from "@/lib/supabase/errors";
import { metricValue } from "@/lib/utils";
import type {
  AutomationRunDetail,
  AutomationType,
  ContentDetail,
  ContentLibraryItem,
  ContentListItem,
  DashboardOverview,
  DashboardRange,
  Platform,
  PlatformConnection,
  PlatformConnectionBrief,
  PlatformFilter,
  SyncRun,
  TextAsset,
} from "@/lib/types";
import type { SnapshotRow } from "@/lib/supabase/types";
import type {
  CompetitionAnalysisDetail,
  CompetitorAnalysisHistoryItem,
} from "@/lib/competition/types";

function attachConnectionBriefs(
  connections: PlatformConnection[],
  briefRows: Awaited<ReturnType<typeof fetchConnectionBriefRows>>,
) {
  const briefMap = new Map(
    briefRows.map((row) => {
      const brief = toPlatformConnectionBrief(row);
      return [brief.connectionId, brief] as const;
    }),
  );

  return connections.map((connection) => ({
    ...connection,
    brief:
      briefMap.get(connection.id) ?? {
        id: `default-${connection.id}`,
        connectionId: connection.id,
        ...getDefaultPlatformConnectionBriefFields(),
        createdAt: connection.createdAt,
        updatedAt: connection.updatedAt,
      },
  }));
}
function normalizeConnectionSelection(
  availableConnections: PlatformConnection[],
  connectionId?: string | null,
) {
  return resolvePreferredConnectionId(availableConnections, connectionId);
}

function filterCatalogByPlatformAndConnection(
  items: ContentListItem[],
  platform: PlatformFilter,
  connectionId?: string | null,
) {
  let nextItems = items;

  if (platform !== "all") {
    nextItems = nextItems.filter((item) => item.platform === platform);
  }

  if (connectionId && connectionId !== "all") {
    nextItems = nextItems.filter((item) => item.connectionId === connectionId);
  }

  return nextItems;
}

function toUtcDateOnly(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

function filterCatalogByRange(
  items: ContentListItem[],
  range: DashboardRange,
  anchor?: string | null,
) {
  if (range === "all") {
    return items;
  }

  const bounds = getDashboardRangeBounds(range, anchor);

  if (!bounds.start || !bounds.end) {
    return items;
  }

  const start = bounds.start.getTime();
  const end = bounds.end.getTime();

  return items.filter((item) => {
    const publishedAt = toUtcDateOnly(item.publishedAt).getTime();
    return publishedAt >= start && publishedAt <= end;
  });
}

function toAnchorDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function hasMetricRecordValue(metrics: Record<string, number | null>) {
  return Object.values(metrics).some(
    (value) => typeof value === "number" && Number.isFinite(value) && value > 0,
  );
}

function hasDailyInsightMetricValue(
  row: Awaited<ReturnType<typeof fetchPlatformDailyInsightRows>>[number],
) {
  return [
    row.views,
    row.impressions,
    row.reach,
    row.likes,
    row.comments,
    row.shares,
    row.saves,
    row.content_interactions,
    row.profile_visits,
    row.link_clicks,
    row.follows,
    row.follower_count,
    row.watch_time_minutes,
    row.average_view_duration_seconds,
    row.subscribers_gained,
    row.subscribers_lost,
  ].some((value) => typeof value === "number" && Number.isFinite(value) && value > 0);
}

function getLatestCatalogAnchor(items: ContentListItem[]) {
  return items.reduce<string | null>((latest, item) => {
    if (!hasMetricRecordValue(item.latestMetrics)) {
      return latest;
    }

    const anchorDate = toAnchorDate(item.publishedAt);
    if (!anchorDate) {
      return latest;
    }

    return !latest || anchorDate > latest ? anchorDate : latest;
  }, null);
}

function getLatestDailyInsightAnchor(
  rows: Awaited<ReturnType<typeof fetchPlatformDailyInsightRows>>,
) {
  return rows.reduce<string | null>((latest, row) => {
    if (!hasDailyInsightMetricValue(row)) {
      return latest;
    }

    const anchorDate = toAnchorDate(row.insight_date);
    if (!anchorDate) {
      return latest;
    }

    return !latest || anchorDate > latest ? anchorDate : latest;
  }, null);
}

function getLatestDashboardAnchor(
  catalog: ContentListItem[],
  dailyInsightRows: Awaited<ReturnType<typeof fetchPlatformDailyInsightRows>>,
) {
  const latestCatalogAnchor = getLatestCatalogAnchor(catalog);
  const latestInsightAnchor = getLatestDailyInsightAnchor(dailyInsightRows);

  if (latestCatalogAnchor && latestInsightAnchor) {
    return latestCatalogAnchor > latestInsightAnchor ? latestCatalogAnchor : latestInsightAnchor;
  }

  return latestCatalogAnchor ?? latestInsightAnchor;
}

function resolveSelectedDashboardAnchor(
  requestedAnchor: string | null | undefined,
  latestDataAnchor: string | null,
) {
  const normalizedRequestedAnchor = toAnchorDate(requestedAnchor);

  if (normalizedRequestedAnchor && latestDataAnchor && normalizedRequestedAnchor > latestDataAnchor) {
    return latestDataAnchor;
  }

  return normalizedRequestedAnchor ?? latestDataAnchor;
}

function filterDailyInsightRowsByRange(
  rows: Awaited<ReturnType<typeof fetchPlatformDailyInsightRows>>,
  since: string | null,
  until: string | null,
) {
  return rows.filter((row) => {
    if (since && row.insight_date < since) {
      return false;
    }

    if (until && row.insight_date > until) {
      return false;
    }

    return true;
  });
}

function filterCommentRowsByRange(
  rows: Awaited<ReturnType<typeof fetchPlatformCommentRows>>,
  range: DashboardRange,
  anchor?: string | null,
) {
  if (range === "all") {
    return rows;
  }

  const bounds = getDashboardRangeBounds(range, anchor);

  if (!bounds.start || !bounds.end) {
    return rows;
  }

  const start = bounds.start.getTime();
  const end = bounds.end.getTime();

  return rows.filter((row) => {
    const commentedAt = toUtcDateOnly(row.commented_at).getTime();
    return commentedAt >= start && commentedAt <= end;
  });
}

function appendSetupIssue(issues: string[], issue: string) {
  if (!issues.includes(issue)) {
    issues.push(issue);
  }
}

function buildCatalog(
  itemRows: Awaited<ReturnType<typeof fetchContentRows>>,
  latestSnapshotRows: Awaited<ReturnType<typeof fetchLatestSnapshotRows>>,
  insightRows: Awaited<ReturnType<typeof fetchInsightRows>> = [],
) {
  const latestMetrics = getLatestMetrics(latestSnapshotRows.map(toMetricSnapshot));
  const latestInsightByItem = new Map(
    insightRows.map((row) => {
      const insight = toAIInsight(row);
      return [insight.contentItemId, insight] as const;
    }),
  );

  return itemRows.map(toContentItem).map((item) => ({
    ...item,
    latestMetrics: latestMetrics.get(item.id)?.metrics ?? {},
    latestInsight: latestInsightByItem.get(item.id) ?? null,
  }));
}

async function fetchInsightRowsOrEmpty(contentItemIds: string[]) {
  try {
    return await fetchInsightRows(contentItemIds);
  } catch (error) {
    if (isRecoverableSetupError(error)) {
      return [];
    }

    throw error;
  }
}
async function fetchInsightRowOrNull(contentItemId: string) {
  try {
    return await fetchInsightRowByContentItem(contentItemId);
  } catch (error) {
    if (isRecoverableSetupError(error)) {
      return null;
    }

    throw error;
  }
}

function rawPayloadMetricValue(rawPayload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const candidate = rawPayload[key];

    if (typeof candidate === "number") {
      return candidate;
    }

    if (candidate && typeof candidate === "object") {
      const value = (candidate as { value?: unknown }).value;

      if (typeof value === "number") {
        return value;
      }

      if (
        value &&
        typeof value === "object" &&
        "follows" in value &&
        typeof value.follows === "number"
      ) {
        return value.follows;
      }

      if ("follows" in candidate && typeof candidate.follows === "number") {
        return candidate.follows;
      }
    }
  }

  return null;
}

function rawPayloadFollowsValue(rawPayload: Record<string, unknown>) {
  return rawPayloadMetricValue(rawPayload, ["follows", "follows_and_unfollows"]);
}

type CatalogMetricTotals = {
  views: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  profileVisits: number;
  linkClicks: number;
  follows: number;
  contentInteractions: number;
};

function createCatalogMetricTotals(): CatalogMetricTotals {
  return {
    views: 0,
    reach: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    profileVisits: 0,
    linkClicks: 0,
    follows: 0,
    contentInteractions: 0,
  };
}

function addCatalogItemMetrics(totals: CatalogMetricTotals, item: ContentListItem) {
  const views =
    metricValue(
      item.latestMetrics,
      "views",
      "viewCount",
      "view_count",
      "video_views",
      "play_count",
      "plays",
      "content_views",
      "impressions",
      "reach",
    ) ?? 0;
  const reach =
    metricValue(
      item.latestMetrics,
      "reach",
      "views",
      "viewCount",
      "view_count",
      "video_views",
      "play_count",
    ) ?? 0;
  const likes = metricValue(item.latestMetrics, "likes", "likeCount", "like_count") ?? 0;
  const comments =
    metricValue(item.latestMetrics, "comments", "commentCount", "comment_count") ?? 0;
  const shares = metricValue(item.latestMetrics, "shares", "shareCount", "share_count") ?? 0;
  const saves = metricValue(item.latestMetrics, "saves", "saved", "save_count", "saved_count") ?? 0;
  const profileVisits = metricValue(item.latestMetrics, "profileVisits", "profile_views") ?? 0;
  const linkClicks =
    metricValue(
      item.latestMetrics,
      "linkClicks",
      "link_clicks",
      "website_clicks",
      "profile_links_taps",
    ) ?? 0;
  const follows = metricValue(item.latestMetrics, "follows") ?? 0;
  const contentInteractions =
    metricValue(
      item.latestMetrics,
      "contentInteractions",
      "content_interactions",
      "total_interactions",
    ) ??
    likes + comments + shares + saves;

  totals.views += views;
  totals.reach += reach;
  totals.likes += likes;
  totals.comments += comments;
  totals.shares += shares;
  totals.saves += saves;
  totals.profileVisits += profileVisits;
  totals.linkClicks += linkClicks;
  totals.follows += follows;
  totals.contentInteractions += contentInteractions;

  return totals;
}

function getCatalogMetricTotals(items: ContentListItem[]) {
  return items.reduce((totals, item) => addCatalogItemMetrics(totals, item), createCatalogMetricTotals());
}

function formatCatalogSeriesLabel(dateKey: string) {
  const [, month, day] = dateKey.split("-");
  return `${day ?? "00"}/${month ?? "00"}`;
}

function buildCatalogPerformanceSeries(items: ContentListItem[]): DashboardOverview["performanceSeries"] {
  const buckets = new Map<string, ContentListItem[]>();

  for (const item of items) {
    const dateKey = item.publishedAt.slice(0, 10);
    const bucketItems = buckets.get(dateKey) ?? [];
    bucketItems.push(item);
    buckets.set(dateKey, bucketItems);
  }

  return [...buckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-30)
    .map(([dateKey, bucketItems]) => {
      const totals = getCatalogMetricTotals(bucketItems);
      const metrics = createDashboardMetricRecord(0);
      const observedMetrics: DashboardOverview["performanceSeries"][number]["observedMetrics"] = [];

      for (const [metricKey, value] of Object.entries(totals)) {
        const key = metricKey as keyof typeof metrics;
        metrics[key] = value;

        if (value > 0) {
          observedMetrics.push(key);
        }
      }

      const derived = computeDerivedMetrics(metrics, { publishedItems: bucketItems.length });
      for (const [metricKey, value] of Object.entries(derived)) {
        if (typeof value !== "number" || !Number.isFinite(value)) {
          continue;
        }

        const key = metricKey as keyof typeof metrics;
        metrics[key] = value;

        if (value > 0 && !observedMetrics.includes(key)) {
          observedMetrics.push(key);
        }
      }

      return {
        bucketStart: `${dateKey}T00:00:00.000Z`,
        bucketEnd: `${dateKey}T23:59:59.999Z`,
        label: formatCatalogSeriesLabel(dateKey),
        publishedAt: `${dateKey}T00:00:00.000Z`,
        isPending: false,
        hasObservedData: observedMetrics.length > 0,
        observedMetrics,
        metrics,
      };
    })
    .filter((point) => point.hasObservedData);
}

function buildMonthPerformanceTotals(
  dailyInsightRows: Awaited<ReturnType<typeof fetchPlatformDailyInsightRows>>,
  catalog: ContentListItem[],
): DashboardOverview["performanceTotals"] {
  const next = createNullableDashboardMetricRecord(null);
  const catalogTotals = getCatalogMetricTotals(catalog);
  const dailyViews = dailyInsightRows.reduce(
    (sum, row) => sum + (row.views ?? row.impressions ?? 0),
    0,
  );
  const dailyFollows = dailyInsightRows.reduce((sum, row) => sum + (row.follows ?? 0), 0);
  const followerRows = dailyInsightRows
    .filter((row) => typeof row.follower_count === "number")
    .sort((left, right) => left.insight_date.localeCompare(right.insight_date));

  next.views = dailyViews > 0 ? dailyViews : catalogTotals.views || null;

  if (followerRows.length >= 2) {
    const firstCount = followerRows[0]!.follower_count!;
    const lastCount = followerRows[followerRows.length - 1]!.follower_count!;
    const diff = lastCount - firstCount;
    next.follows = diff > 0 ? diff : dailyFollows || catalogTotals.follows || null;
  } else {
    next.follows = dailyFollows || catalogTotals.follows || null;
  }

  return next;
}

function toDailyPerformanceInput(
  rows: Awaited<ReturnType<typeof fetchPlatformDailyInsightRows>>,
) {
  return rows.map((row) => {
    const rawPayload = row.raw_payload ?? {};
    const followerCount = row.follower_count;
    const followsFromApi = row.follows ?? rawPayloadFollowsValue(rawPayload);

    return {
      insightDate: row.insight_date,
      platform: row.platform,
      connectionId: row.connection_id,
      metrics: {
        views:
          row.views ??
          row.impressions ??
          rawPayloadMetricValue(rawPayload, ["views", "content_views"]),
        reach: (row.reach || null) ?? rawPayloadMetricValue(rawPayload, ["reach"]),
        likes:
          (row as { likes?: number | null }).likes ??
          rawPayloadMetricValue(rawPayload, ["likes"]),
        comments:
          (row as { comments?: number | null }).comments ??
          rawPayloadMetricValue(rawPayload, ["comments"]),
        shares:
          (row as { shares?: number | null }).shares ??
          rawPayloadMetricValue(rawPayload, ["shares"]),
        saves:
          (row as { saves?: number | null }).saves ??
          rawPayloadMetricValue(rawPayload, ["saves"]),
        contentInteractions:
          row.content_interactions ??
          rawPayloadMetricValue(rawPayload, ["total_interactions"]),
        profileVisits:
          row.profile_visits ?? rawPayloadMetricValue(rawPayload, ["profile_views"]),
        linkClicks:
          row.link_clicks ??
          rawPayloadMetricValue(rawPayload, ["website_clicks", "profile_links_taps"]),
        follows:
          row.platform === "instagram"
            ? followerCount ?? followsFromApi
            : row.platform === "youtube"
              ? row.subscribers_gained ?? followsFromApi
              : row.follows ?? followsFromApi,
        followerCount: followerCount,
        watchTimeMinutes:
          (row as { watch_time_minutes?: number | null }).watch_time_minutes ??
          rawPayloadMetricValue(rawPayload, ["estimatedMinutesWatched", "watch_time_minutes"]),
        averageViewDurationSeconds:
          (row as { average_view_duration_seconds?: number | null }).average_view_duration_seconds ??
          rawPayloadMetricValue(rawPayload, ["averageViewDuration", "average_view_duration_seconds"]),
        subscribersGained:
          (row as { subscribers_gained?: number | null }).subscribers_gained ??
          rawPayloadMetricValue(rawPayload, ["subscribersGained", "subscribers_gained"]),
        subscribersLost:
          (row as { subscribers_lost?: number | null }).subscribers_lost ??
          rawPayloadMetricValue(rawPayload, ["subscribersLost", "subscribers_lost"]),
        avgWatchTimeMs: rawPayloadMetricValue(rawPayload, ["ig_reels_avg_watch_time", "avg_watch_time"]),
        skipRate: rawPayloadMetricValue(rawPayload, ["reels_skip_rate", "skip_rate"]),
      },
    };
  });
}

export function buildTikTokSnapshotPerformanceInputs(
  snapshots: SnapshotRow[],
  catalog: ContentListItem[],
): DailyPerformanceInput[] {
  const connectionByContentId = new Map(catalog.map((item) => [item.id, item.connectionId]));
  const snapshotsByContentId = new Map<string, SnapshotRow[]>();

  for (const snapshot of snapshots) {
    if (snapshot.source_platform !== "tiktok" || !connectionByContentId.has(snapshot.content_item_id)) {
      continue;
    }
    const entries = snapshotsByContentId.get(snapshot.content_item_id) ?? [];
    entries.push(snapshot);
    snapshotsByContentId.set(snapshot.content_item_id, entries);
  }

  const inputs: DailyPerformanceInput[] = [];
  const metricKeys = ["views", "likes", "comments", "shares"] as const;

  for (const [contentItemId, entries] of snapshotsByContentId) {
    entries.sort((left, right) => left.captured_at.localeCompare(right.captured_at));
    const connectionId = connectionByContentId.get(contentItemId);
    if (!connectionId) continue;

    for (let index = 1; index < entries.length; index += 1) {
      const previous = entries[index - 1]!;
      const current = entries[index]!;
      const metrics: DailyPerformanceInput["metrics"] = {};

      for (const key of metricKeys) {
        const currentValue = metricValue(current.metrics ?? {}, key);
        const previousValue = metricValue(previous.metrics ?? {}, key);
        if (typeof currentValue === "number" && typeof previousValue === "number") {
          metrics[key] = Math.max(0, currentValue - previousValue);
        }
      }

      if (Object.keys(metrics).length > 0) {
        inputs.push({
          insightDate: current.captured_at.slice(0, 10),
          platform: "tiktok",
          connectionId,
          metrics,
        });
      }
    }
  }

  return inputs;
}

function buildSuspiciousFollowerCountKeySet(
  rows: Awaited<ReturnType<typeof fetchPlatformDailyInsightRows>>,
) {
  const rowsByConnection = new Map<string, typeof rows>();

  for (const row of rows) {
    if (row.platform !== "instagram") {
      continue;
    }

    const connectionRows = rowsByConnection.get(row.connection_id) ?? [];
    connectionRows.push(row);
    rowsByConnection.set(row.connection_id, connectionRows);
  }

  const suspiciousKeys = new Set<string>();

  for (const [connectionId, connectionRows] of rowsByConnection.entries()) {
    const ordered = [...connectionRows].sort((left, right) =>
      left.insight_date.localeCompare(right.insight_date),
    );
    let hadPositiveFollowerCount = false;

    for (const row of ordered) {
      const followerCount = row.follower_count;
      if (typeof followerCount !== "number" || !Number.isFinite(followerCount)) {
        continue;
      }

      if (followerCount > 0) {
        hadPositiveFollowerCount = true;
        continue;
      }

      if (!hadPositiveFollowerCount) {
        continue;
      }

      const rawPayload = row.raw_payload ?? {};
      const candidateEndTime =
        ((rawPayload.follower_count as { end_time?: unknown } | undefined)?.end_time) ?? null;
      const metricDate = normalizeMetricDateFromEndTime(candidateEndTime) ?? row.insight_date;
      suspiciousKeys.add(`${row.platform}:${connectionId}:${metricDate}`);
    }
  }

  return suspiciousKeys;
}

function normalizeMetricDateFromEndTime(endTime: unknown) {
  if (typeof endTime !== "string" || endTime.length < 10) {
    return null;
  }

  const parsed = new Date(endTime);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  const fallback = endTime.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(fallback) ? fallback : null;
}

function emptyOverview(
  missingEnv: string[],
  range: DashboardRange,
  platform: PlatformFilter,
): DashboardOverview {
  return {
    configured: false,
    missingEnv,
    setupIssues: [],
    generatedAt: new Date().toISOString(),
    selectedRange: range,
    selectedPlatform: platform,
    selectedConnectionId: null,
    selectedAnchor: null,
    latestDataAnchor: null,
    availableConnections: [],
    allTimePublishedItems: 0,
    totals: {
      publishedItems: 0,
      analyzedItems: 0,
      totalViews: 0,
      totalComments: 0,
      avgEngagementRate: null,
      avgWatchTimeMs: null,
    },
    performanceTotals: createNullableDashboardMetricRecord(null),
    monthPerformanceTotals: createNullableDashboardMetricRecord(null),
    previousPeriodTotals: createNullableDashboardMetricRecord(null),
    previousMonthTotals: createNullableDashboardMetricRecord(null),
    performanceAvailability: {
      status: "empty",
      message: "Sin datos observados para este periodo.",
    },
    platformBreakdown: [],
    performanceSeries: [],
    topContent: [],
    recentComments: [],
    lastSyncRuns: [],
    followersLost: null,
    connectionViewTotals: [],
  };
}

export async function listPlatformConnections(filters?: {
  platform?: PlatformFilter;
  includeDisconnected?: boolean;
  /** When false, skip loading connection briefs (cheaper list for pickers). Default true. */
  includeBriefs?: boolean;
}) {
  if (!hasSupabaseConfig()) {
    return [];
  }

  let rows: Awaited<ReturnType<typeof fetchConnectionRows>> = [];

  try {
    rows = await fetchConnectionRows({
      platform: filters?.platform,
      includeDisconnected: filters?.includeDisconnected,
    });
  } catch (error) {
    if (isRecoverableSetupError(error)) {
      return [];
    }

    throw error;
  }

  if (filters?.includeBriefs === false) {
    return attachConnectionBriefs(rows.map(toPlatformConnection), []);
  }

  try {
    const briefs = await fetchConnectionBriefRows(rows.map((row) => row.id));
    return attachConnectionBriefs(rows.map(toPlatformConnection), briefs);
  } catch (error) {
    if (isRecoverableSetupError(error)) {
      return attachConnectionBriefs(rows.map(toPlatformConnection), []);
    }

    throw error;
  }
}

export async function getPlatformConnectionBrief(connectionId: string): Promise<PlatformConnectionBrief> {
  try {
    const row = await fetchConnectionBriefRow(connectionId);

    if (row) {
      return toPlatformConnectionBrief(row);
    }
  } catch (error) {
    if (!isRecoverableSetupError(error)) {
      throw error;
    }
  }

  return {
    id: `default-${connectionId}`,
    connectionId,
    ...getDefaultPlatformConnectionBriefFields(),
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}

export async function getPlatformConnectionCredentials(connectionId: string) {
  const row = await fetchConnectionById(connectionId);

  if (!row) {
    return null;
  }

  return toPlatformConnectionCredentials(row);
}

export async function getActivePlatformConnections(filters?: {
  platform?: PlatformFilter;
  connectionId?: string | null;
}) {
  if (!hasSupabaseConfig()) {
    return [];
  }

  try {
    const connections = await listPlatformConnections({
      platform: filters?.platform ?? "all",
      includeDisconnected: false,
    });

    if (filters?.connectionId) {
      return connections.filter((connection) => connection.id === filters.connectionId);
    }

    return connections;
  } catch (error) {
    if (isRecoverableSetupError(error)) {
      return [];
    }

    throw error;
  }
}

export async function getRecentSyncRuns(
  limit = 6,
  filters?: {
    platform?: PlatformFilter;
    connectionId?: string | null;
  },
): Promise<SyncRun[]> {
  if (!hasSupabaseConfig()) {
    return [];
  }

  try {
    const rows = await fetchSyncRunRows(limit, filters);
    return rows.map(toSyncRun);
  } catch (error) {
    if (isRecoverableSetupError(error)) {
      return [];
    }

    throw error;
  }
}

type ContentCatalogFilters = {
  platform?: PlatformFilter;
  query?: string;
  connectionId?: string | null;
  limit?: number;
  offset?: number;
  publishedAfter?: string;
};

async function listContentCatalogUncached(filters?: ContentCatalogFilters) {
  if (!hasSupabaseConfig()) {
    return [];
  }

  try {
    const itemRows = await fetchContentRows({
      platform: filters?.platform,
      query: filters?.query,
      connectionId: filters?.connectionId,
      limit: filters?.limit,
      offset: filters?.offset,
      publishedAfter: filters?.publishedAfter,
    });

    if (itemRows.length === 0) {
      return [];
    }

    const contentItemIds = itemRows.map((row) => row.id);
    const [latestSnapshotRows, insightRows] = await Promise.all([
      fetchLatestSnapshotRows(contentItemIds),
      fetchInsightRowsOrEmpty(contentItemIds),
    ]);

    return buildCatalog(itemRows, latestSnapshotRows, insightRows);
  } catch (error) {
    if (isRecoverableSetupError(error)) {
      return [];
    }

    throw error;
  }
}

export async function getContentTextAssets(contentItemId: string) {
  if (!hasSupabaseConfig()) {
    return [];
  }

  try {
    const rows = await fetchTextAssetRowsByContentItem(contentItemId);
    return rows.map(toTextAsset);
  } catch (error) {
    if (isRecoverableSetupError(error)) {
      return [];
    }

    throw error;
  }
}

/** Batch load text assets for multiple content items (avoids N+1 in agent context). */
export async function getContentTextAssetsByItemIds(
  contentItemIds: string[],
): Promise<Map<string, TextAsset[]>> {
  const byItemId = new Map<string, TextAsset[]>();

  if (contentItemIds.length === 0 || !hasSupabaseConfig()) {
    return byItemId;
  }

  try {
    const rows = await fetchTextAssetRowsByContentItems(contentItemIds);

    for (const row of rows) {
      const asset = toTextAsset(row);
      const existing = byItemId.get(asset.contentItemId);
      if (existing) {
        existing.push(asset);
      } else {
        byItemId.set(asset.contentItemId, [asset]);
      }
    }

    return byItemId;
  } catch (error) {
    if (isRecoverableSetupError(error)) {
      return byItemId;
    }

    throw error;
  }
}

export async function getContentDetail(contentItemId: string): Promise<ContentDetail | null> {
  if (!hasSupabaseConfig()) {
    return null;
  }

  try {
    const [itemRow, snapshotRows, textRows, insightRow] = await Promise.all([
      fetchContentRowById(contentItemId),
      fetchSnapshotRowsByContentItem(contentItemId),
      fetchTextAssetRowsByContentItem(contentItemId),
      fetchInsightRowOrNull(contentItemId),
    ]);

    if (!itemRow) {
      return null;
    }

    return {
      item: toContentItem(itemRow),
      snapshots: snapshotRows.map(toMetricSnapshot),
      textAssets: textRows.map(toTextAsset),
      insight: insightRow ? toAIInsight(insightRow) : null,
    };
  } catch (error) {
    if (isRecoverableSetupError(error)) {
      return null;
    }

    throw error;
  }
}

async function getDashboardOverviewUncached(
  range: DashboardRange = "all",
  platform: PlatformFilter = "all",
  connectionId?: string | null,
  anchor?: string | null,
): Promise<DashboardOverview> {
  const timer = createServerTimer("dashboard-overview");
  const missingEnv = getMissingEnvKeys();

  if (!hasSupabaseConfig()) {
    timer.finish({ skipped: true, reason: "no-supabase" });
    return emptyOverview(missingEnv, range, platform);
  }

  const setupIssues: string[] = [];
  let activeConnections: PlatformConnection[] = [];
  let availableConnections: PlatformConnection[] = [];
  let selectedConnectionId: string | null = null;

  try {
    timer.start("connections");
    const connectionRows = await fetchConnectionRows({
      includeDisconnected: false,
    });

    activeConnections = connectionRows.map(toPlatformConnection);
    availableConnections =
      platform !== "all"
        ? activeConnections.filter((entry) => entry.platform === platform)
        : [];
    selectedConnectionId = normalizeConnectionSelection(availableConnections, connectionId);
    timer.end("connections", { count: activeConnections.length });
  } catch (error) {
    timer.end("connections", { error: true });
    if (isRecoverableSetupError(error)) {
      appendSetupIssue(setupIssues, DATABASE_SETUP_ISSUE);
    } else {
      timer.finish({ error: true });
      throw error;
    }
  }

  if (
    activeConnections.length === 0 &&
    !hasInstagramLegacyConfig() &&
    setupIssues.length === 0
  ) {
    setupIssues.push("Conecta al menos una cuenta desde Account para habilitar la sincronizacion.");
  }

  let catalog: ContentListItem[] = [];
  let tiktokSnapshotRows: SnapshotRow[] = [];

  try {
    timer.start("catalog");
    const itemRows = await fetchContentRows({
      platform,
      connectionId: selectedConnectionId,
    });

    if (itemRows.length > 0) {
      const contentItemIds = itemRows.map((row) => row.id);
      const [latestSnapshotRows, insightRows, snapshots] = await Promise.all([
        fetchLatestSnapshotRows(contentItemIds),
        fetchInsightRowsOrEmpty(contentItemIds),
        platform === "tiktok" || platform === "all"
          ? fetchSnapshotRows({ contentItemIds })
          : Promise.resolve([] as SnapshotRow[]),
      ]);

      catalog = buildCatalog(itemRows, latestSnapshotRows, insightRows);
      tiktokSnapshotRows = snapshots;
    }
    timer.end("catalog", { itemRows: itemRows.length, catalogRows: catalog.length });
  } catch (error) {
    timer.end("catalog", { error: true });
    if (isRecoverableSetupError(error)) {
      appendSetupIssue(setupIssues, DATABASE_SETUP_ISSUE);
    } else {
      timer.finish({ error: true });
      throw error;
    }
  }

  const allCatalog = filterCatalogByPlatformAndConnection(
    catalog,
    platform,
    selectedConnectionId,
  );
  let allDailyInsightRows = [] as Awaited<ReturnType<typeof fetchPlatformDailyInsightRows>>;
  // Separate fetch without connection filter — always covers all accounts, used for per-account breakdowns.
  let allConnectionsDailyRows = [] as Awaited<ReturnType<typeof fetchPlatformDailyInsightRows>>;

  if (range !== "all") {
    try {
      timer.start("daily");
      const [filtered, allConns] = await Promise.all([
        fetchPlatformDailyInsightRows({ platform, connectionId: selectedConnectionId }),
        selectedConnectionId !== null && selectedConnectionId !== "all"
          ? fetchPlatformDailyInsightRows({ platform, connectionId: null })
          : Promise.resolve([] as Awaited<ReturnType<typeof fetchPlatformDailyInsightRows>>),
      ]);
      allDailyInsightRows = filtered;
      allConnectionsDailyRows =
        selectedConnectionId !== null && selectedConnectionId !== "all" ? allConns : filtered;
      timer.end("daily", {
        filteredRows: allDailyInsightRows.length,
        allConnectionsRows: allConnectionsDailyRows.length,
      });
    } catch (error) {
      timer.end("daily", { error: true });
      if (isRecoverableSetupError(error)) {
        appendSetupIssue(setupIssues, DATABASE_SETUP_ISSUE);
      } else {
        timer.finish({ error: true });
        throw error;
      }
    }
  } else {
    // No bulk daily fetch for range=all; comments phase may load a windowed set.
    timer.start("daily");
    timer.end("daily", { skipped: true, reason: "range-all" });
  }

  const latestDataAnchor = getLatestDashboardAnchor(allCatalog, allDailyInsightRows);
  const isRollingRange = range === "last30" || range === "last60" || range === "last90";
  // For rolling ranges without an explicit URL anchor, always use today-2 as the end date.
  // Using latestDataAnchor would shift the period backwards when a newly-added account
  // has older data (e.g. a second account with posts from April would move 30-day window to March-April).
  const selectedAnchor = isRollingRange && !anchor
    ? null
    : resolveSelectedDashboardAnchor(anchor, latestDataAnchor);
  const filteredCatalog = filterCatalogByRange(allCatalog, range, selectedAnchor);

  const totalViews = filteredCatalog.reduce((sum, item) => {
    return sum + (metricValue(item.latestMetrics, "views", "viewCount", "reach") ?? 0);
  }, 0);
  const totalComments = filteredCatalog.reduce((sum, item) => {
    return sum + (metricValue(item.latestMetrics, "comments") ?? 0);
  }, 0);

  const engagementRates = filteredCatalog
    .map((item) => {
      const views = metricValue(item.latestMetrics, "views", "viewCount", "reach") ?? null;
      const interactions =
        metricValue(item.latestMetrics, "total_interactions") ??
        [
          metricValue(item.latestMetrics, "likes") ?? 0,
          metricValue(item.latestMetrics, "comments") ?? 0,
          metricValue(item.latestMetrics, "shares") ?? 0,
          metricValue(item.latestMetrics, "saves") ?? 0,
        ].reduce((sum, value) => sum + value, 0);

      if (!views || views <= 0) {
        return null;
      }

      return (interactions / views) * 100;
    })
    .filter((value): value is number => value !== null);

  const avgEngagementRate =
    engagementRates.length > 0
      ? engagementRates.reduce((sum, value) => sum + value, 0) / engagementRates.length
      : null;
  const watchTimes = filteredCatalog
    .map((item) => metricValue(item.latestMetrics, "ig_reels_avg_watch_time"))
    .filter((value): value is number => typeof value === "number" && value > 0);
  const avgWatchTimeMs =
    watchTimes.length > 0
      ? watchTimes.reduce((sum, value) => sum + value, 0) / watchTimes.length
      : null;

  // Calcular el rango de fechas del periodo seleccionado
  const rangeBounds = getDashboardRangeBounds(range, selectedAnchor);
  const rangeStartIso = rangeBounds.start ? rangeBounds.start.toISOString().slice(0, 10) : null;
  const rangeEndIso = rangeBounds.end ? rangeBounds.end.toISOString().slice(0, 10) : null;

  let dailyInsightRows = [] as Awaited<ReturnType<typeof fetchPlatformDailyInsightRows>>;
  let commentRows = [] as Awaited<ReturnType<typeof fetchPlatformCommentRows>>;

  try {
    timer.start("comments");
    if (range !== "all") {
      dailyInsightRows = filterDailyInsightRowsByRange(
        allDailyInsightRows,
        rangeStartIso,
        rangeEndIso,
      );
      commentRows = await fetchPlatformCommentRows({
        platform,
        connectionId: selectedConnectionId,
        since: rangeStartIso,
        until: rangeEndIso,
      });
    } else {
      [dailyInsightRows, commentRows] = await Promise.all([
        fetchPlatformDailyInsightRows({
          platform,
          connectionId: selectedConnectionId,
          since: rangeStartIso,
          until: rangeEndIso,
        }),
        fetchPlatformCommentRows({
          platform,
          connectionId: selectedConnectionId,
        }),
      ]);
    }
    timer.end("comments", {
      commentRows: commentRows.length,
      dailyInsightRows: dailyInsightRows.length,
    });
  } catch (error) {
    timer.end("comments", { error: true });
    if (isRecoverableSetupError(error)) {
      appendSetupIssue(setupIssues, DATABASE_SETUP_ISSUE);
    } else {
      timer.finish({ error: true });
      throw error;
    }
  }

  // Ranged dashboards load full daily history above. For range=all, the comments
  // phase loads it. Reuse those rows for every comparison below.
  const comparableDailyInsightRows =
    allDailyInsightRows.length > 0 ? allDailyInsightRows : dailyInsightRows;

  timer.start("series");
  const dailyPerformanceInputs = toDailyPerformanceInput(dailyInsightRows);
  const tiktokSnapshotInputs = buildTikTokSnapshotPerformanceInputs(
    tiktokSnapshotRows,
    filteredCatalog,
  );
  const performanceInputs: DailyPerformanceInput[] =
    platform === "tiktok"
      ? [...dailyPerformanceInputs, ...tiktokSnapshotInputs]
      : platform === "all"
        ? [...dailyPerformanceInputs, ...tiktokSnapshotInputs]
        : dailyPerformanceInputs;
  const suspiciousFollowerCountKeys = buildSuspiciousFollowerCountKeySet(dailyInsightRows);
  performanceInputs.sort((left, right) => left.insightDate.localeCompare(right.insightDate));

  const rangedCommentRows = filterCommentRowsByRange(commentRows, range, selectedAnchor);

  if (rangedCommentRows.length > 0) {
    const commentCounts = new Map<string, number>();
    for (const row of rangedCommentRows) {
      const insightDate = row.commented_at.slice(0, 10);
      const key = `${row.platform}:${row.connection_id ?? "unknown"}:${insightDate}`;
      commentCounts.set(key, (commentCounts.get(key) ?? 0) + 1);
    }

    const existingKeys = new Set<string>();

    for (const input of performanceInputs) {
      const key = `${input.platform}:${input.connectionId}:${input.insightDate}`;
      existingKeys.add(key);

      const comments = commentCounts.get(key);

      if (typeof comments === "number") {
        input.metrics.comments = comments;
      }
    }

    for (const [key, comments] of commentCounts.entries()) {
      if (existingKeys.has(key)) {
        continue;
      }

      const [metricPlatform, metricConnectionId, insightDate] = key.split(":");
      performanceInputs.push({
        insightDate,
        platform: metricPlatform as Platform,
        connectionId: metricConnectionId,
        metrics: {
          comments,
        },
      });
    }

    performanceInputs.sort((left, right) => left.insightDate.localeCompare(right.insightDate));
  }

  const rawPerformance = buildDashboardPerformanceFromDailyInsights(
    performanceInputs,
    range,
    selectedAnchor,
  );
  const recentComments = rangedCommentRows.slice(0, 8).map(toPlatformComment);

  const catalogTotals = getCatalogMetricTotals(filteredCatalog);
  const hasObservedPerformance = rawPerformance.series.some((point) => point.hasObservedData);
  const displayTotalViews = totalViews > 0 ? totalViews : catalogTotals.views;
  const displayTotalComments = totalComments > 0 ? totalComments : catalogTotals.comments;

  const breakdownCatalog = filteredCatalog;
  const topContentCatalog = filteredCatalog;

  const platformBreakdown =
    platform === "all"
      ? (["instagram", "tiktok", "youtube"] as Platform[]).map((currentPlatform) => ({
          platform: currentPlatform,
          count: breakdownCatalog.filter((item) => item.platform === currentPlatform).length,
        }))
      : [
          {
            platform,
            count: breakdownCatalog.length,
          },
        ];

  let followersLostCount: number | null = null;
  const performanceTotals = (() => {
    const next = createNullableDashboardMetricRecord(null);

    for (const [metricKey, value] of Object.entries(rawPerformance.totals)) {
      next[metricKey as keyof typeof next] = typeof value === "number" ? value : null;
    }

    const fallbackTotals = {
      views: displayTotalViews,
      reach: catalogTotals.reach,
      likes: catalogTotals.likes,
      comments: displayTotalComments,
      shares: catalogTotals.shares,
      saves: catalogTotals.saves,
      profileVisits: catalogTotals.profileVisits,
      linkClicks: catalogTotals.linkClicks,
      follows: catalogTotals.follows,
      contentInteractions: catalogTotals.contentInteractions,
    };

    for (const [metricKey, value] of Object.entries(fallbackTotals)) {
      if (typeof value !== "number" || Number.isNaN(value)) {
        continue;
      }
      if (metricKey === "follows" && value <= 0) {
        continue;
      }
      const key = metricKey as keyof typeof next;
      if (next[key] === null || next[key] === 0) {
        next[key] = value;
      }
    }

    // --- Sobrescribir con totales directos de platform_daily_insights (fuente de verdad) ---
    // Sumar columnas del periodo ya filtrado por rango y conexión
    const insightSums = dailyInsightRows.reduce(
      (acc, row) => ({
        saves:               acc.saves               + (row.saves                ?? 0),
        likes:               acc.likes               + (row.likes                ?? 0),
        comments:            acc.comments            + (row.comments             ?? 0),
        shares:              acc.shares              + (row.shares               ?? 0),
        follows:             acc.follows             + (row.follows              ?? 0),
        contentInteractions: acc.contentInteractions + (row.content_interactions ?? 0),
      }),
      { saves: 0, likes: 0, comments: 0, shares: 0, follows: 0, contentInteractions: 0 },
    );

    if (insightSums.saves               > 0) next.saves               = insightSums.saves;
    if (insightSums.likes               > 0) next.likes               = insightSums.likes;
    if (insightSums.comments            > 0) next.comments            = insightSums.comments;
    if (insightSums.shares              > 0) next.shares              = insightSums.shares;
    if (insightSums.contentInteractions > 0) next.contentInteractions = insightSums.contentInteractions;
    // follows NO se sobreescribe desde insightSums: row.follows tiene el cambio NETO
    // (follows_and_unfollows = ganados - perdidos), mientras que rawPerformance.totals.follows
    // ya suma follower_count diario (nuevos seguidores/día) que es el número correcto.

    // Seguidores perdidos: suma de deltas negativos de follower_count (para la card roja)
    let seriesLost = 0;
    for (const point of rawPerformance.series) {
      if (!point.observedMetrics.includes("follows")) continue;
      const val = point.metrics.follows ?? 0;
      if (val < 0) seriesLost += Math.abs(val);
    }
    followersLostCount = seriesLost > 0 ? seriesLost : null;

    // Seguidores ganados: rawPerformance.totals.follows ya tiene la suma de follower_count diario
    // (nuevos seguidores por día). follows_and_unfollows da cambio NETO (ganados - perdidos)
    // que es menor y no es lo que queremos mostrar. Solo aplicar guard contra negativos.
    if (typeof next.follows === "number" && next.follows < 0) {
      next.follows = null;
    }

    const derived = computeDerivedMetrics(next, { publishedItems: breakdownCatalog.length });
    for (const [metricKey, value] of Object.entries(derived)) {
      next[metricKey as keyof typeof next] = typeof value === "number" ? value : null;
    }

    // Guardia final: follows nunca puede ser negativo (es "seguidores ganados", no neto)
    if (typeof next.follows === "number" && next.follows < 0) {
      next.follows = null;
    }

    return next;
  })();
  const catalogPerformanceSeries = buildCatalogPerformanceSeries(topContentCatalog);
  const sourcePerformanceSeries =
    hasObservedPerformance || catalogPerformanceSeries.length === 0
      ? rawPerformance.series
      : catalogPerformanceSeries;
  const performanceSeries = sourcePerformanceSeries.map((point) => {
    const bucketStartMs = new Date(point.bucketStart).getTime();
    const bucketEndMs = new Date(point.bucketEnd).getTime();

    const bucketInputs = performanceInputs.filter((input) => {
      const insightTime = new Date(`${input.insightDate}T00:00:00.000Z`).getTime();
      return insightTime >= bucketStartMs && insightTime <= bucketEndMs;
    });
    const publishedItems = bucketInputs.length;

    const bucketCatalogItems = topContentCatalog.filter((item) => {
      const publishedAtMs = new Date(item.publishedAt).getTime();
      return publishedAtMs >= bucketStartMs && publishedAtMs <= bucketEndMs;
    });
    const bucketCatalogTotals = getCatalogMetricTotals(bucketCatalogItems);

    const metrics = { ...point.metrics };
    const observedMetrics = new Set(point.observedMetrics);

    const catalogFallbackMetrics: Partial<CatalogMetricTotals> = {
      views: bucketCatalogTotals.views,
      reach: bucketCatalogTotals.reach,
      likes: bucketCatalogTotals.likes,
      comments: bucketCatalogTotals.comments,
      shares: bucketCatalogTotals.shares,
      saves: bucketCatalogTotals.saves,
      profileVisits: bucketCatalogTotals.profileVisits,
      linkClicks: bucketCatalogTotals.linkClicks,
      follows: bucketCatalogTotals.follows,
      contentInteractions: bucketCatalogTotals.contentInteractions,
    };

    for (const [metricKey, value] of Object.entries(catalogFallbackMetrics)) {
      if (typeof value !== "number" || value <= 0) {
        continue;
      }

      const mKey = metricKey as keyof typeof metrics;
      if (!observedMetrics.has(mKey)) {
        metrics[mKey] = value as never;
        observedMetrics.add(mKey);
      } else {
        const existing = metrics[mKey] as number;
        if (value > existing) {
          metrics[mKey] = value as never;
        }
      }
    }

    const latestFollowerCountByConnection = new Map<
      string,
      { insightDate: string; value: number }
    >();
    for (const input of bucketInputs) {
      const followerCount = input.metrics.followerCount;
      if (typeof followerCount !== "number" || !Number.isFinite(followerCount)) {
        continue;
      }

      const rowKey = `${input.platform}:${input.connectionId}:${input.insightDate}`;
      if (suspiciousFollowerCountKeys.has(rowKey)) {
        continue;
      }

      const connectionKey = `${input.platform}:${input.connectionId}`;
      const previous = latestFollowerCountByConnection.get(connectionKey);
      if (!previous || input.insightDate > previous.insightDate) {
        latestFollowerCountByConnection.set(connectionKey, {
          insightDate: input.insightDate,
          value: followerCount,
        });
      }
    }
    if (latestFollowerCountByConnection.size > 0) {
      metrics.followerCount = [...latestFollowerCountByConnection.values()].reduce(
        (sum, value) => sum + value.value,
        0,
      );
      observedMetrics.add("followerCount");
    } else {
      metrics.followerCount = 0;
      observedMetrics.delete("followerCount");
    }

    const derived = computeDerivedMetrics(metrics, { publishedItems });
    for (const [metricKey, value] of Object.entries(derived)) {
      if (typeof value !== "number" || Number.isNaN(value)) {
        continue;
      }
      metrics[metricKey as keyof typeof metrics] = value as never;
      observedMetrics.add(metricKey as keyof typeof metrics);
    }

    return {
      ...point,
      hasObservedData: observedMetrics.size > 0,
      observedMetrics: [...observedMetrics],
      metrics,
    };
  });
  const lastStableFollowerPoint =
    [...performanceSeries]
      .reverse()
      .find(
        (point) => point.observedMetrics.includes("followerCount") && !point.isPending,
      ) ??
    [...performanceSeries]
      .reverse()
      .find((point) => point.observedMetrics.includes("followerCount")) ??
    null;
  performanceTotals.followerCount = lastStableFollowerPoint
    ? lastStableFollowerPoint.metrics.followerCount
    : null;
  const observedCommentPoints = performanceSeries.filter((point) =>
    point.observedMetrics.includes("comments"),
  );
  if (observedCommentPoints.length > 0) {
    performanceTotals.comments = observedCommentPoints.reduce(
      (sum, point) => sum + point.metrics.comments,
      0,
    );
  }
  const observedFollowsPoints = performanceSeries.filter((point) =>
    point.observedMetrics.includes("follows"),
  );
  if (observedFollowsPoints.length > 0) {
    performanceTotals.follows = observedFollowsPoints.reduce(
      (sum, point) => sum + point.metrics.follows,
      0,
    );
  }
  const performanceAvailability =
    !hasObservedPerformance && catalogPerformanceSeries.length > 0
      ? {
          status: "partial" as const,
          message: "Mostrando metricas disponibles del contenido sincronizado.",
        }
      : rawPerformance.availability;

  let monthPerformanceTotals = performanceTotals;
  if (range !== "month") {
    const monthBounds = getDashboardRangeBounds("month", selectedAnchor);
    const monthStartIso = monthBounds.start ? monthBounds.start.toISOString().slice(0, 10) : null;
    const monthEndIso = monthBounds.end ? monthBounds.end.toISOString().slice(0, 10) : null;
    const monthCatalog = filterCatalogByRange(allCatalog, "month", selectedAnchor);

    const monthDailyInsightRows = filterDailyInsightRowsByRange(
      comparableDailyInsightRows,
      monthStartIso,
      monthEndIso,
    );
    monthPerformanceTotals = buildMonthPerformanceTotals(monthDailyInsightRows, monthCatalog);
  }

  // Previous month totals for MoM comparison
  let previousMonthTotals: DashboardOverview["previousMonthTotals"] = createNullableDashboardMetricRecord(null);
  const prevMonthAnchor = getDashboardPreviousAnchor("month", selectedAnchor);
  const prevMonthBounds = getDashboardRangeBounds("month", prevMonthAnchor);
  const prevMonthStartIso = prevMonthBounds.start ? prevMonthBounds.start.toISOString().slice(0, 10) : null;
  const prevMonthEndIso = prevMonthBounds.end ? prevMonthBounds.end.toISOString().slice(0, 10) : null;
  const prevMonthCatalog = filterCatalogByRange(allCatalog, "month", prevMonthAnchor);

  try {
    const prevMonthDailyInsightRows = filterDailyInsightRowsByRange(
      comparableDailyInsightRows,
      prevMonthStartIso,
      prevMonthEndIso,
    );

    // Sum base metrics directly from daily insight rows
    previousMonthTotals = createNullableDashboardMetricRecord(null);
    for (const row of prevMonthDailyInsightRows) {
      if (typeof row.views === "number" && Number.isFinite(row.views)) {
        previousMonthTotals.views = (previousMonthTotals.views ?? 0) + row.views;
      }
      if (typeof row.reach === "number" && Number.isFinite(row.reach)) {
        previousMonthTotals.reach = (previousMonthTotals.reach ?? 0) + row.reach;
      }
      if (typeof row.likes === "number" && Number.isFinite(row.likes)) {
        previousMonthTotals.likes = (previousMonthTotals.likes ?? 0) + row.likes;
      }
      if (typeof row.comments === "number" && Number.isFinite(row.comments)) {
        previousMonthTotals.comments = (previousMonthTotals.comments ?? 0) + row.comments;
      }
      if (typeof row.shares === "number" && Number.isFinite(row.shares)) {
        previousMonthTotals.shares = (previousMonthTotals.shares ?? 0) + row.shares;
      }
      if (typeof row.saves === "number" && Number.isFinite(row.saves)) {
        previousMonthTotals.saves = (previousMonthTotals.saves ?? 0) + row.saves;
      }
      if (typeof row.content_interactions === "number" && Number.isFinite(row.content_interactions)) {
        previousMonthTotals.contentInteractions = (previousMonthTotals.contentInteractions ?? 0) + row.content_interactions;
      }
      if (typeof row.profile_visits === "number" && Number.isFinite(row.profile_visits)) {
        previousMonthTotals.profileVisits = (previousMonthTotals.profileVisits ?? 0) + row.profile_visits;
      }
      if (typeof row.link_clicks === "number" && Number.isFinite(row.link_clicks)) {
        previousMonthTotals.linkClicks = (previousMonthTotals.linkClicks ?? 0) + row.link_clicks;
      }
      if (typeof row.follows === "number" && Number.isFinite(row.follows)) {
        previousMonthTotals.follows = (previousMonthTotals.follows ?? 0) + row.follows;
      }
      if (typeof row.watch_time_minutes === "number" && Number.isFinite(row.watch_time_minutes)) {
        previousMonthTotals.watchTimeMinutes = (previousMonthTotals.watchTimeMinutes ?? 0) + row.watch_time_minutes;
      }
      if (typeof row.subscribers_gained === "number" && Number.isFinite(row.subscribers_gained)) {
        previousMonthTotals.subscribersGained = (previousMonthTotals.subscribersGained ?? 0) + row.subscribers_gained;
      }
      if (typeof row.subscribers_lost === "number" && Number.isFinite(row.subscribers_lost)) {
        previousMonthTotals.subscribersLost = (previousMonthTotals.subscribersLost ?? 0) + row.subscribers_lost;
      }
    }

    // followerCount: last observed value from the month
    const followerRows = prevMonthDailyInsightRows
      .filter((r) => typeof r.follower_count === "number" && Number.isFinite(r.follower_count))
      .sort((a, b) => a.insight_date.localeCompare(b.insight_date));
    if (followerRows.length > 0) {
      previousMonthTotals.followerCount = followerRows[followerRows.length - 1]!.follower_count;
    }

    // Fallback: use catalog totals for missing metrics
    const prevMonthCatalogTotals = getCatalogMetricTotals(prevMonthCatalog);
    for (const metricKey of DASHBOARD_METRIC_KEYS) {
      if (previousMonthTotals[metricKey] === null || previousMonthTotals[metricKey] === 0) {
        const catalogValue = prevMonthCatalogTotals[metricKey as keyof typeof prevMonthCatalogTotals];
        if (typeof catalogValue === "number" && catalogValue > 0) {
          previousMonthTotals[metricKey] = catalogValue;
        }
      }
    }

    // Compute derived metrics
    const prevMonthDerived = computeDerivedMetrics(previousMonthTotals, {
      publishedItems: prevMonthCatalog.length,
    });
    for (const [metricKey, value] of Object.entries(prevMonthDerived)) {
      previousMonthTotals[metricKey as keyof typeof previousMonthTotals] =
        typeof value === "number" ? value : null;
    }
  } catch (error) {
    if (isRecoverableSetupError(error)) {
      appendSetupIssue(setupIssues, DATABASE_SETUP_ISSUE);
    }
    // Silently fail — MoM comparison won't show
  }

  // Previous period totals for comparison
  let previousPeriodTotals: DashboardOverview["previousPeriodTotals"] = createNullableDashboardMetricRecord(null);
  if (range !== "all") {
    const previousAnchor = getDashboardPreviousAnchor(range, selectedAnchor);
    const prevBounds = getDashboardRangeBounds(range, previousAnchor);
    const prevStartIso = prevBounds.start ? prevBounds.start.toISOString().slice(0, 10) : null;
    const prevEndIso = prevBounds.end ? prevBounds.end.toISOString().slice(0, 10) : null;
    const prevCatalog = filterCatalogByRange(allCatalog, range, previousAnchor);

    try {
      const prevDailyInsightRows = filterDailyInsightRowsByRange(
        comparableDailyInsightRows,
        prevStartIso,
        prevEndIso,
      );

      const prevInputs: DailyPerformanceInput[] = prevDailyInsightRows.map((row) => ({
        insightDate: row.insight_date,
        platform: row.platform as Platform,
        connectionId: row.connection_id ?? "unknown",
        metrics: {
          views: row.views,
          impressions: row.impressions,
          likes: row.likes,
          comments: row.comments,
          shares: row.shares,
          saves: row.saves,
          reach: row.reach,
          contentInteractions: row.content_interactions,
          profileVisits: row.profile_visits,
          linkClicks: row.link_clicks,
          follows: row.follows,
          watchTimeMinutes: row.watch_time_minutes,
          averageViewDurationSeconds: row.average_view_duration_seconds,
          subscribersGained: row.subscribers_gained,
          subscribersLost: row.subscribers_lost,
          followerCount: row.follower_count,
        },
      }));

      const prevPerformance = buildDashboardPerformanceFromDailyInsights(
        prevInputs,
        range,
        previousAnchor,
      );

      // Compute totals from previous period series
      previousPeriodTotals = createNullableDashboardMetricRecord(null);
      const prevSeries = prevPerformance.series;
      const prevHasObserved = prevSeries.some((p) => p.hasObservedData);

      if (prevHasObserved) {
        for (const metricKey of DASHBOARD_METRIC_KEYS) {
          const observedPoints = prevSeries.filter((p) =>
            p.observedMetrics.includes(metricKey),
          );
          if (observedPoints.length > 0) {
            const sum = observedPoints.reduce(
              (acc, p) => acc + (p.metrics[metricKey as keyof typeof p.metrics] ?? 0),
              0,
            );
            previousPeriodTotals[metricKey] = sum;
          }
        }

        // followerCount: last observed value
        const prevFollowerPoints = [...prevSeries]
          .reverse()
          .filter((p) => p.observedMetrics.includes("followerCount"));
        if (prevFollowerPoints.length > 0) {
          previousPeriodTotals.followerCount =
            prevFollowerPoints[0]!.metrics.followerCount;
        }
      }

      // Fallback: use catalog totals for missing metrics
      const prevCatalogTotals = getCatalogMetricTotals(prevCatalog);
      for (const metricKey of DASHBOARD_METRIC_KEYS) {
        if (previousPeriodTotals[metricKey] === null || previousPeriodTotals[metricKey] === 0) {
          const catalogValue = prevCatalogTotals[metricKey as keyof typeof prevCatalogTotals];
          if (typeof catalogValue === "number" && catalogValue > 0) {
            previousPeriodTotals[metricKey] = catalogValue;
          }
        }
      }

      // Compute derived metrics
      const prevDerived = computeDerivedMetrics(previousPeriodTotals, {
        publishedItems: prevCatalog.length,
      });
      for (const [metricKey, value] of Object.entries(prevDerived)) {
        previousPeriodTotals[metricKey as keyof typeof previousPeriodTotals] =
          typeof value === "number" ? value : null;
      }
    } catch (error) {
      if (isRecoverableSetupError(error)) {
        appendSetupIssue(setupIssues, DATABASE_SETUP_ISSUE);
      }
      // Silently fail — comparison arrows won't show
    }
  }

  timer.end("series", {
    seriesPoints: performanceSeries.length,
    filteredCatalogRows: filteredCatalog.length,
  });

  timer.finish({
    range,
    platform,
    connections: activeConnections.length,
    catalogRows: allCatalog.length,
    filteredCatalogRows: filteredCatalog.length,
    dailyRows: allDailyInsightRows.length,
    commentRows: commentRows.length,
    seriesPoints: performanceSeries.length,
  });

  return {
    configured:
      missingEnv.length === 0 &&
      setupIssues.length === 0 &&
      (activeConnections.length > 0 || hasInstagramLegacyConfig()),
    missingEnv,
    setupIssues,
    generatedAt: new Date().toISOString(),
    selectedRange: range,
    selectedPlatform: platform,
    selectedConnectionId,
    selectedAnchor,
    latestDataAnchor,
    availableConnections,
    allTimePublishedItems: allCatalog.length,
    totals: {
      publishedItems: breakdownCatalog.length,
      analyzedItems: breakdownCatalog.filter(
        (item) => item.latestInsight || item.analysisStatus === "ready" || item.analysisStatus === "fallback",
      ).length,
      totalViews: displayTotalViews,
      totalComments: displayTotalComments,
      avgEngagementRate,
      avgWatchTimeMs,
    },
    performanceTotals,
    monthPerformanceTotals,
    previousPeriodTotals,
    previousMonthTotals,
    performanceAvailability,
    platformBreakdown,
    performanceSeries,
    topContent: topContentCatalog,
    recentComments,
    lastSyncRuns: [],
    followersLost: followersLostCount,
    connectionViewTotals: filterDailyInsightRowsByRange(allConnectionsDailyRows, rangeStartIso, rangeEndIso)
      .reduce<Array<{ connectionId: string; views: number }>>(
        (acc, row) => {
          const views = row.views ?? row.impressions ?? 0;
          if (!views) return acc;
          const entry = acc.find((e) => e.connectionId === row.connection_id);
          if (entry) { entry.views += views; } else { acc.push({ connectionId: row.connection_id, views }); }
          return acc;
        },
        [],
      ),
  };
}

/**
 * Redis short-TTL cache (fail-open) around the expensive overview load.
 * Key embeds `dashboard:gen` so a successful sync invalidates without SCAN/DEL.
 * React `cache()` still dedupes identical loads within a single RSC/request tree.
 */
async function getDashboardOverviewCached(
  range: DashboardRange = "all",
  platform: PlatformFilter = "all",
  connectionId?: string | null,
  anchor?: string | null,
): Promise<DashboardOverview> {
  const gen = await getDashboardCacheGeneration();
  const cacheKey = buildDashboardOverviewCacheKey({
    gen,
    range,
    platform,
    connectionId,
    anchor,
  });

  const hit = await getCachedJson<DashboardOverview>(cacheKey);
  if (hit) {
    return hit;
  }

  const overview = await getDashboardOverviewUncached(
    range,
    platform,
    connectionId,
    anchor,
  );

  after(() => setCachedJson(cacheKey, overview, DASHBOARD_OVERVIEW_TTL_SECONDS));
  return overview;
}

export const getDashboardOverview = cache(getDashboardOverviewCached);

function buildCompetitionAnalysisDetail(
  runId: string,
  runRows: Awaited<ReturnType<typeof fetchCompetitorAnalysisRunRows>>,
  profileRows: Awaited<ReturnType<typeof fetchCompetitorProfileRows>>,
  snapshotRows: Awaited<ReturnType<typeof fetchCompetitorContentSnapshotRows>>,
): CompetitionAnalysisDetail | null {
  const runRow = runRows.find((entry) => entry.id === runId);

  if (!runRow) {
    return null;
  }

  const profileRow = profileRows.find((entry) => entry.id === runRow.profile_id);

  if (!profileRow) {
    return null;
  }

  const profile = toCompetitorProfile(profileRow);
  const run = toCompetitorAnalysisRun(runRow);
  const posts = snapshotRows.map(toCompetitorContentSnapshot);

  return {
    run,
    profile,
    posts,
    aggregates30d: buildCompetitionWindowAggregate(posts),
    topByViews: getTopCompetitorPostsByViews(posts),
    topByComments: getTopCompetitorPostsByComments(posts),
    report: toCompetitorAnalysisReport(run.reportPayload),
  };
}

export async function getCompetitionSetupIssues() {
  if (!hasSupabaseConfig()) {
    return [];
  }

  try {
    await fetchCompetitorAnalysisRunRows(1);
    return [];
  } catch (error) {
    if (isRecoverableSetupError(error)) {
      return [DATABASE_SETUP_ISSUE];
    }

    if (isTransientSupabaseError(error)) {
      return [SUPABASE_UNAVAILABLE_ISSUE];
    }

    throw error;
  }
}

export async function getAutomationSetupIssues() {
  if (!hasSupabaseConfig()) {
    return [];
  }

  try {
    await fetchAutomationRunRows(1);
    await fetchAutomationRunItemRows("00000000-0000-0000-0000-000000000000");
    return [];
  } catch (error) {
    if (isRecoverableSetupError(error)) {
      return [DATABASE_SETUP_ISSUE];
    }

    if (isTransientSupabaseError(error)) {
      return [SUPABASE_UNAVAILABLE_ISSUE];
    }

    throw error;
  }
}

export async function listAutomationRuns(limit = 20, type?: AutomationType) {
  if (!hasSupabaseConfig()) {
    return [];
  }

  try {
    return (await fetchAutomationRunRows(limit, type ? { type } : undefined)).map(toAutomationRun);
  } catch (error) {
    if (isRecoverableSetupError(error) || isTransientSupabaseError(error)) {
      return [];
    }

    throw error;
  }
}

export async function getAutomationRunDetail(runId: string): Promise<AutomationRunDetail | null> {
  if (!hasSupabaseConfig()) {
    return null;
  }

  try {
    const runRow = await fetchAutomationRunRow(runId);

    if (!runRow) {
      return null;
    }

    const outputRows = await fetchAutomationOutputRows(runId);
    let itemRows: Awaited<ReturnType<typeof fetchAutomationRunItemRows>> = [];

    try {
      itemRows = await fetchAutomationRunItemRows(runId);
    } catch (error) {
      if (!isRecoverableSetupError(error) && !isTransientSupabaseError(error)) {
        throw error;
      }
    }

    return {
      run: toAutomationRun(runRow),
      outputs: outputRows.map(toAutomationOutput),
      items: itemRows.map(toAutomationRunItem),
    };
  } catch (error) {
    if (isRecoverableSetupError(error) || isTransientSupabaseError(error)) {
      return null;
    }

    throw error;
  }
}

export async function listCompetitorAnalysisRuns(limit = 10): Promise<CompetitorAnalysisHistoryItem[]> {
  if (!hasSupabaseConfig()) {
    return [];
  }

  try {
    const runRows = await fetchCompetitorAnalysisRunRows(limit);

    if (runRows.length === 0) {
      return [];
    }

    const profileRows = await fetchCompetitorProfileRows(runRows.map((row) => row.profile_id));
    const profileMap = new Map(profileRows.map((row) => [row.id, row] as const));

    return runRows.flatMap((runRow) => {
      const profileRow = profileMap.get(runRow.profile_id);
      return profileRow ? [toCompetitorAnalysisHistoryItem(runRow, profileRow)] : [];
    });
  } catch (error) {
    if (isRecoverableSetupError(error) || isTransientSupabaseError(error)) {
      return [];
    }

    throw error;
  }
}

export async function getCompetitorAnalysisDetail(runId: string): Promise<CompetitionAnalysisDetail | null> {
  if (!hasSupabaseConfig()) {
    return null;
  }

  try {
    const runRow = await fetchCompetitorAnalysisRunRow(runId);

    if (!runRow) {
      return null;
    }

    const [profileRow, snapshotRows] = await Promise.all([
      fetchCompetitorProfileById(runRow.profile_id),
      fetchCompetitorContentSnapshotRows(runId),
    ]);

    if (!profileRow) {
      return null;
    }

    return buildCompetitionAnalysisDetail(runId, [runRow], [profileRow], snapshotRows);
  } catch (error) {
    if (isRecoverableSetupError(error) || isTransientSupabaseError(error)) {
      return null;
    }

    throw error;
  }
}

async function listContentLibraryUncached(filters?: ContentCatalogFilters): Promise<ContentLibraryItem[]> {
  if (!hasSupabaseConfig()) {
    return [];
  }

  try {
    const itemRows = await fetchContentLibraryRows(filters);
    if (itemRows.length === 0) {
      return [];
    }

    const contentItemIds = itemRows.map((row) => row.id);
    const [snapshotRows, insightRows] = await Promise.all([
      fetchLatestContentLibrarySnapshotRows(contentItemIds),
      fetchContentLibraryInsightIds(contentItemIds),
    ]);
    const metricsByContentId = new Map(
      snapshotRows.map((row) => [row.content_item_id, row.metrics ?? {}] as const),
    );
    const insightIds = new Set(insightRows.map((row) => row.content_item_id));

    return itemRows.map((row) => ({
      id: row.id,
      platform: row.platform,
      connectionId: row.connection_id,
      publishedAt: row.published_at,
      title: row.title,
      caption: row.caption,
      thumbnailUrl: row.thumbnail_url,
      analysisStatus: row.analysis_status,
      analysisProcessingStartedAt: row.analysis_processing_started_at ?? null,
      rawPayload: row.raw_payload ?? {},
      latestMetrics: metricsByContentId.get(row.id) ?? {},
      hasInsight: insightIds.has(row.id),
    }));
  } catch (error) {
    if (isRecoverableSetupError(error)) {
      return [];
    }
    throw error;
  }
}

async function listContentCatalogCached(filters?: ContentCatalogFilters) {
  const gen = await getDashboardCacheGeneration();
  const cacheKey = buildContentCatalogCacheKey({ gen, ...filters });
  const hit = await getCachedJson<ContentListItem[]>(cacheKey);
  if (hit) {
    return hit;
  }

  const catalog = await listContentCatalogUncached(filters);
  after(() => setCachedJson(cacheKey, catalog, CONTENT_CATALOG_TTL_SECONDS));
  return catalog;
}

export const listContentCatalog = cache(listContentCatalogCached);

async function listContentLibraryCached(filters?: ContentCatalogFilters) {
  const gen = await getDashboardCacheGeneration();
  const cacheKey = buildContentLibraryCacheKey({ gen, ...filters });
  const hit = await getCachedJson<ContentLibraryItem[]>(cacheKey);
  if (hit) {
    return hit;
  }

  const items = await listContentLibraryUncached(filters);
  after(() => setCachedJson(cacheKey, items, CONTENT_CATALOG_TTL_SECONDS));
  return items;
}

export const listContentLibrary = cache(listContentLibraryCached);
