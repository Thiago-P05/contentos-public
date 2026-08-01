-- ============================================================
-- Gives transcription its own lifecycle on content_items: status, timestamp
-- and metadata, independent of analysis status.
--
-- transcription_updated_at is not bookkeeping — the sync cost guard reads it
-- to apply a 24-hour cooldown after a failure, which is part of what stops
-- every run from re-paying to transcribe the same failing video.
-- ============================================================

alter table public.content_items
  add column if not exists transcription_status text not null default 'not_applicable';

alter table public.content_items
  add column if not exists transcription_model text;

alter table public.content_items
  add column if not exists transcription_error text;

alter table public.content_items
  add column if not exists transcription_updated_at timestamptz;

alter table public.content_items
  drop constraint if exists content_items_transcription_status_check;

alter table public.content_items
  add constraint content_items_transcription_status_check
  check (transcription_status in ('not_applicable', 'pending', 'processing', 'ready', 'failed'));

update public.content_items as ci
set
  transcription_status = 'ready',
  transcription_model = coalesce(nullif(ci.transcription_model, ''), nullif(cta.raw_payload ->> 'model', '')),
  transcription_error = null,
  transcription_updated_at = coalesce(ci.transcription_updated_at, cta.updated_at)
from public.content_text_assets as cta
where cta.content_item_id = ci.id
  and cta.source_type = 'transcript'
  and length(trim(cta.content)) > 0;

update public.content_items
set
  transcription_status = 'pending',
  transcription_error = null
where transcription_status = 'not_applicable'
  and platform = 'instagram'
  and media_url is not null
  and coalesce(raw_payload ->> 'media_product_type', '') = 'REELS';
