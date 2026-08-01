export type CompetitorPlatform = "instagram";

export type CompetitorAnalysisRunStatus = "running" | "completed" | "failed";

export type CompetitorContentMediaType =
  | "reel"
  | "carousel"
  | "image"
  | "video"
  | "unknown";

export interface CompetitorProfile {
  id: string;
  platform: CompetitorPlatform;
  username: string;
  sourceUrl: string;
  displayName: string | null;
  biography: string | null;
  profileImageUrl: string | null;
  followerCount: number | null;
  followingCount: number | null;
  postsCount: number | null;
  rawPayload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CompetitorAnalysisRun {
  id: string;
  profileId: string;
  requestedUrl: string;
  status: CompetitorAnalysisRunStatus;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  sourceProvider: string;
  reportPayload: Record<string, unknown>;
  rawPayload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CompetitorAnalysisHistoryItem {
  id: string;
  profileId: string;
  username: string;
  displayName: string | null;
  requestedUrl: string;
  status: CompetitorAnalysisRunStatus;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  sourceProvider: string;
}

export interface CompetitorContentSnapshot {
  id: string;
  analysisRunId: string;
  externalPostId: string;
  permalink: string | null;
  caption: string | null;
  mediaType: CompetitorContentMediaType;
  publishedAt: string | null;
  thumbnailUrl: string | null;
  likeCount: number | null;
  commentCount: number | null;
  viewCount: number | null;
  rawPayload: Record<string, unknown>;
  createdAt: string;
}

export interface CompetitorAnalysisReport {
  summary: string;
  winningFormats: string[];
  winningTopics: string[];
  recurringHooks: string[];
  observations: string[];
  caveats: string[];
  rawPayload: Record<string, unknown>;
}

export interface CompetitionFormatMixEntry {
  mediaType: CompetitorContentMediaType;
  count: number;
  share: number;
}

export interface CompetitionWindowAggregate {
  windowDays: 30;
  windowStart: string;
  windowEnd: string;
  publishedPosts: number;
  postsPerWeek: number | null;
  totalVisibleViews: number | null;
  averageVisibleViews: number | null;
  postsWithVisibleViews: number;
  totalVisibleComments: number | null;
  averageVisibleComments: number | null;
  postsWithVisibleComments: number;
  formatMix: CompetitionFormatMixEntry[];
}

export interface CompetitionAnalysisDetail {
  run: CompetitorAnalysisRun;
  profile: CompetitorProfile;
  posts: CompetitorContentSnapshot[];
  aggregates30d: CompetitionWindowAggregate;
  topByViews: CompetitorContentSnapshot[];
  topByComments: CompetitorContentSnapshot[];
  report: CompetitorAnalysisReport | null;
}

export interface NormalizedCompetitorProfileInput {
  platform: CompetitorPlatform;
  username: string;
  sourceUrl: string;
  displayName: string | null;
  biography: string | null;
  profileImageUrl: string | null;
  followerCount: number | null;
  followingCount: number | null;
  postsCount: number | null;
  rawPayload: Record<string, unknown>;
}

export interface NormalizedCompetitorPostInput {
  externalPostId: string;
  permalink: string | null;
  caption: string | null;
  mediaType: CompetitorContentMediaType;
  publishedAt: string | null;
  thumbnailUrl: string | null;
  likeCount: number | null;
  commentCount: number | null;
  viewCount: number | null;
  rawPayload: Record<string, unknown>;
}

export interface NormalizedCompetitorDataset {
  profile: NormalizedCompetitorProfileInput;
  posts: NormalizedCompetitorPostInput[];
  sourceProvider: string;
  rawPayload: Record<string, unknown>;
}
