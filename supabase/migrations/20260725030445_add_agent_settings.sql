-- ============================================================
-- Per-connection toggles for the analysis and transcription agents, so a single
-- account can be paused without stopping the whole sync.
-- ============================================================

alter table public.platform_connections
  add column if not exists auto_analysis_enabled boolean not null default true,
  add column if not exists auto_transcription_enabled boolean not null default true;

alter table public.content_items
  add column if not exists analysis_processing_started_at timestamptz;

alter table public.content_items
  drop constraint if exists content_items_analysis_status_check;

alter table public.content_items
  add constraint content_items_analysis_status_check
  check (analysis_status in ('pending', 'processing', 'ready', 'fallback', 'failed'));

comment on column public.platform_connections.auto_analysis_enabled is
  'Controls automatic content analysis during full sync and AI backfill.';

comment on column public.platform_connections.auto_transcription_enabled is
  'Controls automatic video transcription during full sync and AI backfill.';

comment on column public.content_items.analysis_processing_started_at is
  'Lease timestamp used to prevent duplicate paid analysis work.';
