import "server-only";

import { env } from "@/lib/env";

// Supabase OAuth Server currently publishes these standard OIDC scopes only.
// Content access remains enforced by the read-only MCP tool contract.
export const MCP_OAUTH_SCOPES = ["openid", "profile", "email"];

function withoutTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function getMcpConfig() {
  const appUrl = env.APP_URL ? withoutTrailingSlash(env.APP_URL) : null;
  const serverUrl = env.MCP_SERVER_URL
    ? withoutTrailingSlash(env.MCP_SERVER_URL)
    : appUrl
      ? `${appUrl}/mcp`
      : null;
  const supabaseUrl = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? null;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? null;

  if (!serverUrl || !supabaseUrl || !anonKey) {
    return null;
  }

  return {
    serverUrl,
    authorizationServerUrl: `${withoutTrailingSlash(supabaseUrl)}/auth/v1`,
    anonKey,
    scopes: MCP_OAUTH_SCOPES,
    resourceMetadataUrl: `${new URL(serverUrl).origin}/.well-known/oauth-protected-resource/mcp`,
  };
}
