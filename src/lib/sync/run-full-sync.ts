import { fetchInstagramComments, fetchInstagramContent } from "@/lib/clients/instagram";
import { resolveAutomaticAgentSettings } from "@/lib/agent-settings";
import { fetchInstagramDailyInsights } from "@/lib/clients/instagram-daily";
import { fetchTikTokVideos } from "@/lib/clients/tiktok";
import { fetchTikTokDailyInsights } from "@/lib/clients/tiktok-daily";
import { fetchYouTubeVideos } from "@/lib/clients/youtube";
import { fetchYouTubeDailyInsights } from "@/lib/clients/youtube-daily";
import {
  createContentAnalysisStats,
  maybeAnalyzeContentItem,
  updateContentAnalysisStats,
} from "@/lib/content-analysis-agent";
import { createReelTranscriptionStats, maybeTranscribeReel, updateReelTranscriptionStats } from "@/lib/reel-transcription";
import { refreshPlatformConnectionTokens } from "@/lib/oauth";
import {
  BACKFILL_START_ISO,
  INSTAGRAM_ACCOUNT_DAILY_LOOKBACK_DAYS,
} from "@/lib/constants";
import {
  createSyncRun,
  deleteContentItemsByExternalIds,
  finishSyncRun,
  getActivePlatformConnections,
  getPlatformConnectionCredentials,
  updatePlatformConnectionTokens,
  upsertPlatformComments,
  upsertContentItem,
  upsertMetricSnapshot,
  upsertTextAsset,
} from "@/lib/supabase/repository";
import { env, hasInstagramLegacyConfig, hasSupabaseConfig } from "@/lib/env";
import {
  getLatestPlatformDailyInsightDate,
  getPreviousPlatformDailyInsight,
  upsertPlatformDailyInsights,
} from "@/lib/supabase/platform-daily-insights";
import { withLangfuseTrace } from "@/lib/observability/langfuse";
import { SecurityError } from "@/lib/security-error";
import type {
  NormalizedContentInput,
  Platform,
  PlatformConnection,
  PlatformConnectionCredentials,
  PlatformFilter,
} from "@/lib/types";

const INSTAGRAM_DAILY_REFRESH_OVERLAP_DAYS = Math.min(
  INSTAGRAM_ACCOUNT_DAILY_LOOKBACK_DAYS,
  45,
);

type SyncExecutionMode = "full" | "dashboard";

type SyncExecutionOptions = {
  mode: SyncExecutionMode;
};

type FetchedConnectionContent = {
  items: NormalizedContentInput[];
  excludedYouTubeVideoIds?: string[];
  youtubeAnalytics?: {
    requestedVideoCount: number;
    reportedVideoCount: number;
    warning: string | null;
  };
};

export function formatSyncWarning(
  platform: Platform,
  accountExternalId: string,
  kind: "invalid-credentials" | "daily-insights" | "content",
) {
  const connection = `${platform}:${accountExternalId}`;

  if (kind === "invalid-credentials") {
    return `${connection}: credenciales invalidas \u2014 conexion omitida`;
  }

  return kind === "daily-insights"
    ? `${connection}: datos diarios no actualizados`
    : `${connection}: contenido no actualizado`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

function isConnectionSecretError(error: unknown) {
  const message = getErrorMessage(error);
  return (
    message.includes("Unsupported state or unable to authenticate data") ||
    message.includes("Encrypted secret has an invalid format")
  );
}

function toConnectionSecretError(connection: PlatformConnection, error: unknown) {
  const connectionLabel = connection.accountUsername
    ? `@${connection.accountUsername}`
    : connection.displayName ?? connection.accountExternalId;

  console.error(
    `[sync-connection-secret:${connection.id}] No se pudieron descifrar las credenciales de ${connection.platform}:${connectionLabel}`,
    error,
  );

  return new SecurityError(
    400,
    `La conexion ${connection.platform} ${connectionLabel} no se puede descifrar con la configuracion actual. Desconectala y volvela a conectar, o revisa CONNECTION_ENCRYPTION_SECRET en Vercel.`,
  );
}

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function getInstagramDailyRefreshStart(latestInsightDate: string | null) {
  if (!latestInsightDate) {
    return null;
  }

  const parsed = new Date(latestInsightDate + "T00:00:00.000Z");
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  parsed.setUTCDate(parsed.getUTCDate() - INSTAGRAM_DAILY_REFRESH_OVERLAP_DAYS);
  return startOfUtcDay(parsed);
}

async function persistItem(item: NormalizedContentInput) {
  const persisted = await upsertContentItem(item);
  const capturedAt = new Date().toISOString();

  await upsertMetricSnapshot(
    persisted.id,
    item.platform,
    capturedAt,
    item.metrics,
    item.rawPayload,
  );

  for (const textAsset of item.textAssets) {
    await upsertTextAsset(
      persisted.id,
      textAsset.sourceType,
      textAsset.content,
      textAsset.language ?? null,
      textAsset.rawPayload ?? {},
    );
  }

  return persisted;
}

async function updateTranscriptionWithoutBlockingSync(
  persisted: Awaited<ReturnType<typeof persistItem>>,
  transcriptionStats: ReturnType<typeof createReelTranscriptionStats>,
) {
  try {
    const transcriptionResult = await maybeTranscribeReel(persisted);
    updateReelTranscriptionStats(transcriptionStats, persisted, transcriptionResult);
  } catch (error) {
    const message = getErrorMessage(error);
    transcriptionStats.failed += 1;
    if (transcriptionStats.errors.length < 5) {
      transcriptionStats.errors.push({
        contentItemId: persisted.id,
        externalId: persisted.externalId,
        error: message,
      });
    }
    console.warn(
      `No se pudo actualizar transcripcion para ${persisted.platform}:${persisted.externalId}: ${message}`,
    );
  }
}

async function updateAnalysisWithoutBlockingSync(
  persisted: Awaited<ReturnType<typeof persistItem>>,
  analysisStats: ReturnType<typeof createContentAnalysisStats>,
) {
  try {
    const analysisResult = await maybeAnalyzeContentItem(persisted);
    updateContentAnalysisStats(analysisStats, persisted, analysisResult);

    if (analysisResult.outcome === "failed" && analysisResult.error) {
      console.warn(
        `No se pudo analizar contenido para ${persisted.platform}:${persisted.externalId}: ${analysisResult.error}`,
      );
    }
  } catch (error) {
    const message = getErrorMessage(error);
    analysisStats.failed += 1;
    if (analysisStats.errors.length < 5) {
      analysisStats.errors.push({
        contentItemId: persisted.id,
        externalId: persisted.externalId,
        error: message,
      });
    }
    console.warn(
      `No se pudo actualizar analisis para ${persisted.platform}:${persisted.externalId}: ${message}`,
    );
  }
}

async function getConnectionWithFreshTokens(connection: PlatformConnection) {
  if (connection.id === "legacy-instagram-env") {
    return connection as PlatformConnectionCredentials;
  }

  let fullConnection: PlatformConnectionCredentials | null;

  try {
    fullConnection = await getPlatformConnectionCredentials(connection.id);
  } catch (error) {
    if (isConnectionSecretError(error)) {
      throw toConnectionSecretError(connection, error);
    }

    throw error;
  }

  if (!fullConnection) {
    throw new Error(`No se encontro la conexion ${connection.id}.`);
  }

  const refreshedTokens = await refreshPlatformConnectionTokens(fullConnection);

  if (!refreshedTokens) {
    return fullConnection;
  }

  await updatePlatformConnectionTokens(fullConnection.id, refreshedTokens);

  return {
    ...fullConnection,
    ...refreshedTokens,
  } satisfies PlatformConnectionCredentials;
}

async function fetchConnectionContent(connection: PlatformConnectionCredentials) {
  switch (connection.platform) {
    case "instagram":
      return { items: await fetchInstagramContent(connection) } satisfies FetchedConnectionContent;
    case "tiktok":
      return { items: await fetchTikTokVideos(connection) } satisfies FetchedConnectionContent;
    case "youtube": {
      const result = await fetchYouTubeVideos(connection);
      return {
        items: result.items,
        excludedYouTubeVideoIds: result.excludedVideoIds,
        youtubeAnalytics: result.analytics,
      } satisfies FetchedConnectionContent;
    }
    default:
      throw new Error(`Unsupported platform: ${connection.platform satisfies never}`);
  }
}

async function refreshConnectionDailyInsights(connection: PlatformConnectionCredentials) {
  if (connection.platform === "instagram" && connection.id !== "legacy-instagram-env") {
    const latestInsightDate = await getLatestPlatformDailyInsightDate(
      "instagram",
      connection.id,
    );
    const dailyInsights = await fetchInstagramDailyInsights(connection, {
      since: getInstagramDailyRefreshStart(latestInsightDate),
    });
    await upsertPlatformDailyInsights(dailyInsights);
    return;
  }

  if (connection.platform === "youtube") {
    const latestInsightDate = await getLatestPlatformDailyInsightDate("youtube", connection.id);
    const dailyInsights = await fetchYouTubeDailyInsights(connection, {
      since: latestInsightDate,
    });
    await upsertPlatformDailyInsights(dailyInsights);
    return;
  }

  if (connection.platform === "tiktok") {
    const dailyInsights = await fetchTikTokDailyInsights(connection);
    const current = dailyInsights[0];

    if (current) {
      const previous = await getPreviousPlatformDailyInsight(
        "tiktok",
        connection.id,
        current.insightDate,
      );
      const previousFollowerCount = previous?.follower_count;
      current.follows =
        typeof current.followerCount === "number" && typeof previousFollowerCount === "number"
          ? current.followerCount - previousFollowerCount
          : null;
    }

    await upsertPlatformDailyInsights(dailyInsights);
  }
}

async function syncConnection(
  connection: PlatformConnectionCredentials,
  fetchedContent: FetchedConnectionContent,
  options: SyncExecutionOptions,
) {
  const { items, excludedYouTubeVideoIds = [], youtubeAnalytics = null } = fetchedContent;
  const backfillStart = BACKFILL_START_ISO;
  const isLegacy = connection.id === "legacy-instagram-env";
  const isLegacyConnection = isLegacy;
  const syncRun = await createSyncRun(connection.platform, isLegacyConnection ? null : connection.id, {
    backfillStart: backfillStart,
    connectionId: isLegacyConnection ? null : connection.id,
    accountExternalId: connection.accountExternalId,
    displayName: connection.displayName,
    syncMode: options.mode,
  });
  let itemsSucceeded = 0;
  let excludedItemsRemoved = 0;
  const transcriptionStats = createReelTranscriptionStats();
  const analysisStats = createContentAnalysisStats();
  const agentSettings = resolveAutomaticAgentSettings(connection);

  try {
    const runAi = options.mode === "full";

    if (connection.platform === "youtube") {
      excludedItemsRemoved = await deleteContentItemsByExternalIds(
        "youtube",
        connection.id,
        excludedYouTubeVideoIds,
      );
    }

    for (const item of items) {
      const persisted = await persistItem(item);

      // Dashboard refresh: content + metrics + daily insights only.
      // Transcription/analysis run on full sync and AI backfill paths.
      if (runAi) {
        if (agentSettings.autoTranscriptionEnabled) {
          await updateTranscriptionWithoutBlockingSync(persisted, transcriptionStats);
        } else {
          transcriptionStats.disabled += 1;
        }

        if (agentSettings.autoAnalysisEnabled) {
          await updateAnalysisWithoutBlockingSync(persisted, analysisStats);
        } else {
          analysisStats.disabled += 1;
        }
      }

      if (connection.platform === "instagram" && connection.id !== "legacy-instagram-env") {
        const commentCount = typeof item.metrics.comments === "number" ? item.metrics.comments : 0;
        if (commentCount > 0) {
          try {
            const comments = await fetchInstagramComments(connection, persisted.id, item.externalId);
            await upsertPlatformComments(comments);
          } catch (error) {
            console.warn(`No se pudieron sincronizar comentarios para instagram:${item.externalId}: ${getErrorMessage(error)}`);
          }
        }
      }

      itemsSucceeded += 1;
    }

    await finishSyncRun(syncRun.id, {
      status: "completed",
      itemsProcessed: items.length,
      itemsSucceeded,
      metadata: {
        backfillStart: backfillStart,
        syncMode: options.mode,
        connectionId: isLegacyConnection ? null : connection.id,
        accountExternalId: connection.accountExternalId,
        displayName: connection.displayName,
        excludedItemsRemoved,
        youtubeAnalytics,
        transcription: transcriptionStats,
        analysis: analysisStats,
      },
    });

    return {
      platform: connection.platform,
      connectionId: connection.id,
      displayName: connection.displayName,
      itemsProcessed: items.length,
      itemsSucceeded,
      warnings: youtubeAnalytics?.warning ? [youtubeAnalytics.warning] : [],
    };
  } catch (error) {
    await finishSyncRun(syncRun.id, {
      status: "failed",
      itemsProcessed: items.length,
      itemsSucceeded,
      errorMessage: error instanceof Error ? error.message : "Unknown sync error",
      metadata: {
        backfillStart: backfillStart,
        syncMode: options.mode,
        connectionId: isLegacyConnection ? null : connection.id,
        accountExternalId: connection.accountExternalId,
        displayName: connection.displayName,
        excludedItemsRemoved,
        youtubeAnalytics,
        transcription: transcriptionStats,
        analysis: analysisStats,
      },
    });

    throw error;
  }
}

async function recordConnectionContentFailure(
  connection: PlatformConnectionCredentials,
  options: SyncExecutionOptions,
  error: unknown,
) {
  const syncRun = await createSyncRun(connection.platform, connection.id, {
    accountExternalId: connection.accountExternalId,
    connectionId: connection.id,
    displayName: connection.displayName,
    syncMode: options.mode,
  });

  await finishSyncRun(syncRun.id, {
    status: "failed",
    itemsProcessed: 0,
    itemsSucceeded: 0,
    errorMessage: getErrorMessage(error),
    metadata: {
      accountExternalId: connection.accountExternalId,
      connectionId: connection.id,
      displayName: connection.displayName,
      syncMode: options.mode,
    },
  });
}

function getLegacyInstagramConnection() {
  if (!hasInstagramLegacyConfig()) {
    return null;
  }

  return {
    id: "legacy-instagram-env",
    platform: "instagram",
    accountExternalId: env.INSTAGRAM_USER_ID!,
    accountUsername: null,
    displayName: "Instagram manual",
    accessToken: env.INSTAGRAM_ACCESS_TOKEN!,
    refreshToken: null,
    tokenExpiresAt: null,
    refreshTokenExpiresAt: null,
    scopes: [],
    status: "active",
    autoAnalysisEnabled: true,
    autoTranscriptionEnabled: true,
    rawProfile: {},
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  } satisfies PlatformConnectionCredentials;
}

async function runSync(
  filters: {
    platform?: PlatformFilter;
    connectionId?: string | null;
  } | undefined,
  options: SyncExecutionOptions,
) {
  return withLangfuseTrace(
    {
      name: options.mode === "dashboard" ? "content.dashboard_sync" : "content.full_sync",
      input: { filters, mode: options.mode },
      metadata: {
        agentType: "content_analysis",
        feature: "content_sync",
        mode: options.mode,
        platform: filters?.platform ?? "all",
        connectionId: filters?.connectionId ?? "all",
      },
      tags: ["agent:content_analysis", "feature:sync", `mode:${options.mode}`],
      output: (result) => ({
        results: result.results.length,
        filters: result.filters,
      }),
    },
    () => runSyncInternal(filters, options),
  );
}

async function runSyncInternal(
  filters: {
    platform?: PlatformFilter;
    connectionId?: string | null;
  } | undefined,
  options: SyncExecutionOptions,
) {
  const startedAt = new Date().toISOString();
  const connectionErrors: Error[] = [];
  const warnings: string[] = [];

  const normalizedFilters = {
    platform: filters?.platform ?? "all",
    connectionId: filters?.connectionId ?? null,
  } as const;

  if (!hasSupabaseConfig()) {
    throw new Error("Falta configurar Supabase antes de sincronizar.");
  }

  const activeConnections = await getActivePlatformConnections(normalizedFilters);

  if (activeConnections.length === 0) {
    const legacyConnection = getLegacyInstagramConnection();

    if (
      legacyConnection &&
      (normalizedFilters.platform === "all" || normalizedFilters.platform === "instagram") &&
      !normalizedFilters.connectionId
    ) {
      const items = await fetchInstagramContent(legacyConnection);
      const result = await syncConnection(legacyConnection, { items }, options);

      return {
        startedAt,
        filters: normalizedFilters,
        results: [result],
        warnings,
      };
    }

    throw new Error("No hay cuentas conectadas para sincronizar.");
  }

  const results = [];

  for (const connection of activeConnections) {
    let hydratedConnection: PlatformConnectionCredentials;

    try {
      hydratedConnection = await getConnectionWithFreshTokens(connection);
    } catch (error) {
      connectionErrors.push(error instanceof Error ? error : new Error(getErrorMessage(error)));
      console.warn(
        `Se omitio la conexion ${connection.platform}:${connection.accountExternalId} por error de credenciales: ${getErrorMessage(error)}`,
      );
      warnings.push(
        formatSyncWarning(connection.platform, connection.accountExternalId, "invalid-credentials"),
      );
      continue;
    }

    try {
      await refreshConnectionDailyInsights(hydratedConnection);
    } catch (error) {
      console.warn(
        `No se pudieron actualizar los datos diarios para ${hydratedConnection.platform}:${hydratedConnection.accountExternalId}: ${getErrorMessage(error)}`,
      );
      warnings.push(
        formatSyncWarning(
          hydratedConnection.platform,
          hydratedConnection.accountExternalId,
          "daily-insights",
        ),
      );
    }

    try {
      const fetchedContent = await fetchConnectionContent(hydratedConnection);
      const result = await syncConnection(hydratedConnection, fetchedContent, options);
      results.push(result);
      warnings.push(...result.warnings);
    } catch (error) {
      connectionErrors.push(error instanceof Error ? error : new Error(getErrorMessage(error)));
      console.warn(
        `No se pudo sincronizar contenido para ${hydratedConnection.platform}:${hydratedConnection.accountExternalId}: ${getErrorMessage(error)}`,
      );
      warnings.push(
        formatSyncWarning(hydratedConnection.platform, hydratedConnection.accountExternalId, "content"),
      );

      try {
        await recordConnectionContentFailure(hydratedConnection, options, error);
      } catch (recordError) {
        console.warn(
          `No se pudo registrar el fallo de sync para ${hydratedConnection.platform}:${hydratedConnection.accountExternalId}: ${getErrorMessage(recordError)}`,
        );
      }
    }
  }

  if (results.length === 0 && connectionErrors.length > 0) {
    throw connectionErrors[0];
  }

  return {
    startedAt,
    filters: normalizedFilters,
    results,
    warnings,
  };
}

export async function runFullSync(filters?: {
  platform?: PlatformFilter;
  connectionId?: string | null;
}) {
  return runSync(filters, { mode: "full" });
}

export async function runDashboardSync(filters?: {
  platform?: PlatformFilter;
  connectionId?: string | null;
}) {
  return runSync(filters, { mode: "dashboard" });
}
