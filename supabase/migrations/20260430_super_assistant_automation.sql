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
