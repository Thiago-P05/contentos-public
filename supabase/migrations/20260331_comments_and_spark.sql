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
