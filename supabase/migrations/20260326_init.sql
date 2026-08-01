-- ============================================================
-- Initial schema. Establishes the core content model that everything else
-- hangs off: content_items (one row per published piece), plus the tables
-- that describe it — metric snapshots, text assets, AI insights, embeddings
-- and sync run history.
--
-- Enables pgcrypto (gen_random_uuid) and vector (pgvector, for embeddings),
-- and defines set_updated_at(), the trigger function reused by every table
-- that tracks updated_at.
--
-- Metrics are snapshots rather than a single mutable row on purpose: it is
-- what makes trends over time possible instead of only 'the value right now'.
-- ============================================================

create extension if not exists "pgcrypto";
create extension if not exists "vector";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('instagram', 'tiktok')),
  external_id text not null,
  published_at timestamptz not null,
  title text,
  description text,
  caption text,
  duration_seconds integer,
  permalink text,
  thumbnail_url text,
  media_url text,
  status text not null default 'published',
  analysis_status text not null default 'pending' check (analysis_status in ('pending', 'ready', 'fallback', 'failed')),
  analysis_input_text text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (platform, external_id)
);

create table if not exists public.content_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  source_platform text not null check (source_platform in ('instagram', 'tiktok')),
  captured_at timestamptz not null,
  metrics jsonb not null default '{}'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (content_item_id, source_platform, captured_at)
);

create table if not exists public.content_text_assets (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  source_type text not null check (source_type in ('platform_caption', 'official_caption', 'transcript', 'metadata_fallback')),
  content text not null,
  language text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (content_item_id, source_type)
);

create table if not exists public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  summary text not null,
  strengths jsonb not null default '[]'::jsonb,
  weaknesses jsonb not null default '[]'::jsonb,
  topics jsonb not null default '[]'::jsonb,
  hooks jsonb not null default '[]'::jsonb,
  confidence numeric(4,3) not null default 0,
  model text not null,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (content_item_id)
);

create table if not exists public.embeddings (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  embedding vector(1536) not null,
  model text not null,
  source_text text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (content_item_id)
);

create table if not exists public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('instagram', 'tiktok')),
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  items_processed integer not null default 0,
  items_succeeded integer not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists content_items_platform_published_idx on public.content_items (platform, published_at desc);
create index if not exists metric_snapshots_content_idx on public.content_metric_snapshots (content_item_id, captured_at desc);
create index if not exists sync_runs_platform_started_idx on public.sync_runs (platform, started_at desc);

drop trigger if exists set_content_items_updated_at on public.content_items;
create trigger set_content_items_updated_at
before update on public.content_items
for each row execute function public.set_updated_at();

drop trigger if exists set_content_text_assets_updated_at on public.content_text_assets;
create trigger set_content_text_assets_updated_at
before update on public.content_text_assets
for each row execute function public.set_updated_at();

drop trigger if exists set_ai_insights_updated_at on public.ai_insights;
create trigger set_ai_insights_updated_at
before update on public.ai_insights
for each row execute function public.set_updated_at();

drop trigger if exists set_embeddings_updated_at on public.embeddings;
create trigger set_embeddings_updated_at
before update on public.embeddings
for each row execute function public.set_updated_at();
