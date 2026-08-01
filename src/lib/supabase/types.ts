import type {
  AnalysisEvidenceMode,
  AnalysisStatus,
  AutomationOutputType,
  AutomationRunItemStatus,
  AutomationRunItemType,
  AutomationRunStatus,
  AutomationType,
  ConnectionStatus,
  MetricMap,
  Platform,
  TextSourceType,
  TranscriptionStatus,
} from "@/lib/types";
import type {
  CompetitorAnalysisRunStatus,
  CompetitorContentMediaType,
  CompetitorPlatform,
} from "@/lib/competition/types";

export type ContentRow = {
  id: string;
  platform: Platform;
  connection_id: string | null;
  external_id: string;
  published_at: string;
  title: string | null;
  description: string | null;
  caption: string | null;
  duration_seconds: number | null;
  permalink: string | null;
  thumbnail_url: string | null;
  media_url: string | null;
  status: string;
  analysis_status: AnalysisStatus;
  analysis_input_text: string | null;
  analysis_processing_started_at?: string | null;
  transcription_status: TranscriptionStatus;
  transcription_model: string | null;
  transcription_error: string | null;
  transcription_updated_at: string | null;
  raw_payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type SnapshotRow = {
  id: string;
  content_item_id: string;
  source_platform: Platform;
  captured_at: string;
  metrics: MetricMap;
  raw_payload: Record<string, unknown>;
  created_at: string;
};

export type TextAssetRow = {
  id: string;
  content_item_id: string;
  source_type: TextSourceType;
  content: string;
  language: string | null;
  raw_payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type AIInsightRow = {
  id: string;
  content_item_id: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
  topics: string[];
  hooks: string[];
  hook_type: string | null;
  hook_assessment: string | null;
  evidence_mode: AnalysisEvidenceMode;
  confidence: number;
  model: string;
  raw_payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type SyncRunRow = {
  id: string;
  platform: Platform;
  connection_id: string | null;
  status: "running" | "completed" | "failed";
  started_at: string;
  completed_at: string | null;
  items_processed: number;
  items_succeeded: number;
  error_message: string | null;
  metadata: Record<string, unknown>;
};

export type ConnectionRow = {
  id: string;
  platform: Platform;
  account_external_id: string;
  account_username: string | null;
  display_name: string | null;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  token_expires_at: string | null;
  refresh_token_expires_at: string | null;
  scopes: string[];
  status: ConnectionStatus;
  disconnected_at?: string | null;
  auto_analysis_enabled?: boolean;
  auto_transcription_enabled?: boolean;
  raw_profile: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ConnectionBriefRow = {
  id: string;
  connection_id: string;
  offer: string;
  ideal_customer_profile: string;
  core_pain: string;
  desired_outcome: string;
  differentiator: string;
  tone_guidelines: string;
  avoid_guidelines: string;
  primary_cta: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type PlatformDailyInsightRow = {
  id: string;
  platform: Platform;
  connection_id: string;
  insight_date: string;
  period: "day";
  views: number | null;
  impressions: number | null;
  reach: number | null;
  content_interactions: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  profile_visits: number | null;
  link_clicks: number | null;
  follows: number | null;
  follower_count: number | null;
  watch_time_minutes: number | null;
  average_view_duration_seconds: number | null;
  raw_payload: Record<string, unknown>;
  subscribers_gained: number | null;
  subscribers_lost: number | null;
  following_count?: number | null;
  profile_likes_count?: number | null;
  video_count?: number | null;
  created_at: string;
  updated_at: string;
};

export type SupabaseErrorLike = {
  message?: string | null;
  code?: string | null;
} | null;


export type PlatformCommentRow = {
  id: string;
  platform: Platform;
  connection_id: string;
  content_item_id: string;
  external_comment_id: string;
  author_username: string | null;
  author_display_name: string | null;
  text: string;
  commented_at: string;
  like_count: number;
  is_reply: boolean;
  parent_comment_external_id: string | null;
  raw_payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CompetitorProfileRow = {
  id: string;
  platform: CompetitorPlatform;
  username: string;
  source_url: string;
  display_name: string | null;
  biography: string | null;
  profile_image_url: string | null;
  follower_count: number | null;
  following_count: number | null;
  posts_count: number | null;
  raw_payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CompetitorAnalysisRunRow = {
  id: string;
  profile_id: string;
  requested_url: string;
  status: CompetitorAnalysisRunStatus;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
  source_provider: string;
  report_payload: Record<string, unknown>;
  raw_payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CompetitorContentSnapshotRow = {
  id: string;
  analysis_run_id: string;
  external_post_id: string;
  permalink: string | null;
  caption: string | null;
  media_type: CompetitorContentMediaType;
  published_at: string | null;
  thumbnail_url: string | null;
  like_count: number | null;
  comment_count: number | null;
  view_count: number | null;
  raw_payload: Record<string, unknown>;
  created_at: string;
};

export type AutomationRunRow = {
  id: string;
  type: AutomationType;
  status: AutomationRunStatus;
  title: string;
  source_filename: string | null;
  source_mime_type: string | null;
  source_size_bytes: number | null;
  provider: string;
  provider_project_id: string | null;
  provider_upload_id: string | null;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type AutomationOutputRow = {
  id: string;
  run_id: string;
  type: AutomationOutputType;
  provider_output_id: string;
  title: string | null;
  description: string | null;
  hashtags: string | null;
  preview_url: string | null;
  export_url: string | null;
  duration_ms: number | null;
  time_ranges: unknown[];
  raw_payload: Record<string, unknown>;
  created_at: string;
};

export type AutomationRunItemRow = {
  id: string;
  run_id: string;
  type: AutomationRunItemType;
  position: number;
  source_url: string;
  normalized_url: string | null;
  status: AutomationRunItemStatus;
  external_id: string | null;
  title: string | null;
  caption: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  metrics: MetricMap;
  transcript: string | null;
  analysis: Record<string, unknown> | null;
  error_message: string | null;
  raw_payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};
