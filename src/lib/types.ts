export type Platform = "instagram" | "tiktok" | "youtube";
export type PlatformFilter = Platform | "all";
export type SyncStatus = "running" | "completed" | "failed";
export type AnalysisStatus = "pending" | "processing" | "ready" | "fallback" | "failed";
export type TranscriptionStatus =
  | "not_applicable"
  | "pending"
  | "processing"
  | "ready"
  | "failed";
export type DashboardRange = "day" | "week" | "month" | "quarter" | "year" | "all" | "last30" | "last60" | "last90";
export type ConnectionStatus = "active" | "disconnected" | "error";
export type DashboardPerformanceAvailabilityStatus = "ok" | "partial" | "empty";
export type DashboardTrendMetricKey =
  | "views"
  | "comments"
  | "likes"
  | "shares"
  | "saves"
  | "reach"
  | "contentInteractions"
  | "profileVisits"
  | "linkClicks"
  | "follows"
  | "followerCount"
  | "watchTimeMinutes"
  | "averageViewDurationSeconds"
  | "subscribersGained"
  | "subscribersLost"
  | "avgWatchTimeMs"
  | "skipRate"
  | "engagementRate"
  | "likeRate"
  | "commentRate"
  | "shareRate"
  | "saveRate"
  | "profileCtr"
  | "linkCtr"
  | "followConversion"
  | "avgViewsPerPiece"
  | "subsPerThousandViews";
export type TextSourceType =
  | "platform_caption"
  | "official_caption"
  | "transcript"
  | "metadata_fallback";

export type AnalysisEvidenceMode = "multimodal_video" | "multimodal_carousel" | "text_plus_cover" | "text_only";

export type AutomationType = "opusclip_video_clipper" | "super_assistant";
export type AutomationRunStatus =
  | "created"
  | "uploading"
  | "queued"
  | "processing"
  | "ready"
  | "failed";
export type AutomationOutputType = "opusclip_clip" | "super_assistant_script";
export type AutomationRunItemType = "instagram_reel";
export type AutomationRunItemStatus =
  | "pending"
  | "extracting"
  | "transcribing"
  | "analyzing"
  | "ready"
  | "failed";

export type MetricMap = Record<string, number | null>;

export interface PlatformConnectionBriefFields {
  offer: string;
  idealCustomerProfile: string;
  corePain: string;
  desiredOutcome: string;
  differentiator: string;
  toneGuidelines: string;
  avoidGuidelines: string;
  primaryCta: string;
  notes: string;
}

export interface PlatformConnectionBrief extends PlatformConnectionBriefFields {
  id: string;
  connectionId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformConnection {
  id: string;
  platform: Platform;
  accountExternalId: string;
  accountUsername: string | null;
  displayName: string | null;
  tokenExpiresAt: string | null;
  refreshTokenExpiresAt: string | null;
  scopes: string[];
  status: ConnectionStatus;
  disconnectedAt?: string | null;
  autoAnalysisEnabled?: boolean;
  autoTranscriptionEnabled?: boolean;
  rawProfile: Record<string, unknown>;
  brief?: PlatformConnectionBrief | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformConnectionCredentials extends PlatformConnection {
  accessToken: string;
  refreshToken: string | null;
}

export interface ContentItem {
  id: string;
  platform: Platform;
  connectionId: string | null;
  externalId: string;
  publishedAt: string;
  title: string | null;
  description: string | null;
  caption: string | null;
  durationSeconds: number | null;
  permalink: string | null;
  thumbnailUrl: string | null;
  mediaUrl: string | null;
  status: string;
  analysisStatus: AnalysisStatus;
  analysisInputText: string | null;
  analysisProcessingStartedAt?: string | null;
  transcriptionStatus: TranscriptionStatus;
  transcriptionModel: string | null;
  transcriptionError: string | null;
  transcriptionUpdatedAt: string | null;
  rawPayload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface MetricSnapshot {
  id: string;
  contentItemId: string;
  sourcePlatform: Platform;
  capturedAt: string;
  metrics: MetricMap;
  rawPayload: Record<string, unknown>;
  createdAt: string;
}

export interface TextAsset {
  id: string;
  contentItemId: string;
  sourceType: TextSourceType;
  content: string;
  language: string | null;
  rawPayload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AIInsight {
  id: string;
  contentItemId: string;
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
  videoPotential: VideoPotentialEstimate | null;
  rawPayload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SyncRun {
  id: string;
  platform: Platform;
  connectionId: string | null;
  status: SyncStatus;
  startedAt: string;
  completedAt: string | null;
  itemsProcessed: number;
  itemsSucceeded: number;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
}

export interface ContentListItem extends ContentItem {
  latestMetrics: MetricMap;
  latestInsight: AIInsight | null;
}

export interface ContentLibraryItem {
  id: string;
  platform: Platform;
  connectionId: string | null;
  publishedAt: string;
  title: string | null;
  caption: string | null;
  thumbnailUrl: string | null;
  analysisStatus: AnalysisStatus;
  analysisProcessingStartedAt: string | null;
  rawPayload: Record<string, unknown>;
  latestMetrics: MetricMap;
  hasInsight: boolean;
}

export interface ContentDetail {
  item: ContentItem;
  snapshots: MetricSnapshot[];
  textAssets: TextAsset[];
  insight: AIInsight | null;
}

export interface DashboardOverview {
  configured: boolean;
  missingEnv: string[];
  setupIssues: string[];
  generatedAt: string;
  selectedRange: DashboardRange;
  selectedPlatform: PlatformFilter;
  selectedConnectionId: string | null;
  selectedAnchor: string | null;
  latestDataAnchor: string | null;
  availableConnections: PlatformConnection[];
  allTimePublishedItems: number;
  totals: {
    publishedItems: number;
    analyzedItems: number;
    totalViews: number;
    totalComments: number;
    avgEngagementRate: number | null;
    avgWatchTimeMs: number | null;
  };
  performanceTotals: Record<DashboardTrendMetricKey, number | null>;
  monthPerformanceTotals: Record<DashboardTrendMetricKey, number | null>;
  previousPeriodTotals: Record<DashboardTrendMetricKey, number | null>;
  previousMonthTotals: Record<DashboardTrendMetricKey, number | null>;
  performanceAvailability: {
    status: DashboardPerformanceAvailabilityStatus;
    message: string;
  };
  platformBreakdown: Array<{
    platform: Platform;
    count: number;
  }>;
  performanceSeries: Array<{
    bucketStart: string;
    bucketEnd: string;
    label: string;
    publishedAt: string;
    isPending: boolean;
    hasObservedData: boolean;
    observedMetrics: DashboardTrendMetricKey[];
    metrics: Record<DashboardTrendMetricKey, number>;
  }>;
  topContent: ContentListItem[];
  recentComments: PlatformComment[];
  lastSyncRuns: SyncRun[];
  followersLost: number | null;
  connectionViewTotals: Array<{ connectionId: string; views: number }>;
}
export interface PlatformDailyInsightInput {
  platform: Platform;
  connectionId: string;
  insightDate: string;
  period: "day";
  views: number | null;
  impressions: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  contentInteractions: number | null;
  profileVisits: number | null;
  linkClicks: number | null;
  follows: number | null;
  followerCount: number | null;
  watchTimeMinutes: number | null;
  averageViewDurationSeconds: number | null;
  subscribersGained: number | null;
  subscribersLost: number | null;
  followingCount?: number | null;
  profileLikesCount?: number | null;
  videoCount?: number | null;
  rawPayload: Record<string, unknown>;
}
export interface AudienceBreakdownEntry {
  label: string;
  value: number;
  share: number;
}

export interface AudienceOverview {
  platform: Platform;
  sourceLabel: string;
  totalFollowers: number;
  countries: AudienceBreakdownEntry[];
  cities: AudienceBreakdownEntry[];
  provinces: AudienceBreakdownEntry[];
  genders: AudienceBreakdownEntry[];
  ages: AudienceBreakdownEntry[];
}

export interface NormalizedContentInput {
  platform: Platform;
  connectionId: string | null;
  externalId: string;
  publishedAt: string;
  title: string | null;
  description: string | null;
  caption: string | null;
  durationSeconds: number | null;
  permalink: string | null;
  thumbnailUrl: string | null;
  mediaUrl: string | null;
  metrics: MetricMap;
  rawPayload: Record<string, unknown>;
  textAssets: Array<{
    sourceType: TextSourceType;
    content: string;
    language?: string | null;
    rawPayload?: Record<string, unknown>;
  }>;
}

export interface AnalysisInput {
  sourceType: TextSourceType;
  content: string;
}

export interface PotentialMetricRange {
  low: number;
  expected: number;
  high: number;
}

export interface VideoPotentialEstimate {
  horizonDays: 7;
  views: PotentialMetricRange;
  reach: PotentialMetricRange;
  comments: PotentialMetricRange;
  confidence: number;
  rationale: string;
}

export interface InsightDraft {
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
  videoPotential: VideoPotentialEstimate | null;
  rawPayload: Record<string, unknown>;
}


export interface PlatformComment {
  id: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface AutomationRun {
  id: string;
  type: AutomationType;
  status: AutomationRunStatus;
  title: string;
  sourceFilename: string | null;
  sourceMimeType: string | null;
  sourceSizeBytes: number | null;
  provider: string;
  providerProjectId: string | null;
  providerUploadId: string | null;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationOutput {
  id: string;
  runId: string;
  type: AutomationOutputType;
  providerOutputId: string;
  title: string | null;
  description: string | null;
  hashtags: string | null;
  previewUrl: string | null;
  exportUrl: string | null;
  durationMs: number | null;
  timeRanges: unknown[];
  rawPayload: Record<string, unknown>;
  createdAt: string;
}

export interface AutomationRunItem {
  id: string;
  runId: string;
  type: AutomationRunItemType;
  position: number;
  sourceUrl: string;
  normalizedUrl: string | null;
  status: AutomationRunItemStatus;
  externalId: string | null;
  title: string | null;
  caption: string | null;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  metrics: MetricMap;
  transcript: string | null;
  analysis: Record<string, unknown> | null;
  errorMessage: string | null;
  rawPayload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationRunDetail {
  run: AutomationRun;
  outputs: AutomationOutput[];
  items?: AutomationRunItem[];
}
