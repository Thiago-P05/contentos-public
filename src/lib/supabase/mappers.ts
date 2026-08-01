import { decryptSecret } from "@/lib/secure";
import { getVideoPotentialFromPayload } from "@/lib/ai/video-potential";
import type {
  CompetitorAnalysisHistoryItem,
  CompetitorAnalysisReport,
  CompetitorAnalysisRun,
  CompetitorContentSnapshot,
  CompetitorProfile,
} from "@/lib/competition/types";
import type {
  AIInsight,
  ContentItem,
  MetricSnapshot,
  PlatformComment,
  PlatformConnection,
  PlatformConnectionBrief,
  PlatformConnectionCredentials,
  AutomationOutput,
  AutomationRun,
  AutomationRunItem,
  SyncRun,
  TextAsset,
} from "@/lib/types";
import type {
  AIInsightRow,
  ConnectionBriefRow,
  ConnectionRow,
  ContentRow,
  PlatformCommentRow,
  SnapshotRow,
  AutomationOutputRow,
  AutomationRunRow,
  AutomationRunItemRow,
  SyncRunRow,
  TextAssetRow,
  CompetitorAnalysisRunRow,
  CompetitorContentSnapshotRow,
  CompetitorProfileRow,
} from "@/lib/supabase/types";

export function toContentItem(row: ContentRow): ContentItem {
  return {
    id: row.id,
    platform: row.platform,
    connectionId: row.connection_id,
    externalId: row.external_id,
    publishedAt: row.published_at,
    title: row.title,
    description: row.description,
    caption: row.caption,
    durationSeconds: row.duration_seconds,
    permalink: row.permalink,
    thumbnailUrl: row.thumbnail_url,
    mediaUrl: row.media_url,
    status: row.status,
    analysisStatus: row.analysis_status,
    analysisInputText: row.analysis_input_text,
    analysisProcessingStartedAt: row.analysis_processing_started_at ?? null,
    transcriptionStatus: row.transcription_status,
    transcriptionModel: row.transcription_model,
    transcriptionError: row.transcription_error,
    transcriptionUpdatedAt: row.transcription_updated_at,
    rawPayload: row.raw_payload ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toMetricSnapshot(row: SnapshotRow): MetricSnapshot {
  return {
    id: row.id,
    contentItemId: row.content_item_id,
    sourcePlatform: row.source_platform,
    capturedAt: row.captured_at,
    metrics: row.metrics ?? {},
    rawPayload: row.raw_payload ?? {},
    createdAt: row.created_at,
  };
}

export function toTextAsset(row: TextAssetRow): TextAsset {
  return {
    id: row.id,
    contentItemId: row.content_item_id,
    sourceType: row.source_type,
    content: row.content,
    language: row.language,
    rawPayload: row.raw_payload ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toAIInsight(row: AIInsightRow): AIInsight {
  const rawPayload = row.raw_payload ?? {};

  return {
    id: row.id,
    contentItemId: row.content_item_id,
    summary: row.summary,
    strengths: row.strengths ?? [],
    weaknesses: row.weaknesses ?? [],
    improvements: row.improvements ?? [],
    topics: row.topics ?? [],
    hooks: row.hooks ?? [],
    hookType: row.hook_type ?? null,
    hookAssessment: row.hook_assessment ?? null,
    evidenceMode: row.evidence_mode ?? "text_only",
    confidence: Number(row.confidence ?? 0),
    model: row.model,
    videoPotential: getVideoPotentialFromPayload(rawPayload),
    rawPayload,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toSyncRun(row: SyncRunRow): SyncRun {
  return {
    id: row.id,
    platform: row.platform,
    connectionId: row.connection_id,
    status: row.status,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    itemsProcessed: row.items_processed,
    itemsSucceeded: row.items_succeeded,
    errorMessage: row.error_message,
    metadata: row.metadata ?? {},
  };
}

export function toPlatformConnectionBrief(row: ConnectionBriefRow): PlatformConnectionBrief {
  return {
    id: row.id,
    connectionId: row.connection_id,
    offer: row.offer,
    idealCustomerProfile: row.ideal_customer_profile,
    corePain: row.core_pain,
    desiredOutcome: row.desired_outcome,
    differentiator: row.differentiator,
    toneGuidelines: row.tone_guidelines,
    avoidGuidelines: row.avoid_guidelines,
    primaryCta: row.primary_cta,
    notes: row.notes ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toPlatformConnection(row: ConnectionRow): PlatformConnection {
  return {
    id: row.id,
    platform: row.platform,
    accountExternalId: row.account_external_id,
    accountUsername: row.account_username,
    displayName: row.display_name,
    tokenExpiresAt: row.token_expires_at,
    refreshTokenExpiresAt: row.refresh_token_expires_at,
    scopes: row.scopes ?? [],
    status: row.status,
    disconnectedAt: row.disconnected_at ?? null,
    autoAnalysisEnabled: row.auto_analysis_enabled ?? true,
    autoTranscriptionEnabled: row.auto_transcription_enabled ?? true,
    rawProfile: row.raw_profile ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toPlatformConnectionCredentials(
  row: ConnectionRow,
): PlatformConnectionCredentials {
  if (!row.access_token_encrypted) {
    throw new Error("La conexion no tiene credenciales activas.");
  }

  return {
    ...toPlatformConnection(row),
    accessToken: decryptSecret(row.access_token_encrypted),
    refreshToken: row.refresh_token_encrypted
      ? decryptSecret(row.refresh_token_encrypted)
      : null,
  };
}

export function getLatestMetrics(snapshots: MetricSnapshot[]) {
  const latestByItem = new Map<string, MetricSnapshot>();
  const ordered = [...snapshots].sort(
    (left, right) =>
      new Date(right.capturedAt).getTime() - new Date(left.capturedAt).getTime(),
  );

  for (const snapshot of ordered) {
    if (!latestByItem.has(snapshot.contentItemId)) {
      latestByItem.set(snapshot.contentItemId, snapshot);
    }
  }

  return latestByItem;
}

export function toPlatformComment(row: PlatformCommentRow): PlatformComment {
  return {
    id: row.id,
    platform: row.platform,
    connectionId: row.connection_id,
    contentItemId: row.content_item_id,
    externalCommentId: row.external_comment_id,
    authorUsername: row.author_username,
    authorDisplayName: row.author_display_name,
    text: row.text,
    commentedAt: row.commented_at,
    likeCount: Number(row.like_count ?? 0),
    isReply: row.is_reply,
    parentCommentExternalId: row.parent_comment_external_id,
    rawPayload: row.raw_payload ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toAutomationRun(row: AutomationRunRow): AutomationRun {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    title: row.title,
    sourceFilename: row.source_filename,
    sourceMimeType: row.source_mime_type,
    sourceSizeBytes: row.source_size_bytes,
    provider: row.provider,
    providerProjectId: row.provider_project_id,
    providerUploadId: row.provider_upload_id,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    errorMessage: row.error_message,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toAutomationOutput(row: AutomationOutputRow): AutomationOutput {
  return {
    id: row.id,
    runId: row.run_id,
    type: row.type,
    providerOutputId: row.provider_output_id,
    title: row.title,
    description: row.description,
    hashtags: row.hashtags,
    previewUrl: row.preview_url,
    exportUrl: row.export_url,
    durationMs: row.duration_ms,
    timeRanges: Array.isArray(row.time_ranges) ? row.time_ranges : [],
    rawPayload: row.raw_payload ?? {},
    createdAt: row.created_at,
  };
}

export function toAutomationRunItem(row: AutomationRunItemRow): AutomationRunItem {
  return {
    id: row.id,
    runId: row.run_id,
    type: row.type,
    position: row.position,
    sourceUrl: row.source_url,
    normalizedUrl: row.normalized_url,
    status: row.status,
    externalId: row.external_id,
    title: row.title,
    caption: row.caption,
    mediaUrl: row.media_url,
    thumbnailUrl: row.thumbnail_url,
    durationSeconds: row.duration_seconds,
    metrics: row.metrics ?? {},
    transcript: row.transcript,
    analysis: row.analysis ?? null,
    errorMessage: row.error_message,
    rawPayload: row.raw_payload ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toCompetitorProfile(row: CompetitorProfileRow): CompetitorProfile {
  return {
    id: row.id,
    platform: row.platform,
    username: row.username,
    sourceUrl: row.source_url,
    displayName: row.display_name,
    biography: row.biography,
    profileImageUrl: row.profile_image_url,
    followerCount: row.follower_count,
    followingCount: row.following_count,
    postsCount: row.posts_count,
    rawPayload: row.raw_payload ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toCompetitorAnalysisRun(row: CompetitorAnalysisRunRow): CompetitorAnalysisRun {
  return {
    id: row.id,
    profileId: row.profile_id,
    requestedUrl: row.requested_url,
    status: row.status,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    errorMessage: row.error_message,
    sourceProvider: row.source_provider,
    reportPayload: row.report_payload ?? {},
    rawPayload: row.raw_payload ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toCompetitorContentSnapshot(
  row: CompetitorContentSnapshotRow,
): CompetitorContentSnapshot {
  return {
    id: row.id,
    analysisRunId: row.analysis_run_id,
    externalPostId: row.external_post_id,
    permalink: row.permalink,
    caption: row.caption,
    mediaType: row.media_type,
    publishedAt: row.published_at,
    thumbnailUrl: row.thumbnail_url,
    likeCount: row.like_count,
    commentCount: row.comment_count,
    viewCount: row.view_count,
    rawPayload: row.raw_payload ?? {},
    createdAt: row.created_at,
  };
}

export function toCompetitorAnalysisReport(
  payload: Record<string, unknown> | null | undefined,
): CompetitorAnalysisReport | null {
  if (!payload || typeof payload.summary !== "string" || !payload.summary.trim()) {
    return null;
  }

  const toStringArray = (value: unknown) =>
    Array.isArray(value)
      ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      : [];

  return {
    summary: payload.summary,
    winningFormats: toStringArray(payload.winningFormats),
    winningTopics: toStringArray(payload.winningTopics),
    recurringHooks: toStringArray(payload.recurringHooks),
    observations: toStringArray(payload.observations),
    caveats: toStringArray(payload.caveats),
    rawPayload: payload,
  };
}

export function toCompetitorAnalysisHistoryItem(
  run: CompetitorAnalysisRunRow,
  profile: CompetitorProfileRow,
): CompetitorAnalysisHistoryItem {
  return {
    id: run.id,
    profileId: run.profile_id,
    username: profile.username,
    displayName: profile.display_name,
    requestedUrl: run.requested_url,
    status: run.status,
    startedAt: run.started_at,
    completedAt: run.completed_at,
    errorMessage: run.error_message,
    sourceProvider: run.source_provider,
  };
}
