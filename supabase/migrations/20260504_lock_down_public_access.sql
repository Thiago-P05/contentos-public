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
