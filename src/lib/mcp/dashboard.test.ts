import { describe, expect, it } from "vitest";
import { summarizeMcpAuditRows } from "@/lib/mcp/dashboard";

describe("MCP dashboard activity", () => {
  it("agrupa llamadas por cliente y conserva su acceso mas reciente", () => {
    expect(
      summarizeMcpAuditRows([
        { client_id: "claude", created_at: "2026-07-25T10:00:00.000Z" },
        { client_id: "claude", created_at: "2026-07-25T09:00:00.000Z" },
        { client_id: "chatgpt", created_at: "2026-07-24T10:00:00.000Z" },
      ]),
    ).toEqual([
      { clientId: "claude", lastSeenAt: "2026-07-25T10:00:00.000Z", calls: 2 },
      { clientId: "chatgpt", lastSeenAt: "2026-07-24T10:00:00.000Z", calls: 1 },
    ]);
  });
});
