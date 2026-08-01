-- ============================================================
-- Adds account-level TikTok metrics to the daily insights model.
-- ============================================================

alter table public.platform_connections
  alter column access_token_encrypted drop not null;

alter table public.platform_connections
  add column if not exists disconnected_at timestamptz;

alter table public.platform_daily_insights
  add column if not exists following_count bigint,
  add column if not exists profile_likes_count bigint,
  add column if not exists video_count bigint;
