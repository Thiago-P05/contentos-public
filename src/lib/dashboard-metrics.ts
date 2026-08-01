import {
  formatCompactNumber,
  formatMilliseconds,
  formatPercent,
  formatSeconds,
} from "@/lib/format";
import type { DashboardTrendMetricKey, Platform } from "@/lib/types";

export type DashboardMetricAggregation = "sum" | "avg" | "derived";
export type DashboardMetricFormat =
  | "compact"
  | "percent"
  | "milliseconds"
  | "seconds"
  | "minutes"
  | "perThousand";

export type DashboardMetricDefinition = {
  key: DashboardTrendMetricKey;
  label: string;
  shortLabel: string;
  color: string;
  aggregation: DashboardMetricAggregation;
  format: DashboardMetricFormat;
};

export const DASHBOARD_METRIC_REGISTRY: Record<
  DashboardTrendMetricKey,
  DashboardMetricDefinition
> = {
  views: {
    key: "views",
    label: "Views",
    shortLabel: "Views",
    color: "var(--series-views)",
    aggregation: "sum",
    format: "compact",
  },
  reach: {
    key: "reach",
    label: "Alcance",
    shortLabel: "Reach",
    color: "var(--series-reach)",
    aggregation: "sum",
    format: "compact",
  },
  contentInteractions: {
    key: "contentInteractions",
    label: "Interacciones",
    shortLabel: "Inter.",
    color: "var(--series-inter)",
    aggregation: "sum",
    format: "compact",
  },
  profileVisits: {
    key: "profileVisits",
    label: "Visitas perfil",
    shortLabel: "Perfil",
    color: "var(--series-profile)",
    aggregation: "sum",
    format: "compact",
  },
  linkClicks: {
    key: "linkClicks",
    label: "Clics link",
    shortLabel: "Clicks",
    color: "var(--series-links)",
    aggregation: "sum",
    format: "compact",
  },
  follows: {
    key: "follows",
    label: "Follows",
    shortLabel: "Follows",
    color: "var(--series-follows)",
    aggregation: "sum",
    format: "compact",
  },
  followerCount: {
    key: "followerCount",
    label: "Seguidores",
    shortLabel: "Segs.",
    color: "var(--series-watch)",
    aggregation: "avg",
    format: "compact",
  },
  comments: {
    key: "comments",
    label: "Comentarios",
    shortLabel: "Com.",
    color: "var(--series-comments)",
    aggregation: "sum",
    format: "compact",
  },
  likes: {
    key: "likes",
    label: "Likes",
    shortLabel: "Likes",
    color: "var(--series-likes)",
    aggregation: "sum",
    format: "compact",
  },
  shares: {
    key: "shares",
    label: "Compartidos",
    shortLabel: "Share",
    color: "var(--series-shares)",
    aggregation: "sum",
    format: "compact",
  },
  saves: {
    key: "saves",
    label: "Guardados",
    shortLabel: "Save",
    color: "var(--series-saves)",
    aggregation: "sum",
    format: "compact",
  },
  watchTimeMinutes: {
    key: "watchTimeMinutes",
    label: "Watch time",
    shortLabel: "Watch",
    color: "var(--series-watch)",
    aggregation: "sum",
    format: "minutes",
  },
  averageViewDurationSeconds: {
    key: "averageViewDurationSeconds",
    label: "Avg view duration",
    shortLabel: "Avg dur.",
    color: "var(--series-retention)",
    aggregation: "avg",
    format: "seconds",
  },
  subscribersGained: {
    key: "subscribersGained",
    label: "Subscribers gained",
    shortLabel: "Subs +",
    color: "var(--series-subs)",
    aggregation: "sum",
    format: "compact",
  },
  subscribersLost: {
    key: "subscribersLost",
    label: "Subscribers lost",
    shortLabel: "Subs -",
    color: "var(--series-skip)",
    aggregation: "sum",
    format: "compact",
  },
  avgWatchTimeMs: {
    key: "avgWatchTimeMs",
    label: "Retencion",
    shortLabel: "Ret.",
    color: "var(--series-watch)",
    aggregation: "avg",
    format: "milliseconds",
  },
  skipRate: {
    key: "skipRate",
    label: "Omision",
    shortLabel: "Skip",
    color: "var(--series-skip)",
    aggregation: "avg",
    format: "percent",
  },
  engagementRate: {
    key: "engagementRate",
    label: "Engagement",
    shortLabel: "Eng.",
    color: "var(--series-views)",
    aggregation: "derived",
    format: "percent",
  },
  likeRate: {
    key: "likeRate",
    label: "Like rate",
    shortLabel: "Like rate",
    color: "var(--series-retention)",
    aggregation: "derived",
    format: "percent",
  },
  commentRate: {
    key: "commentRate",
    label: "Comment rate",
    shortLabel: "Com. rate",
    color: "var(--series-comments)",
    aggregation: "derived",
    format: "percent",
  },
  shareRate: {
    key: "shareRate",
    label: "Share rate",
    shortLabel: "Share rate",
    color: "var(--series-shares)",
    aggregation: "derived",
    format: "percent",
  },
  saveRate: {
    key: "saveRate",
    label: "Save rate",
    shortLabel: "Save rate",
    color: "var(--series-saves)",
    aggregation: "derived",
    format: "percent",
  },
  profileCtr: {
    key: "profileCtr",
    label: "CTR perfil",
    shortLabel: "CTR perfil",
    color: "var(--series-profile)",
    aggregation: "derived",
    format: "percent",
  },
  linkCtr: {
    key: "linkCtr",
    label: "CTR link",
    shortLabel: "CTR link",
    color: "var(--series-links)",
    aggregation: "derived",
    format: "percent",
  },
  followConversion: {
    key: "followConversion",
    label: "Conv. follow",
    shortLabel: "Follow conv.",
    color: "var(--series-follows)",
    aggregation: "derived",
    format: "percent",
  },
  avgViewsPerPiece: {
    key: "avgViewsPerPiece",
    label: "Views por pieza",
    shortLabel: "Views/pieza",
    color: "var(--series-views)",
    aggregation: "derived",
    format: "compact",
  },
  subsPerThousandViews: {
    key: "subsPerThousandViews",
    label: "Subs por mil views",
    shortLabel: "Subs/1k",
    color: "var(--series-subs)",
    aggregation: "derived",
    format: "perThousand",
  },
};

export const DASHBOARD_METRIC_KEYS = Object.keys(
  DASHBOARD_METRIC_REGISTRY,
) as DashboardTrendMetricKey[];

export const RAW_SUM_METRICS = DASHBOARD_METRIC_KEYS.filter(
  (key) => DASHBOARD_METRIC_REGISTRY[key].aggregation === "sum",
);
export const RAW_AVG_METRICS = DASHBOARD_METRIC_KEYS.filter(
  (key) => DASHBOARD_METRIC_REGISTRY[key].aggregation === "avg",
);
export const DERIVED_METRICS = DASHBOARD_METRIC_KEYS.filter(
  (key) => DASHBOARD_METRIC_REGISTRY[key].aggregation === "derived",
);

export const PLATFORM_DASHBOARD_METRICS: Record<
  Platform,
  DashboardTrendMetricKey[]
> = {
  instagram: [
    "views",
    "reach",
    "contentInteractions",
    "profileVisits",
    "linkClicks",
    "followerCount",
    "engagementRate",
  ],
  tiktok: [
    "views",
    "likes",
    "comments",
    "shares",
    "engagementRate",
    "likeRate",
    "commentRate",
    "shareRate",
    "avgViewsPerPiece",
  ],
  youtube: [
    "views",
    "watchTimeMinutes",
    "averageViewDurationSeconds",
    "subscribersGained",
    "subscribersLost",
    "likes",
    "comments",
    "shares",
  ],
};

export const PLATFORM_CARD_CONFIG: Record<
  Platform,
  Array<{ key: DashboardTrendMetricKey; label: string; hint: string }>
> = {
  instagram: [
    { key: "views", label: "Views", hint: "Visualizaciones observadas del periodo." },
    { key: "reach", label: "Reach", hint: "Alcance observado del periodo." },
    { key: "contentInteractions", label: "Interacciones", hint: "Interacciones observadas del periodo." },
    { key: "profileVisits", label: "Profile visits", hint: "Visitas al perfil observadas del periodo." },
  ],
  tiktok: [
    { key: "views", label: "Views", hint: "Views agregadas de las piezas publicadas en el periodo." },
    { key: "likes", label: "Likes", hint: "Likes agregados de las piezas del periodo." },
    { key: "comments", label: "Comments", hint: "Comentarios agregados de las piezas del periodo." },
    { key: "shares", label: "Shares", hint: "Compartidos agregados de las piezas del periodo." },
    { key: "engagementRate", label: "Engagement", hint: "Interacciones sobre views del periodo." },
  ],
  youtube: [
    { key: "views", label: "Views", hint: "Views observadas del periodo." },
    { key: "watchTimeMinutes", label: "Tiempo visto", hint: "Minutos estimados vistos." },
    { key: "averageViewDurationSeconds", label: "Duracion media", hint: "Duracion media de reproduccion." },
    { key: "subscribersGained", label: "Suscriptores ganados", hint: "Altas observadas del periodo." },
    { key: "subscribersLost", label: "Suscriptores perdidos", hint: "Bajas observadas del periodo." },
  ],
};

export function createDashboardMetricRecord(initialValue = 0) {
  return DASHBOARD_METRIC_KEYS.reduce((record, key) => {
    record[key] = initialValue;
    return record;
  }, {} as Record<DashboardTrendMetricKey, number>);
}

export function createNullableDashboardMetricRecord(initialValue: number | null = null) {
  return DASHBOARD_METRIC_KEYS.reduce((record, key) => {
    record[key] = initialValue;
    return record;
  }, {} as Record<DashboardTrendMetricKey, number | null>);
}

export function getDashboardMetricDefinition(key: DashboardTrendMetricKey) {
  return DASHBOARD_METRIC_REGISTRY[key];
}

export function getPlatformDashboardMetricOptions(platform: Platform) {
  return PLATFORM_DASHBOARD_METRICS[platform].map((key) => DASHBOARD_METRIC_REGISTRY[key]);
}
export function formatDashboardMetricValue(key: DashboardTrendMetricKey, value: number | null) {
  if (value === null) return "\u2014";
  switch (DASHBOARD_METRIC_REGISTRY[key].format) {
    case "percent":
      return formatPercent(value);
    case "milliseconds":
      return formatMilliseconds(value);
    case "seconds":
      return formatSeconds(value);
    case "minutes":
      return formatCompactNumber(value) + " min";
    case "perThousand":
      return value.toFixed(1) + "/1k";
    default:
      return formatCompactNumber(value);
  }
}

export function formatDashboardAxisValue(key: DashboardTrendMetricKey, value: number) {
  switch (DASHBOARD_METRIC_REGISTRY[key].format) {
    case "percent":
      return `${Math.round(value)}%`;
    case "milliseconds":
      return formatMilliseconds(value);
    case "seconds":
      return formatSeconds(value);
    case "minutes":
      return formatCompactNumber(value) + " m";
    case "perThousand":
      return value.toFixed(value >= 100 ? 0 : 1);
    default:
      return formatCompactNumber(value);
  }
}

export function safeDivide(
  numerator: number | null | undefined,
  denominator: number | null | undefined,
  multiplier = 1,
) {
  if (
    typeof numerator !== "number" ||
    typeof denominator !== "number" ||
    denominator <= 0
  ) {
    return null;
  }

  return (numerator / denominator) * multiplier;
}

export function computeDerivedMetrics(
  rawMetrics: Partial<Record<DashboardTrendMetricKey, number | null>>,
  options?: { publishedItems?: number | null },
) {
  const interactions =
    rawMetrics.contentInteractions ??
    [rawMetrics.likes, rawMetrics.comments, rawMetrics.shares, rawMetrics.saves].reduce<number>(
      (sum, value) => sum + (typeof value === "number" ? value : 0),
      0,
    );
  const publishedItems = options?.publishedItems ?? null;

  return {
    engagementRate: safeDivide(
      interactions,
      rawMetrics.reach ?? rawMetrics.views,
      100,
    ),
    likeRate: safeDivide(rawMetrics.likes, rawMetrics.views, 100),
    commentRate: safeDivide(rawMetrics.comments, rawMetrics.views, 100),
    shareRate: safeDivide(rawMetrics.shares, rawMetrics.views, 100),
    saveRate: safeDivide(rawMetrics.saves, rawMetrics.views, 100),
    profileCtr: safeDivide(rawMetrics.profileVisits, rawMetrics.reach, 100),
    linkCtr: safeDivide(rawMetrics.linkClicks, rawMetrics.profileVisits, 100),
    followConversion: safeDivide(
      rawMetrics.follows,
      rawMetrics.profileVisits,
      100,
    ),
    avgViewsPerPiece: safeDivide(rawMetrics.views, publishedItems, 1),
    subsPerThousandViews: safeDivide(
      rawMetrics.subscribersGained,
      rawMetrics.views,
      1000,
    ),
  } satisfies Partial<Record<DashboardTrendMetricKey, number | null>>;
}

