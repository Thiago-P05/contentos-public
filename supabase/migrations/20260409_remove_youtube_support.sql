-- ============================================================
-- ⚠  DESTRUCTIVE. Deletes every row where platform = 'youtube' across
-- connections, content, metrics, comments, daily insights and sync runs.
--
-- YouTube was dropped from the product in April. It came back in July via
-- 20260724_youtube_support.sql, so on a fresh database this delete is a no-op
-- and the history still ends with YouTube supported.
--
-- Do not replay this file against a populated database.
-- ============================================================

delete from public.platform_comments
where platform = 'youtube';

delete from public.spark_messages
where thread_id in (
  select id
  from public.spark_threads
  where platform = 'youtube'
);

delete from public.spark_threads
where platform = 'youtube';

delete from public.content_metric_snapshots
where source_platform = 'youtube';

delete from public.sync_runs
where platform = 'youtube';

delete from public.platform_daily_insights
where platform = 'youtube';

delete from public.content_items
where platform = 'youtube';

delete from public.platform_connections
where platform = 'youtube';

alter table if exists public.platform_connections
  drop constraint if exists platform_connections_platform_check;

alter table if exists public.platform_connections
  add constraint platform_connections_platform_check
  check (platform in ('instagram', 'tiktok'));

alter table if exists public.content_items
  drop constraint if exists content_items_platform_check;

alter table if exists public.content_items
  add constraint content_items_platform_check
  check (platform in ('instagram', 'tiktok'));

alter table if exists public.content_metric_snapshots
  drop constraint if exists content_metric_snapshots_source_platform_check;

alter table if exists public.content_metric_snapshots
  add constraint content_metric_snapshots_source_platform_check
  check (source_platform in ('instagram', 'tiktok'));

alter table if exists public.sync_runs
  drop constraint if exists sync_runs_platform_check;

alter table if exists public.sync_runs
  add constraint sync_runs_platform_check
  check (platform in ('instagram', 'tiktok'));

alter table if exists public.platform_comments
  drop constraint if exists platform_comments_platform_check;

alter table if exists public.platform_comments
  add constraint platform_comments_platform_check
  check (platform in ('instagram', 'tiktok'));

alter table if exists public.spark_threads
  drop constraint if exists spark_threads_platform_check;

alter table if exists public.spark_threads
  add constraint spark_threads_platform_check
  check (platform in ('instagram', 'tiktok'));

alter table if exists public.platform_daily_insights
  drop constraint if exists platform_daily_insights_platform_check;

alter table if exists public.platform_daily_insights
  add constraint platform_daily_insights_platform_check
  check (platform in ('instagram', 'tiktok'));
