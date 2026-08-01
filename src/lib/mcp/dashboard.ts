import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getMcpConfig } from "@/lib/mcp/config";

type McpAuditRow = {
  client_id: string;
  created_at: string;
};

export type McpClientActivity = {
  clientId: string;
  lastSeenAt: string;
  calls: number;
};

export function summarizeMcpAuditRows(rows: McpAuditRow[]) {
  const clients = new Map<string, McpClientActivity>();

  for (const row of rows) {
    const existing = clients.get(row.client_id);

    if (existing) {
      existing.calls += 1;
      continue;
    }

    clients.set(row.client_id, {
      clientId: row.client_id,
      lastSeenAt: row.created_at,
      calls: 1,
    });
  }

  return [...clients.values()];
}

export async function getMcpDashboardOverview() {
  const config = getMcpConfig();

  if (!config) {
    return {
      configured: false,
      serverUrl: null,
      clients: [] as McpClientActivity[],
      activityAvailable: false,
    };
  }

  try {
    const { data, error } = await getSupabaseAdmin()
      .from("mcp_audit_events")
      .select("client_id, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      return {
        configured: true,
        serverUrl: config.serverUrl,
        clients: [] as McpClientActivity[],
        activityAvailable: false,
      };
    }

    return {
      configured: true,
      serverUrl: config.serverUrl,
      clients: summarizeMcpAuditRows((data ?? []) as McpAuditRow[]),
      activityAvailable: true,
    };
  } catch {
    return {
      configured: true,
      serverUrl: config.serverUrl,
      clients: [] as McpClientActivity[],
      activityAvailable: false,
    };
  }
}
