import { isContentEligibleForAIBackfill } from "@/lib/content-media";
import { resolveAutomaticAgentSettings } from "@/lib/agent-settings";
import {
  createContentAnalysisStats,
  maybeAnalyzeContentItem,
  updateContentAnalysisStats,
} from "@/lib/content-analysis-agent";
import {
  createReelTranscriptionStats,
  maybeTranscribeReel,
  updateReelTranscriptionStats,
} from "@/lib/reel-transcription";
import { toContentItem } from "@/lib/supabase/mappers";
import { fetchContentRows } from "@/lib/supabase/queries";
import { listPlatformConnections } from "@/lib/supabase/repository";
import { withLangfuseTrace } from "@/lib/observability/langfuse";
import type { ContentItem, PlatformFilter } from "@/lib/types";

type AIBackfillFilters = {
  platform?: PlatformFilter;
  connectionId?: string | null;
  limit?: number;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

async function getBackfillBatch(filters: AIBackfillFilters, offset: number, limit: number) {
  const rows = await fetchContentRows({
    platform: filters.platform,
    connectionId: filters.connectionId,
    offset,
    limit,
  });

  return {
    rows: rows.length,
    items: rows.map(toContentItem).filter(isContentEligibleForAIBackfill),
  };
}

async function processBackfillItem(
  item: ContentItem,
  settings: { autoAnalysisEnabled: boolean; autoTranscriptionEnabled: boolean },
  transcriptionStats: ReturnType<typeof createReelTranscriptionStats>,
  analysisStats: ReturnType<typeof createContentAnalysisStats>,
) {
  if (settings.autoTranscriptionEnabled) {
    try {
      const transcriptionResult = await maybeTranscribeReel(item);
      updateReelTranscriptionStats(transcriptionStats, item, transcriptionResult);
    } catch (error) {
      const message = getErrorMessage(error);
      transcriptionStats.failed += 1;
      if (transcriptionStats.errors.length < 5) {
        transcriptionStats.errors.push({
          contentItemId: item.id,
          externalId: item.externalId,
          error: message,
        });
      }
      console.warn(
        `No se pudo transcribir contenido ${item.platform}:${item.externalId}: ${message}`,
      );
    }
  } else {
    transcriptionStats.disabled += 1;
  }

  if (settings.autoAnalysisEnabled) {
    try {
      const analysisResult = await maybeAnalyzeContentItem(item);
      updateContentAnalysisStats(analysisStats, item, analysisResult);

      if (analysisResult.outcome === "failed" && analysisResult.error) {
        console.warn(
          `No se pudo analizar contenido ${item.platform}:${item.externalId}: ${analysisResult.error}`,
        );
      }
    } catch (error) {
      const message = getErrorMessage(error);
      analysisStats.failed += 1;
      if (analysisStats.errors.length < 5) {
        analysisStats.errors.push({
          contentItemId: item.id,
          externalId: item.externalId,
          error: message,
        });
      }
      console.warn(
        `No se pudo actualizar analisis para ${item.platform}:${item.externalId}: ${message}`,
      );
    }
  } else {
    analysisStats.disabled += 1;
  }
}

export async function runAIBackfill(filters: AIBackfillFilters = {}) {
  return withLangfuseTrace(
    {
      name: "content.ai_backfill",
      input: filters,
      metadata: {
        agentType: "content_analysis",
        platform: filters.platform ?? "all",
        connectionId: filters.connectionId ?? "all",
      },
      tags: ["agent:content_analysis", "feature:ai-backfill"],
      output: (result) => ({
        scanned: result.scanned,
        targeted: result.targeted,
        transcriptionReady: result.transcription.ready,
        analysisReady: result.analysis.ready,
        analysisFailed: result.analysis.failed,
      }),
    },
    () => runAIBackfillInternal(filters),
  );
}

async function runAIBackfillInternal(filters: AIBackfillFilters = {}) {
  const limit = filters.limit ?? 25;
  const startedAt = new Date().toISOString();
  const transcription = createReelTranscriptionStats();
  const analysis = createContentAnalysisStats();
  const connections = await listPlatformConnections({
    includeDisconnected: true,
    includeBriefs: false,
  });
  const settingsByConnection = new Map(
    connections.map((connection) => [
      connection.id,
      resolveAutomaticAgentSettings(connection),
    ]),
  );
  const defaultSettings = resolveAutomaticAgentSettings();
  let offset = 0;
  let scanned = 0;
  let targeted = 0;

  while (true) {
    const batch = await getBackfillBatch(filters, offset, limit);
    scanned += batch.rows;

    if (batch.rows === 0) {
      break;
    }

    for (const item of batch.items) {
      targeted += 1;
      await processBackfillItem(
        item,
        (item.connectionId ? settingsByConnection.get(item.connectionId) : undefined) ??
          defaultSettings,
        transcription,
        analysis,
      );
    }

    if (batch.rows < limit) {
      break;
    }

    offset += limit;
  }

  return {
    startedAt,
    completedAt: new Date().toISOString(),
    filters: {
      platform: filters.platform ?? "all",
      connectionId: filters.connectionId ?? null,
      limit,
    },
    scanned,
    targeted,
    transcription,
    analysis,
  };
}
