import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { describe, expect, it } from "vitest";
import { createContentMcpServer } from "@/lib/mcp/server";

const requestHeaders = {
  Accept: "application/json, text/event-stream",
  "Content-Type": "application/json",
};

function rpcRequest(id: number, method: string, params: Record<string, unknown>) {
  return new Request("https://contentos.example.com/mcp", {
    method: "POST",
    headers: requestHeaders,
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
}

describe("ContentOS MCP server", () => {
  it("anuncia los tools read-only del contexto de contenido", async () => {
    const auth = {
      userId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      clientId: "test-client",
      token: "test-token",
      expiresAt: undefined,
    };
    async function dispatch(request: Request) {
      const server = createContentMcpServer(auth);
      const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
      await server.connect(transport);

      try {
        return await transport.handleRequest(request);
      } finally {
        await server.close();
      }
    }

    const initialized = await dispatch(
        rpcRequest(1, "initialize", {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" },
        }),
      );
    expect(initialized.status).toBe(200);

    const toolsResponse = await dispatch(rpcRequest(2, "tools/list", {}));
    const payload = await toolsResponse.json() as { result: { tools: Array<{ name: string; annotations?: { readOnlyHint?: boolean } }> } };

    expect(payload.result.tools.map((tool) => tool.name)).toEqual([
      "list_connections",
      "get_business_brief",
      "search_content",
      "get_content_detail",
      "get_content_transcript",
      "get_content_thumbnail",
      "get_performance_overview",
      "get_script_context",
    ]);
    expect(payload.result.tools.every((tool) => tool.annotations?.readOnlyHint)).toBe(true);
  });
});
