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
