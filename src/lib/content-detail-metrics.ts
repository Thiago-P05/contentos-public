import {
  computeDerivedMetrics,
  createNullableDashboardMetricRecord,
} from "@/lib/dashboard-metrics";
import { formatCompactNumber, formatMilliseconds, formatPercent, formatSeconds } from "@/lib/format";
import type { DashboardTrendMetricKey, MetricMap } from "@/lib/types";

const MAIN_METRIC_CONFIG = [
  {
    key: "views",
    label: "Views",
    aliases: ["views", "viewCount", "view_count", "video_views", "play_count", "reach"],
  },
  {
    key: "likes",
    label: "Likes",
    aliases: ["likes", "likeCount", "like_count"],
  },
  {
    key: "comments",
    label: "Comments",
    aliases: ["comments", "commentCount", "comment_count"],
  },
  {
    key: "shares",
    label: "Shares",
    aliases: ["shares", "shareCount", "share_count"],
  },
  {
    key: "saves",
    label: "Saves",
    aliases: ["saves", "saved", "save_count", "saved_count"],
  },
] as const;

type MetricGroupKey = "performance" | "retention" | "rates";

export type ContentDetailMetricCard = {
  key: string;
  label: string;
  value: number | null;
  formattedValue: string;
};

export type ContentDetailMetricGroup = {
  key: MetricGroupKey;
  label: string;
  cards: ContentDetailMetricCard[];
};

function getMetricByAliases(metrics: MetricMap, aliases: readonly string[]) {
  for (const alias of aliases) {
    const value = metrics[alias];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

function formatContentMetricValue(key: string, value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "--";
  }

  if (
    key === "engagementRate" ||
    key === "commentRate" ||
    key === "shareRate" ||
    key === "saveRate" ||
    key === "skipRate" ||
    key === "impressionsClickThroughRate" ||
    key === "averageViewPercentage"
  ) {
    return formatPercent(value);
  }

  if (key === "averageViewDurationSeconds") {
    return formatSeconds(value);
  }

  if (key === "watchTimeMinutes") {
    return `${formatCompactNumber(value)} min`;
  }

  if (
    key === "avgWatchTimeMs" ||
    key === "totalWatchTimeMs"
  ) {
    return formatMilliseconds(value);
  }

  return formatCompactNumber(value);
}

function toDashboardMetricRecord(metrics: MetricMap) {
  const record = createNullableDashboardMetricRecord(null);
  record.views = getMetricByAliases(metrics, MAIN_METRIC_CONFIG[0].aliases);
  record.reach = getMetricByAliases(metrics, ["reach"]);
  record.likes = getMetricByAliases(metrics, MAIN_METRIC_CONFIG[1].aliases);
  record.comments = getMetricByAliases(metrics, MAIN_METRIC_CONFIG[2].aliases);
  record.shares = getMetricByAliases(metrics, MAIN_METRIC_CONFIG[3].aliases);
  record.saves = getMetricByAliases(metrics, MAIN_METRIC_CONFIG[4].aliases);
  record.profileVisits = getMetricByAliases(metrics, ["profileVisits", "profile_views"]);
  record.linkClicks = getMetricByAliases(metrics, [
    "linkClicks",
    "link_clicks",
    "website_clicks",
    "profile_links_taps",
  ]);
  record.contentInteractions =
    getMetricByAliases(metrics, ["contentInteractions", "total_interactions"]) ??
    [record.likes, record.comments, record.shares, record.saves].reduce(
      (sum: number, value) => sum + (typeof value === "number" ? value : 0),
      0,
    );
  record.avgWatchTimeMs = getMetricByAliases(metrics, [
    "ig_reels_avg_watch_time",
    "avg_watch_time",
  ]);
  record.skipRate = getMetricByAliases(metrics, ["reels_skip_rate", "skip_rate"]);

  return record;
}

function buildMetricCard(
  key: string,
  label: string,
  value: number | null,
): ContentDetailMetricCard | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }

  return {
    key,
    label,
    value,
    formattedValue: formatContentMetricValue(key, value),
  };
}

function buildGroup(
  key: MetricGroupKey,
  label: string,
  items: Array<ContentDetailMetricCard | null>,
): ContentDetailMetricGroup | null {
  const cards = items.filter((item): item is ContentDetailMetricCard => item !== null);

  if (cards.length === 0) {
    return null;
  }

  return {
    key,
    label,
    cards,
  };
}

export function buildMainMetricCards(metrics: MetricMap) {
  return MAIN_METRIC_CONFIG.map((config) => {
    const value = getMetricByAliases(metrics, config.aliases) ?? 0;
    return {
      key: config.key,
      label: config.label,
      value,
    };
  });
}

export function buildSecondaryMetricGroups(metrics: MetricMap) {
  const dashboardMetrics = toDashboardMetricRecord(metrics);
  const derived = computeDerivedMetrics(dashboardMetrics) as Partial<
    Record<DashboardTrendMetricKey, number | null>
  >;

  return [
    buildGroup("performance", "Performance", [
      buildMetricCard("reach", "Reach", dashboardMetrics.reach),
      buildMetricCard("contentInteractions", "Interacciones", dashboardMetrics.contentInteractions),
      buildMetricCard("profileVisits", "Visitas perfil", dashboardMetrics.profileVisits),
      buildMetricCard("linkClicks", "Clics link", dashboardMetrics.linkClicks),
      buildMetricCard("impressions", "Impresiones", getMetricByAliases(metrics, ["impressions"])),
      buildMetricCard(
        "subscribersGained",
        "Suscriptores ganados",
        getMetricByAliases(metrics, ["subscribersGained"]),
      ),
    ]),
    buildGroup("retention", "Retencion", [
      buildMetricCard("avgWatchTimeMs", "Tiempo promedio visto", dashboardMetrics.avgWatchTimeMs),
      buildMetricCard(
        "totalWatchTimeMs",
        "Tiempo total visto",
        getMetricByAliases(metrics, ["ig_reels_video_view_total_time"]),
      ),
      buildMetricCard("skipRate", "Omision", dashboardMetrics.skipRate),
      buildMetricCard(
        "averageViewDurationSeconds",
        "Duracion media",
        getMetricByAliases(metrics, ["averageViewDurationSeconds"]),
      ),
      buildMetricCard(
        "averageViewPercentage",
        "Porcentaje visto",
        getMetricByAliases(metrics, ["averageViewPercentage"]),
      ),
      buildMetricCard(
        "watchTimeMinutes",
        "Tiempo visto",
        getMetricByAliases(metrics, ["watchTimeMinutes"]),
      ),
    ]),
    buildGroup("rates", "Rates", [
      buildMetricCard("engagementRate", "Engagement rate", derived.engagementRate ?? null),
      buildMetricCard("commentRate", "Comment rate", derived.commentRate ?? null),
      buildMetricCard("shareRate", "Share rate", derived.shareRate ?? null),
      buildMetricCard("saveRate", "Save rate", derived.saveRate ?? null),
      buildMetricCard(
        "impressionsClickThroughRate",
        "CTR impresiones",
        getMetricByAliases(metrics, ["impressionsClickThroughRate"]),
      ),
    ]),
  ].filter((group): group is ContentDetailMetricGroup => group !== null);
}
