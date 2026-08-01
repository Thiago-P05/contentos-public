import { getDefaultPlatformConnectionBriefFields } from "@/lib/connection-briefs";
import { env } from "@/lib/env";
import type { NormalizedCompetitorPostInput, NormalizedCompetitorProfileInput } from "@/lib/competition/types";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { assertNoError } from "@/lib/supabase/errors";
import {
  toAutomationOutput,
  toAutomationRun,
  toAutomationRunItem,
  toCompetitorAnalysisRun,
  toCompetitorProfile,
  toContentItem,
  toPlatformConnection,
  toPlatformConnectionBrief,
  toSyncRun,
} from "@/lib/supabase/mappers";
import type {
  ConnectionBriefRow,
  ConnectionRow,
  ContentRow,
  SyncRunRow,
  AutomationOutputRow,
  AutomationRunRow,
  AutomationRunItemRow,
  CompetitorAnalysisRunRow,
  CompetitorProfileRow,
} from "@/lib/supabase/types";
import { encryptSecret } from "@/lib/secure";
import { serializeVector } from "@/lib/utils";
import type {
  AnalysisEvidenceMode,
  AnalysisStatus,
  AutomationOutput,
  AutomationOutputType,
  AutomationRunItem,
  AutomationRunItemStatus,
  AutomationRunStatus,
  AutomationType,
  MetricMap,
  PlatformConnectionBriefFields,
  NormalizedContentInput,
  Platform,
  TranscriptionStatus,
  TextSourceType,
} from "@/lib/types";

function toConnectionBriefPayload(connectionId: string, brief: PlatformConnectionBriefFields) {
  return {
    connection_id: connectionId,
    offer: brief.offer,
    ideal_customer_profile: brief.idealCustomerProfile,
    core_pain: brief.corePain,
    desired_outcome: brief.desiredOutcome,
    differentiator: brief.differentiator,
    tone_guidelines: brief.toneGuidelines,
    avoid_guidelines: brief.avoidGuidelines,
    primary_cta: brief.primaryCta,
    notes: brief.notes,
  } as never;
}

function sanitizeConnectionRawProfile(value: Record<string, unknown>) {
  const blockedKeys = new Set(["access_token", "refresh_token", "id_token", "token"]);

  function sanitize(current: unknown): unknown {
    if (Array.isArray(current)) {
      return current.map(sanitize);
    }

    if (!current || typeof current !== "object") {
      return current;
    }

    return Object.fromEntries(
      Object.entries(current as Record<string, unknown>)
        .filter(([key]) => !blockedKeys.has(key))
        .map(([key, nestedValue]) => [key, sanitize(nestedValue)]),
    );
  }

  return sanitize(value) as Record<string, unknown>;
}

export async function upsertPlatformConnection(input: {
  platform: Platform;
  accountExternalId: string;
  accountUsername: string | null;
  displayName: string | null;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: string | null;
  refreshTokenExpiresAt: string | null;
  scopes: string[];
  rawProfile: Record<string, unknown>;
}) {
  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase
    .from("platform_connections")
    .select("refresh_token_encrypted")
    .eq("platform", input.platform)
    .eq("account_external_id", input.accountExternalId)
    .maybeSingle();
  const existingRefreshToken = (existing as { refresh_token_encrypted?: string | null } | null)
    ?.refresh_token_encrypted;
  const payload = {
    platform: input.platform,
    account_external_id: input.accountExternalId,
    account_username: input.accountUsername,
    display_name: input.displayName,
    access_token_encrypted: encryptSecret(input.accessToken),
    refresh_token_encrypted: input.refreshToken
      ? encryptSecret(input.refreshToken)
      : existingRefreshToken ?? null,
    token_expires_at: input.tokenExpiresAt,
    refresh_token_expires_at: input.refreshTokenExpiresAt,
    scopes: input.scopes,
    status: "active",
    disconnected_at: null,
    raw_profile: sanitizeConnectionRawProfile(input.rawProfile),
  } as never;
  const { data, error } = await supabase
    .from("platform_connections")
    .upsert(payload, {
      onConflict: "platform,account_external_id",
    })
    .select("*")
    .single();

  assertNoError(error);

  const connection = data as unknown as ConnectionRow;

  await ensurePlatformConnectionBrief(connection.id);

  return toPlatformConnection(connection);
}

export async function ensurePlatformConnectionBrief(
  connectionId: string,
  brief: PlatformConnectionBriefFields = getDefaultPlatformConnectionBriefFields(),
) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("platform_connection_briefs")
    .upsert(toConnectionBriefPayload(connectionId, brief), {
      onConflict: "connection_id",
      ignoreDuplicates: true,
    });

  assertNoError(error);
}

export async function upsertPlatformConnectionBrief(
  connectionId: string,
  brief: PlatformConnectionBriefFields,
) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("platform_connection_briefs")
    .upsert(toConnectionBriefPayload(connectionId, brief), {
      onConflict: "connection_id",
    })
    .select("*")
    .single();

  assertNoError(error);
  return toPlatformConnectionBrief(data as unknown as ConnectionBriefRow);
}

export async function updatePlatformConnectionTokens(
  connectionId: string,
  payload: {
    accessToken: string;
    refreshToken: string | null;
    tokenExpiresAt: string | null;
    refreshTokenExpiresAt: string | null;
  },
) {
  const supabase = getSupabaseAdmin();
  const updatePayload = {
    access_token_encrypted: encryptSecret(payload.accessToken),
    refresh_token_encrypted: payload.refreshToken ? encryptSecret(payload.refreshToken) : null,
    token_expires_at: payload.tokenExpiresAt,
    refresh_token_expires_at: payload.refreshTokenExpiresAt,
    status: "active",
    disconnected_at: null,
  } as never;
  const { error } = await supabase
    .from("platform_connections")
    .update(updatePayload)
    .eq("id", connectionId);

  assertNoError(error);
}

export async function updatePlatformConnectionAgentSettings(
  connectionId: string,
  settings: {
    autoAnalysisEnabled: boolean;
    autoTranscriptionEnabled: boolean;
  },
) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("platform_connections")
    .update({
      auto_analysis_enabled: settings.autoAnalysisEnabled,
      auto_transcription_enabled: settings.autoTranscriptionEnabled,
    } as never)
    .eq("id", connectionId)
    .select("*")
    .maybeSingle();

  assertNoError(error);
  return data ? toPlatformConnection(data as unknown as ConnectionRow) : null;
}

export async function disconnectPlatformConnection(connectionId: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("platform_connections")
    .update({
      status: "disconnected",
      access_token_encrypted: null,
      refresh_token_encrypted: null,
      token_expires_at: null,
      refresh_token_expires_at: null,
      disconnected_at: new Date().toISOString(),
    } as never)
    .eq("id", connectionId);

  assertNoError(error);
}

export async function disconnectTikTokConnectionByExternalId(accountExternalId: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("platform_connections")
    .update({
      status: "disconnected",
      access_token_encrypted: null,
      refresh_token_encrypted: null,
      token_expires_at: null,
      refresh_token_expires_at: null,
      disconnected_at: new Date().toISOString(),
    } as never)
    .eq("platform", "tiktok")
    .eq("account_external_id", accountExternalId);

  assertNoError(error);
}

export async function deletePlatformConnectionAndData(connectionId: string) {
  const supabase = getSupabaseAdmin();

  const { error: commentsError } = await supabase
    .from("platform_comments")
    .delete()
    .eq("connection_id", connectionId);
  assertNoError(commentsError);

  const { error: dailyInsightsError } = await supabase
    .from("platform_daily_insights")
    .delete()
    .eq("connection_id", connectionId);
  assertNoError(dailyInsightsError);

  const { error: syncRunsError } = await supabase
    .from("sync_runs")
    .delete()
    .eq("connection_id", connectionId);
  assertNoError(syncRunsError);

  const { error: contentError } = await supabase
    .from("content_items")
    .delete()
    .eq("connection_id", connectionId);
  assertNoError(contentError);

  const { error: connectionError } = await supabase
    .from("platform_connections")
    .delete()
    .eq("id", connectionId);
  assertNoError(connectionError);
}

export async function createSyncRun(
  platform: Platform,
  connectionId: string | null,
  metadata: Record<string, unknown> = {},
) {
  const supabase = getSupabaseAdmin();
  const staleSyncPayload = {
    status: "failed",
    completed_at: new Date().toISOString(),
    error_message: "Sync anterior interrumpida antes de completar.",
  } as never;

  let staleQuery = supabase
    .from("sync_runs")
    .update(staleSyncPayload)
    .eq("platform", platform)
    .eq("status", "running");

  staleQuery = connectionId
    ? staleQuery.eq("connection_id", connectionId)
    : staleQuery.is("connection_id", null);

  const { error: staleError } = await staleQuery;

  assertNoError(staleError);

  const syncRunPayload = {
    platform,
    connection_id: connectionId,
    status: "running",
    metadata,
  } as never;
  const { data, error } = await supabase
    .from("sync_runs")
    .insert(syncRunPayload)
    .select("*")
    .single();

  assertNoError(error);
  return toSyncRun(data as unknown as SyncRunRow);
}

export async function finishSyncRun(
  syncRunId: string,
  payload: {
    status: "completed" | "failed";
    itemsProcessed: number;
    itemsSucceeded: number;
    errorMessage?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  const supabase = getSupabaseAdmin();
  const syncRunUpdate = {
    status: payload.status,
    completed_at: new Date().toISOString(),
    items_processed: payload.itemsProcessed,
    items_succeeded: payload.itemsSucceeded,
    error_message: payload.errorMessage ?? null,
    metadata: payload.metadata ?? {},
  } as never;
  const { error } = await supabase
    .from("sync_runs")
    .update(syncRunUpdate)
    .eq("id", syncRunId);

  assertNoError(error);

  // Invalidate dashboard overview Redis keys via generation bump (fail-open).
  if (payload.status === "completed") {
    const { bumpDashboardCacheGeneration } = await import("@/lib/cache/read-cache");
    await bumpDashboardCacheGeneration();
  }
}

export async function upsertContentItem(item: NormalizedContentInput) {
  const supabase = getSupabaseAdmin();
  const contentItemPayload = {
    platform: item.platform,
    connection_id: item.connectionId,
    external_id: item.externalId,
    published_at: item.publishedAt,
    title: item.title,
    description: item.description,
    caption: item.caption,
    duration_seconds: item.durationSeconds,
    permalink: item.permalink,
    thumbnail_url: item.thumbnailUrl,
    media_url: item.mediaUrl,
    status: "published",
    raw_payload: item.rawPayload,
  } as never;
  const { data, error } = await supabase
    .from("content_items")
    .upsert(contentItemPayload, {
      onConflict: "platform,external_id",
    })
    .select("*")
    .single();

  assertNoError(error);
  return toContentItem(data as unknown as ContentRow);
}

export async function deleteContentItemsByExternalIds(
  platform: Platform,
  connectionId: string,
  externalIds: string[],
) {
  if (externalIds.length === 0) {
    return 0;
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("content_items")
    .delete()
    .eq("platform", platform)
    .eq("connection_id", connectionId)
    .in("external_id", externalIds)
    .select("id");

  assertNoError(error);
  return data?.length ?? 0;
}

export async function setAnalysisState(
  contentItemId: string,
  payload: {
    analysisStatus: AnalysisStatus;
    analysisInputText?: string | null;
    rawPayload?: Record<string, unknown>;
    expectedProcessingStartedAt?: string;
  },
) {
  const supabase = getSupabaseAdmin();
  const analysisPayload = {
    analysis_status: payload.analysisStatus,
    analysis_processing_started_at:
      payload.analysisStatus === "processing" ? new Date().toISOString() : null,
    ...(payload.rawPayload ? { raw_payload: payload.rawPayload } : {}),
    analysis_input_text: payload.analysisInputText ?? null,
  } as never;
  let query = supabase
    .from("content_items")
    .update(analysisPayload)
    .eq("id", contentItemId);

  if (payload.expectedProcessingStartedAt) {
    query = query.eq("analysis_processing_started_at", payload.expectedProcessingStartedAt);
  }

  const { data, error } = await query.select("id").maybeSingle();
  assertNoError(error);
  return Boolean(data);
}

export async function claimContentAnalysisProcessing(
  contentItemId: string,
  expected: {
    status: AnalysisStatus;
    processingStartedAt: string | null;
  },
) {
  const supabase = getSupabaseAdmin();
  const claimedAt = new Date().toISOString();
  let query = supabase
    .from("content_items")
    .update({
      analysis_status: "processing",
      analysis_processing_started_at: claimedAt,
    } as never)
    .eq("id", contentItemId)
    .eq("analysis_status", expected.status);

  if (expected.status === "processing") {
    query = expected.processingStartedAt
      ? query.eq("analysis_processing_started_at", expected.processingStartedAt)
      : query.is("analysis_processing_started_at", null);
  }

  const { data, error } = await query.select("id").maybeSingle();
  assertNoError(error);
  return data ? claimedAt : null;
}

export async function setTranscriptionState(
  contentItemId: string,
  payload: {
    transcriptionStatus: TranscriptionStatus;
    transcriptionModel?: string | null;
    transcriptionError?: string | null;
    transcriptionUpdatedAt?: string | null;
    expectedProcessingUpdatedAt?: string;
  },
) {
  const supabase = getSupabaseAdmin();
  const transcriptionPayload = {
    transcription_status: payload.transcriptionStatus,
    transcription_model: payload.transcriptionModel ?? null,
    transcription_error: payload.transcriptionError ?? null,
    transcription_updated_at: payload.transcriptionUpdatedAt ?? new Date().toISOString(),
  } as never;
  let query = supabase
    .from("content_items")
    .update(transcriptionPayload)
    .eq("id", contentItemId);

  if (payload.expectedProcessingUpdatedAt) {
    query = query.eq("transcription_updated_at", payload.expectedProcessingUpdatedAt);
  }

  const { data, error } = await query.select("id").maybeSingle();
  assertNoError(error);
  return Boolean(data);
}

export async function claimContentTranscriptionProcessing(
  contentItemId: string,
  expected: {
    status: TranscriptionStatus;
    updatedAt: string | null;
  },
) {
  const supabase = getSupabaseAdmin();
  const claimedAt = new Date().toISOString();
  let query = supabase
    .from("content_items")
    .update({
      transcription_status: "processing",
      transcription_model: env.OPENROUTER_TRANSCRIPTION_MODEL,
      transcription_error: null,
      transcription_updated_at: claimedAt,
    } as never)
    .eq("id", contentItemId)
    .eq("transcription_status", expected.status);

  if (expected.status === "processing") {
    query = expected.updatedAt
      ? query.eq("transcription_updated_at", expected.updatedAt)
      : query.is("transcription_updated_at", null);
  }

  const { data, error } = await query.select("id").maybeSingle();
  assertNoError(error);
  return data ? claimedAt : null;
}

export async function upsertMetricSnapshot(
  contentItemId: string,
  platform: Platform,
  capturedAt: string,
  metrics: MetricMap,
  rawPayload: Record<string, unknown>,
) {
  const supabase = getSupabaseAdmin();
  const snapshotPayload = {
    content_item_id: contentItemId,
    source_platform: platform,
    captured_at: capturedAt,
    metrics,
    raw_payload: rawPayload,
  } as never;
  const { error } = await supabase
    .from("content_metric_snapshots")
    .upsert(snapshotPayload, {
      onConflict: "content_item_id,source_platform,captured_at",
    });

  assertNoError(error);
}

export async function upsertTextAsset(
  contentItemId: string,
  sourceType: TextSourceType,
  content: string,
  language: string | null = null,
  rawPayload: Record<string, unknown> = {},
) {
  const supabase = getSupabaseAdmin();
  const textAssetPayload = {
    content_item_id: contentItemId,
    source_type: sourceType,
    content,
    language,
    raw_payload: rawPayload,
  } as never;
  const { error } = await supabase
    .from("content_text_assets")
    .upsert(textAssetPayload, {
      onConflict: "content_item_id,source_type",
    });

  assertNoError(error);
}

export async function upsertInsight(
  contentItemId: string,
  insight: {
    summary: string;
    strengths: string[];
    weaknesses: string[];
    improvements: string[];
    topics: string[];
    hooks: string[];
    hookType: string | null;
    hookAssessment: string | null;
    evidenceMode: AnalysisEvidenceMode;
    confidence: number;
    model: string;
    rawPayload: Record<string, unknown>;
  },
) {
  const supabase = getSupabaseAdmin();
  const insightPayload = {
    content_item_id: contentItemId,
    summary: insight.summary,
    strengths: insight.strengths,
    weaknesses: insight.weaknesses,
    improvements: insight.improvements,
    topics: insight.topics,
    hooks: insight.hooks,
    hook_type: insight.hookType,
    hook_assessment: insight.hookAssessment,
    evidence_mode: insight.evidenceMode,
    confidence: insight.confidence,
    model: insight.model,
    raw_payload: insight.rawPayload,
  } as never;
  const { error } = await supabase.from("ai_insights").upsert(insightPayload, {
    onConflict: "content_item_id",
  });

  assertNoError(error);
}

export async function upsertEmbedding(
  contentItemId: string,
  embedding: number[],
  model: string,
  sourceText: string,
) {
  const supabase = getSupabaseAdmin();
  const embeddingPayload = {
    content_item_id: contentItemId,
    embedding: serializeVector(embedding),
    model,
    source_text: sourceText,
  } as never;
  const { error } = await supabase.from("embeddings").upsert(embeddingPayload, {
    onConflict: "content_item_id",
  });

  assertNoError(error);
}

export async function upsertPlatformComments(
  comments: Array<{
    platform: Platform;
    connectionId: string;
    contentItemId: string;
    externalCommentId: string;
    authorUsername: string | null;
    authorDisplayName: string | null;
    text: string;
    commentedAt: string;
    likeCount: number;
    isReply: boolean;
    parentCommentExternalId: string | null;
    rawPayload: Record<string, unknown>;
  }>,
) {
  if (comments.length === 0) {
    return;
  }

  const supabase = getSupabaseAdmin();
  const payload = comments.map((comment) => ({
    platform: comment.platform,
    connection_id: comment.connectionId,
    content_item_id: comment.contentItemId,
    external_comment_id: comment.externalCommentId,
    author_username: comment.authorUsername,
    author_display_name: comment.authorDisplayName,
    text: comment.text,
    commented_at: comment.commentedAt,
    like_count: comment.likeCount,
    is_reply: comment.isReply,
    parent_comment_external_id: comment.parentCommentExternalId,
    raw_payload: comment.rawPayload,
  })) as never;

  const { error } = await supabase.from("platform_comments").upsert(payload, {
    onConflict: "platform,external_comment_id",
  });

  assertNoError(error);
}

export async function createAutomationRun(input: {
  type: AutomationType;
  title: string;
  status?: AutomationRunStatus;
  sourceFilename?: string | null;
  sourceMimeType?: string | null;
  sourceSizeBytes?: number | null;
  provider?: string;
  providerProjectId?: string | null;
  providerUploadId?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("automation_runs")
    .insert({
      type: input.type,
      status: input.status ?? "created",
      title: input.title,
      source_filename: input.sourceFilename ?? null,
      source_mime_type: input.sourceMimeType ?? null,
      source_size_bytes: input.sourceSizeBytes ?? null,
      provider: input.provider ?? "opusclip",
      provider_project_id: input.providerProjectId ?? null,
      provider_upload_id: input.providerUploadId ?? null,
      error_message: input.errorMessage ?? null,
      metadata: input.metadata ?? {},
    } as never)
    .select("*")
    .single();

  assertNoError(error);
  return toAutomationRun(data as unknown as AutomationRunRow);
}

export async function updateAutomationRun(
  runId: string,
  payload: {
    status?: AutomationRunStatus;
    title?: string;
    providerProjectId?: string | null;
    providerUploadId?: string | null;
    completedAt?: string | null;
    errorMessage?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  const supabase = getSupabaseAdmin();
  const updatePayload = {
    ...(payload.status ? { status: payload.status } : {}),
    ...(payload.title ? { title: payload.title } : {}),
    ...(payload.providerProjectId !== undefined
      ? { provider_project_id: payload.providerProjectId }
      : {}),
    ...(payload.providerUploadId !== undefined ? { provider_upload_id: payload.providerUploadId } : {}),
    ...(payload.completedAt !== undefined ? { completed_at: payload.completedAt } : {}),
    ...(payload.errorMessage !== undefined ? { error_message: payload.errorMessage } : {}),
    ...(payload.metadata ? { metadata: payload.metadata } : {}),
  } as never;

  const { data, error } = await supabase
    .from("automation_runs")
    .update(updatePayload)
    .eq("id", runId)
    .select("*")
    .single();

  assertNoError(error);
  return toAutomationRun(data as unknown as AutomationRunRow);
}

export async function upsertAutomationOutputs(
  runId: string,
  outputs: Array<{
    type?: AutomationOutputType;
    providerOutputId: string;
    title?: string | null;
    description?: string | null;
    hashtags?: string | null;
    previewUrl?: string | null;
    exportUrl?: string | null;
    durationMs?: number | null;
    timeRanges?: unknown[];
    rawPayload?: Record<string, unknown>;
  }>,
): Promise<AutomationOutput[]> {
  if (outputs.length === 0) {
    return [];
  }

  const supabase = getSupabaseAdmin();
  const payload = outputs.map((output) => ({
    run_id: runId,
    type: output.type ?? "opusclip_clip",
    provider_output_id: output.providerOutputId,
    title: output.title ?? null,
    description: output.description ?? null,
    hashtags: output.hashtags ?? null,
    preview_url: output.previewUrl ?? null,
    export_url: output.exportUrl ?? null,
    duration_ms: output.durationMs ?? null,
    time_ranges: output.timeRanges ?? [],
    raw_payload: output.rawPayload ?? {},
  })) as never;

  const { data, error } = await supabase
    .from("automation_outputs")
    .upsert(payload, { onConflict: "run_id,provider_output_id" })
    .select("*");

  assertNoError(error);
  return ((data ?? []) as AutomationOutputRow[]).map(toAutomationOutput);
}

export async function createAutomationRunItems(
  runId: string,
  items: Array<{
    position: number;
    sourceUrl: string;
    normalizedUrl?: string | null;
    status?: AutomationRunItemStatus;
    rawPayload?: Record<string, unknown>;
  }>,
): Promise<AutomationRunItem[]> {
  if (items.length === 0) {
    return [];
  }

  const supabase = getSupabaseAdmin();
  const payload = items.map((item) => ({
    run_id: runId,
    type: "instagram_reel",
    position: item.position,
    source_url: item.sourceUrl,
    normalized_url: item.normalizedUrl ?? null,
    status: item.status ?? "pending",
    raw_payload: item.rawPayload ?? {},
  })) as never;

  const { data, error } = await supabase
    .from("automation_run_items")
    .insert(payload)
    .select("*");

  assertNoError(error);
  return ((data ?? []) as AutomationRunItemRow[]).map(toAutomationRunItem);
}

export async function updateAutomationRunItem(
  itemId: string,
  payload: {
    status?: AutomationRunItemStatus;
    normalizedUrl?: string | null;
    externalId?: string | null;
    title?: string | null;
    caption?: string | null;
    mediaUrl?: string | null;
    thumbnailUrl?: string | null;
    durationSeconds?: number | null;
    metrics?: MetricMap;
    transcript?: string | null;
    analysis?: Record<string, unknown> | null;
    errorMessage?: string | null;
    rawPayload?: Record<string, unknown>;
  },
): Promise<AutomationRunItem> {
  const supabase = getSupabaseAdmin();
  const updatePayload = {
    ...(payload.status ? { status: payload.status } : {}),
    ...(payload.normalizedUrl !== undefined ? { normalized_url: payload.normalizedUrl } : {}),
    ...(payload.externalId !== undefined ? { external_id: payload.externalId } : {}),
    ...(payload.title !== undefined ? { title: payload.title } : {}),
    ...(payload.caption !== undefined ? { caption: payload.caption } : {}),
    ...(payload.mediaUrl !== undefined ? { media_url: payload.mediaUrl } : {}),
    ...(payload.thumbnailUrl !== undefined ? { thumbnail_url: payload.thumbnailUrl } : {}),
    ...(payload.durationSeconds !== undefined ? { duration_seconds: payload.durationSeconds } : {}),
    ...(payload.metrics ? { metrics: payload.metrics } : {}),
    ...(payload.transcript !== undefined ? { transcript: payload.transcript } : {}),
    ...(payload.analysis !== undefined ? { analysis: payload.analysis } : {}),
    ...(payload.errorMessage !== undefined ? { error_message: payload.errorMessage } : {}),
    ...(payload.rawPayload ? { raw_payload: payload.rawPayload } : {}),
  } as never;

  const { data, error } = await supabase
    .from("automation_run_items")
    .update(updatePayload)
    .eq("id", itemId)
    .select("*")
    .single();

  assertNoError(error);
  return toAutomationRunItem(data as unknown as AutomationRunItemRow);
}

export async function upsertCompetitorProfile(input: NormalizedCompetitorProfileInput) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("competitor_profiles")
    .upsert(
      {
        platform: input.platform,
        username: input.username,
        source_url: input.sourceUrl,
        display_name: input.displayName,
        biography: input.biography,
        profile_image_url: input.profileImageUrl,
        follower_count: input.followerCount,
        following_count: input.followingCount,
        posts_count: input.postsCount,
        raw_payload: input.rawPayload,
      } as never,
      {
        onConflict: "platform,username",
      },
    )
    .select("*")
    .single();

  assertNoError(error);
  return toCompetitorProfile(data as unknown as CompetitorProfileRow);
}

export async function createCompetitorAnalysisRun(input: {
  profileId: string;
  requestedUrl: string;
  sourceProvider?: string;
  rawPayload?: Record<string, unknown>;
}) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("competitor_analysis_runs")
    .insert({
      profile_id: input.profileId,
      requested_url: input.requestedUrl,
      status: "running",
      source_provider: input.sourceProvider ?? "apify",
      raw_payload: input.rawPayload ?? {},
    } as never)
    .select("*")
    .single();

  assertNoError(error);
  return toCompetitorAnalysisRun(data as unknown as CompetitorAnalysisRunRow);
}

export async function finishCompetitorAnalysisRun(
  runId: string,
  payload: {
    status: "completed" | "failed";
    errorMessage?: string | null;
    reportPayload?: Record<string, unknown>;
    rawPayload?: Record<string, unknown>;
  },
) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("competitor_analysis_runs")
    .update({
      status: payload.status,
      completed_at: new Date().toISOString(),
      error_message: payload.errorMessage ?? null,
      report_payload: payload.reportPayload ?? {},
      raw_payload: payload.rawPayload ?? {},
    } as never)
    .eq("id", runId);

  assertNoError(error);
}

export async function upsertCompetitorContentSnapshots(
  analysisRunId: string,
  posts: NormalizedCompetitorPostInput[],
) {
  if (posts.length === 0) {
    return;
  }

  const supabase = getSupabaseAdmin();
  const payload = posts.map((post) => ({
    analysis_run_id: analysisRunId,
    external_post_id: post.externalPostId,
    permalink: post.permalink,
    caption: post.caption,
    media_type: post.mediaType,
    published_at: post.publishedAt,
    thumbnail_url: post.thumbnailUrl,
    like_count: post.likeCount,
    comment_count: post.commentCount,
    view_count: post.viewCount,
    raw_payload: post.rawPayload,
  })) as never;

  const { error } = await supabase.from("competitor_content_snapshots").upsert(payload, {
    onConflict: "analysis_run_id,external_post_id",
  });

  assertNoError(error);
}
