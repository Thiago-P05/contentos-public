-- ============================================================
-- Widens the set of platform metrics persisted per snapshot.
-- ============================================================

alter table if exists public.platform_daily_insights
  add column if not exists likes bigint,
  add column if not exists comments bigint,
  add column if not exists shares bigint,
  add column if not exists saves bigint,
  add column if not exists watch_time_minutes numeric,
  add column if not exists average_view_duration_seconds numeric,
  add column if not exists subscribers_gained bigint,
  add column if not exists subscribers_lost bigint;
