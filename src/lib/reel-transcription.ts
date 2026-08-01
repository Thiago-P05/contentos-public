import { transcribeRemoteMedia } from "@/lib/ai/analysis";
import { getContentKind, getTranscriptTextAsset, isVideoEligibleForTranscript } from "@/lib/content-media";
import { env } from "@/lib/env";
import { withLangfuseSpan } from "@/lib/observability/langfuse";
import {
  claimContentTranscriptionProcessing,
  getContentTextAssets,
  setTranscriptionState,
  upsertTextAsset,
} from "@/lib/supabase/repository";
import type { ContentItem, TextAsset } from "@/lib/types";

export type ReelTranscriptionResult = {
  eligible: boolean;
  attempted: boolean;
  durationMs: number;
  outcome: "not_applicable" | "reused" | "ready" | "failed" | "skipped";
  error?: string | null;
};

export type ReelTranscriptionStats = {
  eligibleItems: number;
  attempted: number;
  disabled: number;
  reused: number;
  ready: number;
  failed: number;
  skipped: number;
  notApplicable: number;
  totalDurationMs: number;
  errors: Array<{
    contentItemId: string;
    externalId: string;
    error: string;
  }>;
};

export function createReelTranscriptionStats(): ReelTranscriptionStats {
  return {
    eligibleItems: 0,
    attempted: 0,
    disabled: 0,
    reused: 0,
    ready: 0,
    failed: 0,
    skipped: 0,
    notApplicable: 0,
    totalDurationMs: 0,
    errors: [],
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

export const TRANSCRIPTION_RETRY_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24h
export const TRANSCRIPTION_PROCESSING_LEASE_MS = 15 * 60 * 1000;

export function isTranscriptionProcessingStale(
  persisted: Pick<ContentItem, "transcriptionStatus" | "transcriptionUpdatedAt">,
  now: number = Date.now(),
) {
  if (persisted.transcriptionStatus !== "processing") return false;
  const startedAt = persisted.transcriptionUpdatedAt
    ? Date.parse(persisted.transcriptionUpdatedAt)
    : NaN;
  return !Number.isFinite(startedAt) || now - startedAt >= TRANSCRIPTION_PROCESSING_LEASE_MS;
}

/**
 * Devuelve true si un reel con transcripción fallida debe omitirse en este sync
 * (el último intento fue hace menos de 24h).
 */
export function shouldSkipFailedTranscription(
  persisted: Pick<ContentItem, "transcriptionStatus" | "transcriptionUpdatedAt">,
  now: number = Date.now(),
): boolean {
  if (persisted.transcriptionStatus !== "failed") return false;
  const at = persisted.transcriptionUpdatedAt
    ? Date.parse(persisted.transcriptionUpdatedAt)
    : NaN;
  return Number.isFinite(at) && now - at < TRANSCRIPTION_RETRY_COOLDOWN_MS;
}

function getTranscriptModel(textAsset: (Partial<TextAsset> & Pick<TextAsset, "sourceType" | "content">) | null) {
  const model = textAsset?.rawPayload?.model;
  return typeof model === "string" && model.trim() ? model : null;
}

export function getReusableTranscriptState(
  persisted: Pick<
    ContentItem,
    "transcriptionStatus" | "transcriptionModel" | "transcriptionError" | "transcriptionUpdatedAt"
  >,
  transcriptAsset: (Partial<TextAsset> & Pick<TextAsset, "sourceType" | "content">) | null,
) {
  if (!transcriptAsset) {
    return null;
  }

  return {
    transcriptionStatus: "ready" as const,
    transcriptionModel: getTranscriptModel(transcriptAsset) ?? persisted.transcriptionModel ?? null,
    transcriptionError: null,
    transcriptionUpdatedAt:
      transcriptAsset.updatedAt ?? persisted.transcriptionUpdatedAt ?? new Date().toISOString(),
    shouldUpdate:
      persisted.transcriptionStatus !== "ready" ||
      persisted.transcriptionError !== null ||
      persisted.transcriptionModel !== (getTranscriptModel(transcriptAsset) ?? persisted.transcriptionModel ?? null),
  };
}

export function updateReelTranscriptionStats(
  stats: ReelTranscriptionStats,
  item: Pick<ContentItem, "id" | "externalId">,
  result: ReelTranscriptionResult,
) {
  stats.totalDurationMs += result.durationMs;
  if (!result.eligible) {
    stats.notApplicable += 1;
    return;
  }
  stats.eligibleItems += 1;
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
  if (result.outcome === "failed") {
    stats.failed += 1;
    if (result.error && stats.errors.length < 5) {
      stats.errors.push({ contentItemId: item.id, externalId: item.externalId, error: result.error });
    }
  }
}

export async function maybeTranscribeReel(
  persisted: ContentItem,
  options: { retryFailed?: boolean } = {},
): Promise<ReelTranscriptionResult> {
  return withLangfuseSpan(
    {
      name: "content.transcription.item",
      input: {
        contentItemId: persisted.id,
        externalId: persisted.externalId,
        platform: persisted.platform,
        mediaType: getContentKind(persisted.platform, persisted.rawPayload),
        mediaUrl: persisted.mediaUrl,
      },
      metadata: {
        agentType: "content_transcription",
        contentItemId: persisted.id,
        externalId: persisted.externalId,
        platform: persisted.platform,
      },
      output: (result) => ({
        eligible: result.eligible,
        attempted: result.attempted,
        outcome: result.outcome,
        durationMs: result.durationMs,
      }),
    },
    () => runReelTranscription(persisted, options),
  );
}

async function runReelTranscription(
  persisted: ContentItem,
  options: { retryFailed?: boolean },
): Promise<ReelTranscriptionResult> {
  if (!isVideoEligibleForTranscript(persisted)) {
    if (persisted.transcriptionStatus !== "not_applicable") {
      await setTranscriptionState(persisted.id, {
        transcriptionStatus: "not_applicable",
        transcriptionModel: null,
        transcriptionError: null,
      });
    }
    return { eligible: false, attempted: false, durationMs: 0, outcome: "not_applicable" };
  }

  const textAssets = await getContentTextAssets(persisted.id);
  const transcriptAsset = getTranscriptTextAsset(textAssets);
  const reusableTranscript = getReusableTranscriptState(persisted, transcriptAsset);

  if (reusableTranscript) {
    if (reusableTranscript.shouldUpdate) {
      await setTranscriptionState(persisted.id, {
        transcriptionStatus: reusableTranscript.transcriptionStatus,
        transcriptionModel: reusableTranscript.transcriptionModel,
        transcriptionError: reusableTranscript.transcriptionError,
        transcriptionUpdatedAt: reusableTranscript.transcriptionUpdatedAt,
      });
    }
    return { eligible: true, attempted: false, durationMs: 0, outcome: "reused" };
  }

  if (!options.retryFailed && shouldSkipFailedTranscription(persisted)) {
    return { eligible: true, attempted: false, durationMs: 0, outcome: "skipped" };
  }

  if (persisted.transcriptionStatus === "processing" && !isTranscriptionProcessingStale(persisted)) {
    return { eligible: true, attempted: false, durationMs: 0, outcome: "skipped" };
  }

  const claimToken = await claimContentTranscriptionProcessing(persisted.id, {
    status: persisted.transcriptionStatus,
    updatedAt: persisted.transcriptionUpdatedAt,
  });
  if (!claimToken) {
    return { eligible: true, attempted: false, durationMs: 0, outcome: "skipped" };
  }

  const startedAt = Date.now();

  try {
    const transcript = await transcribeRemoteMedia(persisted.mediaUrl!);
    const normalizedTranscript = transcript.trim();

    if (!normalizedTranscript) {
      throw new Error("OpenRouter devolvio una transcripcion vacia.");
    }

    const completedAt = new Date().toISOString();
    await upsertTextAsset(persisted.id, "transcript", normalizedTranscript, "es", {
      provider: "openrouter",
      agent: "transcription_agent",
      model: env.OPENROUTER_TRANSCRIPTION_MODEL,
      mediaUrl: persisted.mediaUrl,
      generatedAt: completedAt,
    });
    await setTranscriptionState(persisted.id, {
      transcriptionStatus: "ready",
      transcriptionModel: env.OPENROUTER_TRANSCRIPTION_MODEL,
      transcriptionError: null,
      transcriptionUpdatedAt: completedAt,
      expectedProcessingUpdatedAt: claimToken,
    });

    return {
      eligible: true,
      attempted: true,
      durationMs: Date.now() - startedAt,
      outcome: "ready",
    };
  } catch (error) {
    const message = getErrorMessage(error);
    const failedAt = new Date().toISOString();
    await setTranscriptionState(persisted.id, {
      transcriptionStatus: "failed",
      transcriptionModel: env.OPENROUTER_TRANSCRIPTION_MODEL,
      transcriptionError: message,
      transcriptionUpdatedAt: failedAt,
      expectedProcessingUpdatedAt: claimToken,
    });
    console.warn(`No se pudo transcribir reel instagram:${persisted.externalId}: ${message}`);

    return {
      eligible: true,
      attempted: true,
      durationMs: Date.now() - startedAt,
      outcome: "failed",
      error: message,
    };
  }
}
