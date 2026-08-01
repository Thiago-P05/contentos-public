import "server-only";

import { getContentTextAssetsByItemIds, getContentDetail, getDashboardOverview, getPlatformConnectionBrief, listContentCatalog, listPlatformConnections } from "@/lib/supabase/repository";
import { metricValue } from "@/lib/utils";
import type { AIInsight, ContentListItem, DashboardRange, Platform, PlatformFilter, TextAsset } from "@/lib/types";

const SCRIPT_REFERENCE_LIMIT = 8;
const TRANSCRIPT_EXCERPT_LIMIT = 1200;
const MAX_THUMBNAIL_BYTES = 2_000_000;

function compactText(value: string | null | undefined, maxLength: number) {
  const normalized = value?.replace(/\s+/g, " ").trim();

  if (!normalized) return null;
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength).trimEnd()}...`;
}

function safeMetrics(item: ContentListItem) {
  return {
    views: metricValue(item.latestMetrics, "views", "viewCount", "reach") ?? null,
    reach: metricValue(item.latestMetrics, "reach") ?? null,
    likes: metricValue(item.latestMetrics, "likes") ?? null,
    comments: metricValue(item.latestMetrics, "comments") ?? null,
    shares: metricValue(item.latestMetrics, "shares") ?? null,
    saves: metricValue(item.latestMetrics, "saves") ?? null,
    impressions: metricValue(item.latestMetrics, "impressions") ?? null,
    clickThroughRate: metricValue(item.latestMetrics, "impressionsClickThroughRate") ?? null,
    averageViewDurationSeconds: metricValue(item.latestMetrics, "averageViewDurationSeconds") ?? null,
    averageViewPercentage: metricValue(item.latestMetrics, "averageViewPercentage") ?? null,
    watchTimeMinutes: metricValue(item.latestMetrics, "watchTimeMinutes") ?? null,
    subscribersGained: metricValue(item.latestMetrics, "subscribersGained") ?? null,
  };
}

function safeInsight(insight: AIInsight | null) {
  if (!insight) return null;

  return {
    summary: compactText(insight.summary, 700),
    hooks: insight.hooks.slice(0, 5),
    strengths: insight.strengths.slice(0, 5),
    weaknesses: insight.weaknesses.slice(0, 5),
    improvements: insight.improvements.slice(0, 5),
    topics: insight.topics.slice(0, 6),
    hookType: insight.hookType,
    hookAssessment: compactText(insight.hookAssessment, 500),
    evidenceMode: insight.evidenceMode,
    confidence: insight.confidence,
    videoPotential: insight.videoPotential,
  };
}

function transcriptFromAssets(textAssets: TextAsset[]) {
  return textAssets.find((asset) => asset.sourceType === "transcript")?.content ?? null;
}

export function toSafeContent(item: ContentListItem, options?: { transcriptExcerpt?: string | null }) {
  return {
    id: item.id,
    externalId: item.externalId,
    connectionId: item.connectionId,
    platform: item.platform,
    title: item.title ?? compactText(item.caption, 80),
    caption: compactText(item.caption, 500),
    permalink: item.permalink,
    publishedAt: item.publishedAt,
    durationSeconds: item.durationSeconds,
    thumbnailUrl: item.platform === "youtube" ? item.thumbnailUrl : null,
    metrics: safeMetrics(item),
    analysisStatus: item.analysisStatus,
    transcriptionStatus: item.transcriptionStatus,
    analysis: safeInsight(item.latestInsight),
    transcriptExcerpt: options?.transcriptExcerpt ?? null,
  };
}

export async function listMcpConnections(platform: PlatformFilter = "all") {
  const connections = await listPlatformConnections({
    platform,
    includeDisconnected: false,
    includeBriefs: false,
  });

  return connections.map((connection) => ({
    id: connection.id,
    platform: connection.platform,
    displayName: connection.displayName,
    username: connection.accountUsername,
    status: connection.status,
  }));
}

async function assertConnectionExists(connectionId: string) {
  const connections = await listMcpConnections();
  const connection = connections.find((entry) => entry.id === connectionId);

  if (!connection) {
    throw new Error("La cuenta solicitada no existe o no esta activa.");
  }

  return connection;
}

export async function getMcpBusinessBrief(connectionId: string) {
  const connection = await assertConnectionExists(connectionId);
  const brief = await getPlatformConnectionBrief(connectionId);

  return {
    connection,
    brief: {
      offer: brief.offer,
      idealCustomerProfile: brief.idealCustomerProfile,
      corePain: brief.corePain,
      desiredOutcome: brief.desiredOutcome,
      differentiator: brief.differentiator,
      toneGuidelines: brief.toneGuidelines,
      avoidGuidelines: brief.avoidGuidelines,
      primaryCta: brief.primaryCta,
      notes: brief.notes,
      updatedAt: brief.updatedAt,
    },
  };
}

export async function searchMcpContent(input: {
  query?: string;
  platform: PlatformFilter;
  connectionId?: string;
  publishedAfter?: string;
  limit: number;
  sort: "recent" | "views";
}) {
  if (input.connectionId) {
    await assertConnectionExists(input.connectionId);
  }

  const catalog = await listContentCatalog({
    platform: input.platform,
    connectionId: input.connectionId,
    query: input.query,
    publishedAfter: input.publishedAfter,
    limit: input.sort === "views" ? Math.max(input.limit, 30) : input.limit,
  });
  const sorted = input.sort === "views"
    ? catalog.slice().sort((left, right) => (safeMetrics(right).views ?? 0) - (safeMetrics(left).views ?? 0))
    : catalog;

  return sorted.slice(0, input.limit).map((item) => toSafeContent(item));
}

export async function getMcpContentDetail(contentId: string) {
  const detail = await getContentDetail(contentId);

  if (!detail) {
    throw new Error("No se encontro el contenido solicitado.");
  }

  if (detail.item.connectionId) {
    await assertConnectionExists(detail.item.connectionId);
  }

  const listItem: ContentListItem = {
    ...detail.item,
    latestMetrics: detail.snapshots[0]?.metrics ?? {},
    latestInsight: detail.insight,
  };

  return {
    content: toSafeContent(listItem),
    metricsHistory: detail.snapshots.slice(0, 60).map((snapshot) => ({
      capturedAt: snapshot.capturedAt,
      metrics: snapshot.metrics,
    })),
    analysis: safeInsight(detail.insight),
  };
}

export async function getMcpTranscript(input: { contentId: string; offset: number; limit: number }) {
  const detail = await getContentDetail(input.contentId);

  if (!detail) {
    throw new Error("No se encontro el contenido solicitado.");
  }

  if (detail.item.connectionId) {
    await assertConnectionExists(detail.item.connectionId);
  }

  const transcript = transcriptFromAssets(detail.textAssets);

  if (!transcript) {
    return {
      contentId: input.contentId,
      status: detail.item.transcriptionStatus,
      transcript: null,
      nextOffset: null,
    };
  }

  const excerpt = transcript.slice(input.offset, input.offset + input.limit);
  const nextOffset = input.offset + excerpt.length < transcript.length ? input.offset + excerpt.length : null;

  return {
    contentId: input.contentId,
    status: detail.item.transcriptionStatus,
    transcript: excerpt,
    nextOffset,
  };
}

export async function getMcpThumbnail(contentId: string) {
  const detail = await getContentDetail(contentId);

  if (!detail) {
    throw new Error("No se encontro el contenido solicitado.");
  }

  if (detail.item.connectionId) {
    await assertConnectionExists(detail.item.connectionId);
  }

  const thumbnailUrl = detail.item.thumbnailUrl;

  if (!thumbnailUrl) {
    throw new Error("El contenido no tiene una miniatura disponible.");
  }

  let sourceUrl: URL;
  try {
    sourceUrl = new URL(thumbnailUrl);
  } catch {
    throw new Error("La URL de la miniatura no es valida.");
  }

  if (sourceUrl.protocol !== "https:") {
    throw new Error("La miniatura no usa una URL HTTPS segura.");
  }

  const response = await fetch(sourceUrl, {
    headers: { Accept: "image/*" },
    cache: "no-store",
    redirect: "error",
  });

  if (!response.ok) {
    throw new Error("No se pudo descargar la miniatura.");
  }

  const mimeType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  const declaredSize = Number(response.headers.get("content-length"));

  if (!mimeType?.startsWith("image/")) {
    throw new Error("La respuesta de la miniatura no es una imagen.");
  }

  if (Number.isFinite(declaredSize) && declaredSize > MAX_THUMBNAIL_BYTES) {
    throw new Error("La miniatura supera el limite de 2 MB.");
  }

  const bytes = new Uint8Array(await response.arrayBuffer());

  if (bytes.byteLength > MAX_THUMBNAIL_BYTES) {
    throw new Error("La miniatura supera el limite de 2 MB.");
  }

  return {
    contentId,
    sourceUrl: sourceUrl.toString(),
    mimeType,
    data: Buffer.from(bytes).toString("base64"),
  };
}

export async function getMcpPerformanceOverview(input: {
  range: DashboardRange;
  platform: PlatformFilter;
  connectionId?: string;
}) {
  if (input.connectionId) {
    await assertConnectionExists(input.connectionId);
  }

  const overview = await getDashboardOverview(input.range, input.platform, input.connectionId ?? null, null);

  return {
    generatedAt: overview.generatedAt,
    selectedRange: overview.selectedRange,
    selectedPlatform: overview.selectedPlatform,
    selectedConnectionId: overview.selectedConnectionId,
    performanceAvailability: overview.performanceAvailability,
    totals: overview.performanceTotals,
    series: overview.performanceSeries.slice(-30).map((point) => ({
      bucketStart: point.bucketStart,
      bucketEnd: point.bucketEnd,
      metrics: point.metrics,
      observedMetrics: point.observedMetrics,
    })),
    topContent: overview.topContent.slice(0, 5).map((item) => toSafeContent(item)),
  };
}

export async function getMcpScriptContext(input: {
  topic: string;
  platform: Platform;
  connectionId: string;
  objective?: string;
  format?: string;
}) {
  const brief = await getMcpBusinessBrief(input.connectionId);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  let catalog = await listContentCatalog({
    platform: input.platform,
    connectionId: input.connectionId,
    query: input.topic,
    publishedAfter: thirtyDaysAgo,
    limit: 30,
  });

  if (catalog.length === 0) {
    catalog = await listContentCatalog({
      platform: input.platform,
      connectionId: input.connectionId,
      publishedAfter: thirtyDaysAgo,
      limit: 30,
    });
  }

  const references = catalog
    .slice()
    .sort((left, right) => (safeMetrics(right).views ?? 0) - (safeMetrics(left).views ?? 0))
    .slice(0, SCRIPT_REFERENCE_LIMIT);
  const textAssets = await getContentTextAssetsByItemIds(references.map((item) => item.id));

  return {
    topic: input.topic,
    objective: input.objective ?? null,
    format: input.format ?? null,
    platform: input.platform,
    business: brief,
    references: references.map((item) =>
      toSafeContent(item, {
        transcriptExcerpt: compactText(transcriptFromAssets(textAssets.get(item.id) ?? []), TRANSCRIPT_EXCERPT_LIMIT),
      }),
    ),
    instructions: "Usa los datos reales como evidencia. No inventes metricas ni atribuyas resultados a contenido sin respaldo.",
  };
}
