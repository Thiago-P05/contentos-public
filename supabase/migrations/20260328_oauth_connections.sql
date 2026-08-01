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
