import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { McpAuthError, authenticateMcpRequest, enforceMcpRateLimit, getMcpAuthHeaders } from "@/lib/mcp/auth";
import { getMcpConfig } from "@/lib/mcp/config";
import { createContentMcpServer } from "@/lib/mcp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(status: number, error: string, headers?: HeadersInit) {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

async function handleMcpRequest(request: Request) {
  try {
    const auth = await authenticateMcpRequest(request);
    await enforceMcpRateLimit(auth);
    const config = getMcpConfig();

    if (!config) {
      return jsonError(503, "MCP configuration is incomplete.");
    }

    const server = createContentMcpServer(auth);
    const transport = new WebStandardStreamableHTTPServerTransport({
      enableJsonResponse: true,
      allowedHosts: [new URL(config.serverUrl).host],
      enableDnsRebindingProtection: true,
    });

    await server.connect(transport);

    try {
      return await transport.handleRequest(request, {
        authInfo: {
          token: auth.token,
          clientId: auth.clientId,
          scopes: config.scopes,
          expiresAt: auth.expiresAt,
          resource: new URL(config.serverUrl),
          extra: { userId: auth.userId },
        },
      });
    } finally {
      await server.close();
    }
  } catch (error) {
    if (error instanceof McpAuthError) {
      return jsonError(
        error.status,
        error.message,
        error.status === 401 || error.status === 403 ? getMcpAuthHeaders(error.status) : undefined,
      );
    }

    console.error("[mcp]", error);
    return jsonError(500, "Unable to process MCP request.");
  }
}

export const GET = handleMcpRequest;
export const POST = handleMcpRequest;
export const DELETE = handleMcpRequest;
