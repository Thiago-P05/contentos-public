-- ============================================================
-- Adds a content-assistant agent type to the (now removed) Spark threads.
-- ============================================================

alter table public.spark_threads
  drop constraint if exists spark_threads_agent_type_check;

alter table public.spark_threads
  add constraint spark_threads_agent_type_check
  check (agent_type in ('brainstormer', 'copywriting', 'designer', 'video_editor', 'content_assistant'));
