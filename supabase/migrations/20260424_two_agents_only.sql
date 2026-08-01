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
