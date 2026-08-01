import {
  chooseAnalysisInput,
  generateInsight,
} from "@/lib/ai/analysis";
import { getDefaultPlatformConnectionBriefFields } from "@/lib/connection-briefs";
import { env } from "@/lib/env";
import { withLangfuseSpan } from "@/lib/observability/langfuse";
import {
  claimContentAnalysisProcessing,
  getContentDetail,
  getPlatformConnectionBrief,
  setAnalysisState,
  upsertInsight,
  upsertTextAsset,
} from "@/lib/supabase/repository";
import type { AIInsight, ContentDetail, ContentItem } from "@/lib/types";

export type ContentAnalysisResult = {
  attempted: boolean;
  durationMs: number;
  outcome: "reused" | "ready" | "fallback" | "failed" | "skipped";
  error?: string | null;
};

export type ContentAnalysisStats = {
  attempted: number;
  disabled: number;
  reused: number;
  ready: number;
  fallback: number;
  failed: number;
  skipped: number;
  totalDurationMs: number;
  errors: Array<{
    contentItemId: string;
    externalId: string;
    error: string;
  }>;
};

export function createContentAnalysisStats(): ContentAnalysisStats {
  return {
    attempted: 0,
    disabled: 0,
    reused: 0,
    ready: 0,
    fallback: 0,
    failed: 0,
    skipped: 0,
    totalDurationMs: 0,
    errors: [],
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

/**
 * Un insight existente con status terminal (ready/fallback) es suficiente para reusar.
 * NO se exige videoPotential: los insights sin él se backfillean con sync:ai,
 * no re-analizando en cada sync.
 */
export function shouldReuseExistingAnalysis(detail: {
  insight: Pick<AIInsight, "videoPotential"> | null;
  item: Pick<ContentDetail["item"], "analysisStatus">;
}): boolean {
  return Boolean(
    detail.insight &&
      (detail.item.analysisStatus === "ready" || detail.item.analysisStatus === "fallback"),
  );
}

export const ANALYSIS_RETRY_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24h
export const ANALYSIS_MAX_ATTEMPTS = 5;
export const ANALYSIS_PROCESSING_LEASE_MS = 15 * 60 * 1000;

export function isAnalysisProcessingStale(
  item: Pick<ContentItem, "analysisStatus" | "analysisProcessingStartedAt">,
  now: number = Date.now(),
) {
  if (item.analysisStatus !== "processing") return false;
  const startedAt = item.analysisProcessingStartedAt
    ? Date.parse(item.analysisProcessingStartedAt)
    : NaN;
  return !Number.isFinite(startedAt) || now - startedAt >= ANALYSIS_PROCESSING_LEASE_MS;
}

export async function claimContentAnalysisItem(
  item: Pick<ContentItem, "id" | "analysisStatus" | "analysisProcessingStartedAt">,
) {
  if (item.analysisStatus === "ready" || item.analysisStatus === "fallback") return false;
  if (item.analysisStatus === "processing" && !isAnalysisProcessingStale(item)) return false;

  return claimContentAnalysisProcessing(item.id, {
    status: item.analysisStatus,
    processingStartedAt: item.analysisProcessingStartedAt ?? null,
  });
}

/**
 * Devuelve true si un item fallido debe omitirse en este sync
 * (dentro del cooldown de 24h o superó el límite de reintentos).
 */
export function shouldSkipFailedAnalysis(
  analysisStatus: string | null,
  analysisError: { at?: unknown; attempts?: unknown } | null | undefined,
  now: number = Date.now(),
): boolean {
  if (analysisStatus !== "failed" || !analysisError) return false;
  const attempts = typeof analysisError.attempts === "number" ? analysisError.attempts : 1;
  if (attempts >= ANALYSIS_MAX_ATTEMPTS) return true;
  const at = typeof analysisError.at === "string" ? Date.parse(analysisError.at) : NaN;
  return Number.isFinite(at) && now - at < ANALYSIS_RETRY_COOLDOWN_MS;
}

export function updateContentAnalysisStats(
  stats: ContentAnalysisStats,
  item: Pick<ContentItem, "id" | "externalId">,
  result: ContentAnalysisResult,
) {
  stats.totalDurationMs += result.durationMs;

  if (result.attempted) {
    stats.attempted += 1;
  }

  if (result.outcome === "reused") {
    stats.reused += 1;
    return;
  }

  if (result.outcome === "skipped") {
    stats.skipped += 1;
    return;
  }

  if (result.outcome === "ready") {
    stats.ready += 1;
    return;
  }

  if (result.outcome === "fallback") {
    stats.fallback += 1;
    return;
  }

  stats.failed += 1;
  if (result.error && stats.errors.length < 5) {
    stats.errors.push({ contentItemId: item.id, externalId: item.externalId, error: result.error });
  }
}

export async function maybeAnalyzeContentItem(
  persisted: Pick<ContentItem, "id" | "externalId" | "rawPayload">,
  options: { retryFailed?: boolean; claimToken?: string } = {},
): Promise<ContentAnalysisResult> {
  return withLangfuseSpan(
    {
      name: "content.analysis.item",
      input: { contentItemId: persisted.id, externalId: persisted.externalId },
      metadata: {
        agentType: "content_analysis",
        contentItemId: persisted.id,
        externalId: persisted.externalId,
      },
      output: (result) => ({
        attempted: result.attempted,
        outcome: result.outcome,
        durationMs: result.durationMs,
      }),
    },
    () => runContentItemAnalysis(persisted, options),
  );
}

async function runContentItemAnalysis(
  persisted: Pick<ContentItem, "id" | "externalId" | "rawPayload">,
  options: { retryFailed?: boolean; claimToken?: string },
): Promise<ContentAnalysisResult> {
  const startedAt = Date.now();
  const detail = await getContentDetail(persisted.id);

  if (!detail) {
    return {
      attempted: false,
      durationMs: Date.now() - startedAt,
      outcome: "failed",
      error: "No se encontro el contenido para analizar.",
    };
  }

  if (shouldReuseExistingAnalysis(detail)) {
    return {
      attempted: false,
      durationMs: Date.now() - startedAt,
      outcome: "reused",
    };
  }

  const analysisError =
    detail.item.rawPayload.analysisError != null &&
    typeof detail.item.rawPayload.analysisError === "object"
      ? (detail.item.rawPayload.analysisError as { at?: unknown; attempts?: unknown })
      : null;

  if (!options.retryFailed && shouldSkipFailedAnalysis(detail.item.analysisStatus, analysisError)) {
    return {
      attempted: false,
      durationMs: Date.now() - startedAt,
      outcome: "skipped",
    };
  }

  const claimToken = options.claimToken ?? (await claimContentAnalysisItem(detail.item));
  if (!claimToken) {
    return {
      attempted: false,
      durationMs: Date.now() - startedAt,
      outcome: "skipped",
    };
  }

  try {
    const brief = detail.item.connectionId
      ? await getPlatformConnectionBrief(detail.item.connectionId)
      : {
          id: "default",
          connectionId: "default",
          ...getDefaultPlatformConnectionBriefFields(),
          createdAt: "",
          updatedAt: "",
        };
    const analysisInput = chooseAnalysisInput(detail.item, detail.textAssets);

    if (analysisInput.sourceType === "metadata_fallback" && analysisInput.content.trim()) {
      await upsertTextAsset(detail.item.id, "metadata_fallback", analysisInput.content, "es", {
        provider: "internal",
        generatedAt: new Date().toISOString(),
      });
    }

    const insight = await generateInsight(detail.item, analysisInput, brief);

    await upsertInsight(detail.item.id, {
      ...insight,
      model: env.OPENROUTER_ANALYSIS_MODEL,
    });

    const finalStatus =
      analysisInput.sourceType === "metadata_fallback" || insight.evidenceMode === "text_only"
        ? "fallback"
        : "ready";

    await setAnalysisState(detail.item.id, {
      analysisStatus: finalStatus,
      analysisInputText: analysisInput.content,
      rawPayload: {
        ...detail.item.rawPayload,
        analysisError: null,
      },
      expectedProcessingStartedAt: claimToken,
    });

    return {
      attempted: true,
      durationMs: Date.now() - startedAt,
      outcome: finalStatus,
    };
  } catch (error) {
    const message = getErrorMessage(error);
    const previousAttempts =
      typeof analysisError?.attempts === "number" ? analysisError.attempts : 0;
    await setAnalysisState(detail.item.id, {
      analysisStatus: "failed",
      rawPayload: {
        ...detail.item.rawPayload,
        analysisError: {
          message,
          at: new Date().toISOString(),
          provider: "openrouter",
          agent: "analysis_agent",
          attempts: previousAttempts + 1,
        },
      },
      expectedProcessingStartedAt: claimToken,
    }).catch(() => undefined);

    return {
      attempted: true,
      durationMs: Date.now() - startedAt,
      outcome: "failed",
      error: message,
    };
  }
}
