-- ============================================================
-- Read performance. Adds composite indexes for the dashboard and library
-- query shapes, enables pg_trgm for trigram indexes on title, description and
-- caption (substring search without a full scan), and creates the
-- latest_content_metric_snapshots view so 'current value per piece' does not
-- require a window function at every call site.
-- ============================================================

create extension if not exists pg_trgm;

create index if not exists content_items_platform_analysis_published_idx
on public.content_items (platform, analysis_status, published_at desc);

create index if not exists content_items_platform_connection_analysis_published_idx
on public.content_items (platform, connection_id, analysis_status, published_at desc);

create index if not exists content_items_title_trgm_idx
on public.content_items using gin (title gin_trgm_ops);

create index if not exists content_items_description_trgm_idx
on public.content_items using gin (description gin_trgm_ops);

create index if not exists content_items_caption_trgm_idx
on public.content_items using gin (caption gin_trgm_ops);

create index if not exists sync_runs_platform_connection_started_idx
on public.sync_runs (platform, connection_id, started_at desc);

create or replace view public.latest_content_metric_snapshots as
select distinct on (content_item_id)
  id,
  content_item_id,
  source_platform,
  captured_at,
  metrics,
  raw_payload,
  created_at
from public.content_metric_snapshots
order by content_item_id, captured_at desc;
