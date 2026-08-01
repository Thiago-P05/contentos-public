import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function writeMcpAuditEvent(input: {
  userId: string;
  clientId: string;
  toolName: string;
  connectionId?: string | null;
  resultCount?: number | null;
  durationMs: number;
  status: "success" | "error";
}) {
  try {
    const payload = {
      user_id: input.userId,
      client_id: input.clientId,
      tool_name: input.toolName,
      connection_id: input.connectionId ?? null,
      result_count: input.resultCount ?? null,
      duration_ms: input.durationMs,
      status: input.status,
    } as never;
    const { error } = await getSupabaseAdmin().from("mcp_audit_events").insert(payload);

    if (error) {
      console.error("[mcp-audit]", error.message);
    }
  } catch (error) {
    // Audit availability must not block a read-only request.
    console.error("[mcp-audit] Failed to write audit event", error);
  }
}
