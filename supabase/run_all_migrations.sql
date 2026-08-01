-- ============================================================
-- ContentOS — all migrations, concatenated in order.
--
-- Generated from supabase/migrations/ — do not edit by hand.
-- Regenerate with: pnpm db:bundle
--
-- ⚠  RUN THIS ONCE, ON A FRESH PROJECT ONLY.
--
-- This bundle replays the whole history, and that history is not purely
-- additive. 20260409_remove_youtube_support.sql deletes every row where
-- platform = 'youtube' — connections, content, metrics, comments and sync
-- runs — because YouTube was dropped in April. It was added back in July
-- by 20260724_youtube_support.sql, but the delete still runs first.
--
-- On an empty database that deletes nothing. On a populated one it will
-- silently destroy your YouTube data. To upgrade an existing database,
-- apply only the individual files from supabase/migrations/ that you have
-- not run yet.
-- ============================================================


-- ── 1. 20260326_embeddings_3072.sql ──────────────────────────────────────
-- ============================================================
-- Widens the embedding column to 3072 dimensions to match the larger
-- embedding models. Same-day follow-up to the initial schema.
-- ============================================================

alter table public.embeddings
alter column embedding type vector(3072);

-- ── 2. 20260326_init.sql ──────────────────────────────────────
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

-- ── 3. 20260328_oauth_connections.sql ──────────────────────────────────────
-- ============================================================
-- Introduces platform_connections and makes the app multi-account.
--
-- Before this, credentials came from environment variables and there was one
-- implicit account. Now each connected account is a row with its own
-- encrypted tokens, and content_items and sync_runs gain a connection_id so
-- every piece of data can be traced back to the account it came from.
-- ============================================================

create table if not exists public.platform_connections (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('instagram', 'tiktok')),
  account_external_id text not null,
  account_username text,
  display_name text,
  access_token_encrypted text not null,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scopes jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('active', 'disconnected', 'error')),
  raw_profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (platform, account_external_id)
);

drop trigger if exists set_platform_connections_updated_at on public.platform_connections;
create trigger set_platform_connections_updated_at
before update on public.platform_connections
for each row execute function public.set_updated_at();

create index if not exists platform_connections_platform_status_idx
on public.platform_connections (platform, status, created_at desc);

alter table public.content_items
  add column if not exists connection_id uuid references public.platform_connections(id) on delete set null;

alter table public.sync_runs
  add column if not exists connection_id uuid references public.platform_connections(id) on delete set null;

create index if not exists content_items_connection_published_idx
on public.content_items (connection_id, published_at desc);

create index if not exists sync_runs_connection_started_idx
on public.sync_runs (connection_id, started_at desc);

alter table public.content_items
  drop constraint if exists content_items_platform_check;

alter table public.content_items
  add constraint content_items_platform_check
  check (platform in ('instagram', 'tiktok'));

alter table public.content_metric_snapshots
  drop constraint if exists content_metric_snapshots_source_platform_check;

alter table public.content_metric_snapshots
  add constraint content_metric_snapshots_source_platform_check
  check (source_platform in ('instagram', 'tiktok'));

alter table public.sync_runs
  drop constraint if exists sync_runs_platform_check;

alter table public.sync_runs
  add constraint sync_runs_platform_check
  check (platform in ('instagram', 'tiktok'));

-- ── 4. 20260330_phase2_performance.sql ──────────────────────────────────────
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

-- ── 5. 20260331_comments_and_spark.sql ──────────────────────────────────────
-- ============================================================
-- Adds platform_comments, and the spark_threads / spark_messages tables that
-- backed an in-app chat assistant.
--
-- The Spark tables no longer exist — they are dropped by
-- 20260726232921_remove_content_assistant.sql. External agents query the
-- read-only MCP server instead.
-- ============================================================

create table if not exists public.platform_comments (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('instagram', 'tiktok')),
  connection_id uuid not null references public.platform_connections(id) on delete cascade,
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  external_comment_id text not null,
  author_username text,
  author_display_name text,
  text text not null,
  commented_at timestamptz not null,
  like_count integer not null default 0,
  is_reply boolean not null default false,
  parent_comment_external_id text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (platform, external_comment_id)
);

drop trigger if exists set_platform_comments_updated_at on public.platform_comments;
create trigger set_platform_comments_updated_at
before update on public.platform_comments
for each row execute function public.set_updated_at();

create index if not exists platform_comments_connection_commented_idx
on public.platform_comments (connection_id, commented_at desc);

create index if not exists platform_comments_content_commented_idx
on public.platform_comments (content_item_id, commented_at desc);

create table if not exists public.spark_threads (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  platform text not null check (platform in ('instagram', 'tiktok')),
  connection_id uuid references public.platform_connections(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists set_spark_threads_updated_at on public.spark_threads;
create trigger set_spark_threads_updated_at
before update on public.spark_threads
for each row execute function public.set_updated_at();

create index if not exists spark_threads_updated_idx
on public.spark_threads (updated_at desc);

create table if not exists public.spark_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.spark_threads(id) on delete cascade,
  role text not null check (role in ('system', 'user', 'assistant')),
  content text not null,
  model text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists spark_messages_thread_created_idx
on public.spark_messages (thread_id, created_at asc);

-- ── 6. 20260403_platform_metric_expansion.sql ──────────────────────────────────────
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

-- ── 7. 20260403_spark_agent_type.sql ──────────────────────────────────────
-- ============================================================
-- Adds an agent_type discriminator to the (now removed) Spark threads.
-- ============================================================

alter table public.spark_threads
  add column if not exists agent_type text;

update public.spark_threads
set agent_type = coalesce(agent_type, 'copywriting')
where agent_type is null;

alter table public.spark_threads
  alter column agent_type set default 'copywriting';

alter table public.spark_threads
  alter column agent_type set not null;

alter table public.spark_threads
  drop constraint if exists spark_threads_agent_type_check;

alter table public.spark_threads
  add constraint spark_threads_agent_type_check
  check (agent_type in ('brainstormer', 'copywriting', 'designer', 'video_editor'));

create index if not exists spark_threads_agent_type_updated_at_idx
  on public.spark_threads (agent_type, updated_at desc);

-- ── 8. 20260404_connection_briefs_and_strategic_analysis.sql ──────────────────────────────────────
-- ============================================================
-- Adds platform_connection_briefs: the strategic context for each account —
-- offer, ICP, pain, outcome, tone, CTA, notes.
--
-- This is what separates the AI analysis from generic advice. Without a brief
-- the model can only judge performance; with one it can also judge whether a
-- piece was aligned with what the account is actually trying to do.
-- ai_insights grows the columns needed to store that richer verdict.
-- ============================================================

create table if not exists public.platform_connection_briefs (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.platform_connections(id) on delete cascade,
  offer text not null default '',
  ideal_customer_profile text not null default '',
  core_pain text not null default '',
  desired_outcome text not null default '',
  differentiator text not null default '',
  tone_guidelines text not null default '',
  avoid_guidelines text not null default '',
  primary_cta text not null default '',
  notes text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists platform_connection_briefs_connection_id_key
  on public.platform_connection_briefs (connection_id);

drop trigger if exists set_platform_connection_briefs_updated_at on public.platform_connection_briefs;
create trigger set_platform_connection_briefs_updated_at
before update on public.platform_connection_briefs
for each row execute function public.set_updated_at();

alter table public.ai_insights
  add column if not exists improvements jsonb not null default '[]'::jsonb;

alter table public.ai_insights
  add column if not exists hook_type text;

alter table public.ai_insights
  add column if not exists hook_assessment text;

alter table public.ai_insights
  add column if not exists evidence_mode text not null default 'text_only';

insert into public.platform_connection_briefs (
  connection_id,
  offer,
  ideal_customer_profile,
  core_pain,
  desired_outcome,
  differentiator,
  tone_guidelines,
  avoid_guidelines,
  primary_cta,
  notes
)
select
  id,
  'Ahorro tiempo y dinero a empresas con Inteligencia Artificial.',
  'Hombre de 35 a 45 anos, dueno de una pyme o empresa estable, con familia, estabilidad economica y poco tiempo. Tiene bajo conocimiento tecnico en inteligencia artificial, pero quiere crecer la empresa, ahorrar tiempo y ganar mas dinero sin sacrificar su vida personal.',
  'Le falta tiempo. Siente que el negocio depende demasiado de el, no puede dedicarle el tiempo que quiere a su familia, quiere aprender y crecer pero no llega.',
  'Quiere recuperar tiempo, crecer la empresa sin estar pendiente todo el dia y ganar mas dinero sin sacrificar a su familia.',
  'Conozco bien los problemas del empresario pyme y tengo experiencia aplicando inteligencia artificial y automatizaciones en empresas para resolverlos de forma realista.',
  'Profesional, educado y tranquilo. Claro, simple y directo. Sin tecnicismos innecesarios. Tiene que sonar entendible para alguien no tecnico.',
  'Evitar tono demasiado tecnico, academico, marketinero, soberbio o exageradamente vendedor. No recomendar complejidad innecesaria ni jerga dificil.',
  'Buscar que la audiencia comente una palabra para abrir conversacion por Instagram DM y prospectar desde ahi.',
  ''
from public.platform_connections
on conflict (connection_id) do nothing;

-- ── 9. 20260409_remove_youtube_support.sql ──────────────────────────────────────
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

-- ── 10. 20260419_content_assistant_agent.sql ──────────────────────────────────────
-- ============================================================
-- Adds a content-assistant agent type to the (now removed) Spark threads.
-- ============================================================

alter table public.spark_threads
  drop constraint if exists spark_threads_agent_type_check;

alter table public.spark_threads
  add constraint spark_threads_agent_type_check
  check (agent_type in ('brainstormer', 'copywriting', 'designer', 'video_editor', 'content_assistant'));

-- ── 11. 20260422_reel_transcription_status.sql ──────────────────────────────────────
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

-- ── 12. 20260424_competition_analysis.sql ──────────────────────────────────────
-- ============================================================
-- Adds the competitor module: profiles, analysis runs and content snapshots
-- scraped through Apify. Backend and schema are further along here than the
-- exposed UI.
-- ============================================================

create table if not exists public.competitor_profiles (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('instagram')),
  username text not null,
  source_url text not null,
  display_name text,
  biography text,
  profile_image_url text,
  follower_count bigint,
  following_count bigint,
  posts_count bigint,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (platform, username)
);

drop trigger if exists set_competitor_profiles_updated_at on public.competitor_profiles;
create trigger set_competitor_profiles_updated_at
before update on public.competitor_profiles
for each row execute function public.set_updated_at();

create index if not exists competitor_profiles_platform_username_idx
  on public.competitor_profiles (platform, username);

create table if not exists public.competitor_analysis_runs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.competitor_profiles(id) on delete cascade,
  requested_url text not null,
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  error_message text,
  source_provider text not null default 'apify',
  report_payload jsonb not null default '{}'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists set_competitor_analysis_runs_updated_at on public.competitor_analysis_runs;
create trigger set_competitor_analysis_runs_updated_at
before update on public.competitor_analysis_runs
for each row execute function public.set_updated_at();

create index if not exists competitor_analysis_runs_profile_started_idx
  on public.competitor_analysis_runs (profile_id, started_at desc);

create index if not exists competitor_analysis_runs_status_started_idx
  on public.competitor_analysis_runs (status, started_at desc);

create table if not exists public.competitor_content_snapshots (
  id uuid primary key default gen_random_uuid(),
  analysis_run_id uuid not null references public.competitor_analysis_runs(id) on delete cascade,
  external_post_id text not null,
  permalink text,
  caption text,
  media_type text not null default 'unknown'
    check (media_type in ('reel', 'carousel', 'image', 'video', 'unknown')),
  published_at timestamptz,
  thumbnail_url text,
  like_count bigint,
  comment_count bigint,
  view_count bigint,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (analysis_run_id, external_post_id)
);

create index if not exists competitor_content_snapshots_run_published_idx
  on public.competitor_content_snapshots (analysis_run_id, published_at desc);

-- ── 13. 20260424_two_agents_only.sql ──────────────────────────────────────
-- ============================================================
-- Collapses the agent types down to two. Deletes threads of the retired types.
-- ============================================================

delete from public.spark_threads
where agent_type in ('brainstormer', 'copywriting', 'video_editor');

alter table public.spark_threads
  alter column agent_type set default 'content_assistant';

alter table public.spark_threads
  drop constraint if exists spark_threads_agent_type_check;

alter table public.spark_threads
  add constraint spark_threads_agent_type_check
  check (agent_type in ('content_assistant', 'designer'));

-- ── 14. 20260426_automations.sql ──────────────────────────────────────
-- ============================================================
-- Adds automation_runs and automation_outputs — persisted runs and results for
-- automated jobs such as clip generation.
-- ============================================================

create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('opusclip_video_clipper')),
  status text not null default 'created'
    check (status in ('created', 'uploading', 'queued', 'processing', 'ready', 'failed')),
  title text not null,
  source_filename text,
  source_mime_type text,
  source_size_bytes bigint,
  provider text not null default 'opusclip',
  provider_project_id text,
  provider_upload_id text,
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists set_automation_runs_updated_at on public.automation_runs;
create trigger set_automation_runs_updated_at
before update on public.automation_runs
for each row execute function public.set_updated_at();

create index if not exists automation_runs_type_started_idx
  on public.automation_runs (type, started_at desc);

create index if not exists automation_runs_status_started_idx
  on public.automation_runs (status, started_at desc);

create table if not exists public.automation_outputs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.automation_runs(id) on delete cascade,
  type text not null default 'opusclip_clip' check (type in ('opusclip_clip')),
  provider_output_id text not null,
  title text,
  description text,
  hashtags text,
  preview_url text,
  export_url text,
  duration_ms bigint,
  time_ranges jsonb not null default '[]'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (run_id, provider_output_id)
);

create index if not exists automation_outputs_run_created_idx
  on public.automation_outputs (run_id, created_at asc);

-- ── 15. 20260430_super_assistant_automation.sql ──────────────────────────────────────
-- ============================================================
-- Extends automations with per-item tracking (automation_run_items) so a run
-- can report progress piece by piece rather than only succeeding or failing
-- as a whole.
-- ============================================================

alter table public.automation_runs
  drop constraint if exists automation_runs_type_check;

alter table public.automation_runs
  add constraint automation_runs_type_check
  check (type in ('opusclip_video_clipper', 'super_assistant'));

alter table public.automation_outputs
  drop constraint if exists automation_outputs_type_check;

alter table public.automation_outputs
  add constraint automation_outputs_type_check
  check (type in ('opusclip_clip', 'super_assistant_script'));

create table if not exists public.automation_run_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.automation_runs(id) on delete cascade,
  type text not null default 'instagram_reel' check (type in ('instagram_reel')),
  position integer not null check (position >= 1 and position <= 6),
  source_url text not null,
  normalized_url text,
  status text not null default 'pending'
    check (status in ('pending', 'extracting', 'transcribing', 'analyzing', 'ready', 'failed')),
  external_id text,
  title text,
  caption text,
  media_url text,
  thumbnail_url text,
  duration_seconds integer,
  metrics jsonb not null default '{}'::jsonb,
  transcript text,
  analysis jsonb,
  error_message text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (run_id, position)
);

drop trigger if exists set_automation_run_items_updated_at on public.automation_run_items;
create trigger set_automation_run_items_updated_at
before update on public.automation_run_items
for each row execute function public.set_updated_at();

create index if not exists automation_run_items_run_position_idx
  on public.automation_run_items (run_id, position asc);

create index if not exists automation_run_items_status_idx
  on public.automation_run_items (status);

-- ── 16. 20260504_lock_down_public_access.sql ──────────────────────────────────────
-- ============================================================
-- ⚠  SECURITY. Do not skip this file.
--
-- Enables row level security on every public table and revokes all privileges
-- from the anon and authenticated roles.
--
-- No policies are created, and that is deliberate: RLS with no policy denies
-- everything, so the only way in is the service_role key, which is server-side
-- only. NEXT_PUBLIC_SUPABASE_ANON_KEY ships to every browser that loads the
-- app — without this migration, anyone who opens devtools can read the entire
-- database.
--
-- Every table added after this date enables RLS and revokes in its own
-- migration, because these statements only affect tables that already exist.
-- ============================================================

alter table if exists public.content_items enable row level security;
alter table if exists public.content_metric_snapshots enable row level security;
alter table if exists public.content_text_assets enable row level security;
alter table if exists public.ai_insights enable row level security;
alter table if exists public.embeddings enable row level security;
alter table if exists public.sync_runs enable row level security;
alter table if exists public.platform_connections enable row level security;
alter table if exists public.platform_comments enable row level security;
alter table if exists public.spark_threads enable row level security;
alter table if exists public.spark_messages enable row level security;
alter table if exists public.platform_connection_briefs enable row level security;
alter table if exists public.competitor_profiles enable row level security;
alter table if exists public.competitor_analysis_runs enable row level security;
alter table if exists public.competitor_content_snapshots enable row level security;
alter table if exists public.automation_runs enable row level security;
alter table if exists public.automation_outputs enable row level security;
alter table if exists public.automation_run_items enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

-- ── 17. 20260724_tiktok_account_metrics.sql ──────────────────────────────────────
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

-- ── 18. 20260724_youtube_support.sql ──────────────────────────────────────
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

-- ── 19. 20260725030445_add_agent_settings.sql ──────────────────────────────────────
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

-- ── 20. 20260725090000_mcp_audit_events.sql ──────────────────────────────────────
-- ============================================================
-- Adds mcp_audit_events: an audit trail for the read-only MCP server.
--
-- Records that a tool was called and by whom, deliberately without storing
-- prompts or transcripts. Created after the lockdown migration, so it enables
-- RLS and revokes on its own.
-- ============================================================

create table if not exists public.mcp_audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  tool_name text not null,
  connection_id uuid references public.platform_connections(id) on delete set null,
  result_count integer,
  duration_ms integer not null check (duration_ms >= 0),
  status text not null check (status in ('success', 'error')),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists mcp_audit_events_user_created_idx
  on public.mcp_audit_events (user_id, created_at desc);

create index if not exists mcp_audit_events_client_created_idx
  on public.mcp_audit_events (client_id, created_at desc);

alter table public.mcp_audit_events enable row level security;
revoke all on public.mcp_audit_events from anon, authenticated;

-- ── 21. 20260726232921_remove_content_assistant.sql ──────────────────────────────────────
-- ============================================================
-- Drops spark_threads and spark_messages, retiring the in-app chat assistant.
-- External agents use the read-only MCP server instead.
-- ============================================================

drop table if exists public.spark_messages;
drop table if exists public.spark_threads;
