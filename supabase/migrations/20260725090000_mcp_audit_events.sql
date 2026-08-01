-- ============================================================
-- Adds mcp_audit_events: an audit trail for the read-only MCP server.
--
-- Records that a tool was called and by whom, deliberately without storing
-- prompts or transcripts. Created after the lockdown migration, so it enables
-- RLS and revokes on its own.
-- ============================================================

create table if not exists public.mcp_audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  tool_name text not null,
  connection_id uuid references public.platform_connections(id) on delete set null,
  result_count integer,
  duration_ms integer not null check (duration_ms >= 0),
  status text not null check (status in ('success', 'error')),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists mcp_audit_events_user_created_idx
  on public.mcp_audit_events (user_id, created_at desc);

create index if not exists mcp_audit_events_client_created_idx
  on public.mcp_audit_events (client_id, created_at desc);

alter table public.mcp_audit_events enable row level security;
revoke all on public.mcp_audit_events from anon, authenticated;
