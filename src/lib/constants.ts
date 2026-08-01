/**
 * Oldest content the sync will reach for. Every run walks forward from here, so
 * this bounds both how far back your history goes and how much the AI guards
 * have to skip on each pass — set it to roughly when the account you are syncing
 * started producing content worth analysing.
 *
 * Any ISO 8601 instant works; the default carries a -03:00 offset purely because
 * that is what the original deployment used.
 */
export const BACKFILL_START_ISO =
  process.env.BACKFILL_START_ISO ?? "2025-12-01T00:00:00-03:00";
export const DEFAULT_SYNC_WEEKDAY = "MONDAY";
export const DEFAULT_SYNC_TIME = "09:00";

export const INSTAGRAM_INSIGHT_METRICS = [
  "views",
  "reach",
  "likes",
  "comments",
  "shares",
  "saved",
  "total_interactions",
  "ig_reels_avg_watch_time",
  "ig_reels_video_view_total_time",
  "reels_skip_rate",
] as const;

export const INSTAGRAM_CAROUSEL_INSIGHT_METRIC_CANDIDATES = [
  ["views", "reach", "likes", "comments", "saved", "total_interactions"],
  ["views", "reach", "likes", "comments", "saved"],
  ["reach", "likes", "comments", "saved", "total_interactions"],
  ["reach", "likes", "comments", "saved"],
] as const;

export const INSTAGRAM_ACCOUNT_DAILY_LOOKBACK_DAYS = 90;

export const INSTAGRAM_ACCOUNT_DAILY_METRIC_CANDIDATES = {
  impressions: ["impressions"],
  reach: ["reach"],
  contentInteractions: ["total_interactions"],
  profileVisits: ["profile_views"],
  linkClicks: ["website_clicks"],
  follows: ["follows"],
  followerCount: ["follower_count"],
} as const;

export const DEFAULT_OPENROUTER_ANALYSIS_MODEL = "google/gemini-2.5-flash";
export const DEFAULT_OPENROUTER_TRANSCRIPTION_MODEL = "google/gemini-2.5-flash-lite";
