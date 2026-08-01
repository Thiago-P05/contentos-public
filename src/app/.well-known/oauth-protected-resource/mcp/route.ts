import { getMcpConfig } from "@/lib/mcp/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = getMcpConfig();

  if (!config) {
    return Response.json(
      { error: "MCP configuration is incomplete." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return Response.json(
    {
      resource: config.serverUrl,
      authorization_servers: [config.authorizationServerUrl],
      scopes_supported: config.scopes,
      bearer_methods_supported: ["header"],
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
