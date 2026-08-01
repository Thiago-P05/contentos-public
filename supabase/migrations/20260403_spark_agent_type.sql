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