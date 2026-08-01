-- ============================================================
-- Drops spark_threads and spark_messages, retiring the in-app chat assistant.
-- External agents use the read-only MCP server instead.
-- ============================================================

drop table if exists public.spark_messages;
drop table if exists public.spark_threads;
