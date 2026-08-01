-- ============================================================
-- Brings YouTube back, three months after 20260409_remove_youtube_support.sql
-- deleted it.
--
-- Also introduces platform_daily_insights, the account-level daily time series
-- that sits alongside per-piece metrics. Being created after the lockdown
-- migration, it enables RLS and revokes from anon/authenticated itself.
-- ============================================================

create table if not exists public.platform_daily_insights (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('instagram', 'tiktok', 'youtube')),
  connection_id uuid not null references public.platform_connections(id) on delete cascade,
  insight_date date not null,
  period text not null default 'day' check (period in ('day')),
  views bigint,
  impressions bigint,
  reach bigint,
  likes bigint,
  comments bigint,
  shares bigint,
  saves bigint,
  content_interactions bigint,
  profile_visits bigint,
  link_clicks bigint,
  follows bigint,
  follower_count bigint,
  watch_time_minutes numeric,
  average_view_duration_seconds numeric,
  subscribers_gained bigint,
  subscribers_lost bigint,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (platform, connection_id, insight_date, period)
);

alter table public.platform_daily_insights
  add column if not exists likes bigint,
  add column if not exists comments bigint,
  add column if not exists shares bigint,
  add column if not exists saves bigint,
  add column if not exists watch_time_minutes numeric,
  add column if not exists average_view_duration_seconds numeric,
  add column if not exists subscribers_gained bigint,
  add column if not exists subscribers_lost bigint;

alter table public.platform_connections
  drop constraint if exists platform_connections_platform_check;
alter table public.platform_connections
  add constraint platform_connections_platform_check
  check (platform in ('instagram', 'tiktok', 'youtube'));

alter table public.content_items
  drop constraint if exists content_items_platform_check;
alter table public.content_items
  add constraint content_items_platform_check
  check (platform in ('instagram', 'tiktok', 'youtube'));

alter table public.content_metric_snapshots
  drop constraint if exists content_metric_snapshots_source_platform_check;
alter table public.content_metric_snapshots
  add constraint content_metric_snapshots_source_platform_check
  check (source_platform in ('instagram', 'tiktok', 'youtube'));

alter table public.sync_runs
  drop constraint if exists sync_runs_platform_check;
alter table public.sync_runs
  add constraint sync_runs_platform_check
  check (platform in ('instagram', 'tiktok', 'youtube'));

alter table public.platform_comments
  drop constraint if exists platform_comments_platform_check;
alter table public.platform_comments
  add constraint platform_comments_platform_check
  check (platform in ('instagram', 'tiktok', 'youtube'));

alter table public.spark_threads
  drop constraint if exists spark_threads_platform_check;
alter table public.spark_threads
  add constraint spark_threads_platform_check
  check (platform in ('instagram', 'tiktok', 'youtube'));

alter table public.platform_daily_insights
  drop constraint if exists platform_daily_insights_platform_check;
alter table public.platform_daily_insights
  add constraint platform_daily_insights_platform_check
  check (platform in ('instagram', 'tiktok', 'youtube'));

create index if not exists platform_daily_insights_connection_date_idx
  on public.platform_daily_insights (connection_id, insight_date desc);

drop trigger if exists set_platform_daily_insights_updated_at on public.platform_daily_insights;
create trigger set_platform_daily_insights_updated_at
before update on public.platform_daily_insights
for each row execute function public.set_updated_at();

alter table public.platform_daily_insights enable row level security;
revoke all on public.platform_daily_insights from anon, authenticated;
