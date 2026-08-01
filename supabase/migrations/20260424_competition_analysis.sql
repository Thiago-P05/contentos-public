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
