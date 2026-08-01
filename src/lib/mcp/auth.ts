import "server-only";

import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { isAllowedSupabaseUser } from "@/lib/server-auth";
import { getMcpConfig } from "@/lib/mcp/config";

export class McpAuthError extends Error {
  constructor(
    public readonly status: 401 | 403 | 429 | 503,
    message: string,
  ) {
    super(message);
    this.name = "McpAuthError";
  }
}

export type McpAuthContext = {
  userId: string;
  clientId: string;
  token: string;
  expiresAt: number | undefined;
};

function readBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);

  if (!match?.[1]) {
    throw new McpAuthError(401, "Missing bearer token.");
  }

  return match[1];
}

function hasExpectedAudience(audience: unknown, expectedAudience: string) {
  return Array.isArray(audience)
    ? audience.includes(expectedAudience)
    : audience === expectedAudience;
}

export async function authenticateMcpRequest(request: Request): Promise<McpAuthContext> {
  const config = getMcpConfig();

  if (!config) {
    throw new McpAuthError(503, "MCP configuration is incomplete.");
  }

  const token = readBearerToken(request);
  const supabase = createClient(config.authorizationServerUrl.replace(/\/auth\/v1$/, ""), config.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase.auth.getClaims(token);
  const claims = data?.claims;

  if (error || !claims) {
    throw new McpAuthError(401, "Invalid bearer token.");
  }

  const subject = typeof claims.sub === "string" ? claims.sub : null;
  const email = typeof claims.email === "string" ? claims.email : undefined;
  const clientId = typeof claims.client_id === "string" ? claims.client_id : null;
  const expiresAt = typeof claims.exp === "number" ? claims.exp : undefined;

  if (!subject || !clientId || !isAllowedSupabaseUser({ id: subject, email })) {
    throw new McpAuthError(403, "The OAuth user is not authorized for this MCP server.");
  }

  if (claims.iss !== config.authorizationServerUrl || !hasExpectedAudience(claims.aud, config.serverUrl)) {
    throw new McpAuthError(401, "Bearer token was not issued for this MCP server.");
  }

  return { userId: subject, clientId, token, expiresAt };
}

let warnedMissingRateLimitConfig = false;

export async function enforceMcpRateLimit(auth: McpAuthContext) {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    if (!warnedMissingRateLimitConfig) {
      warnedMissingRateLimitConfig = true;
      console.warn("[mcp] UPSTASH_REDIS_REST_URL/TOKEN not configured - rate limiting is disabled");
    }
    return;
  }

  const windowSeconds = 60;
  const windowIndex = Math.floor(Date.now() / (windowSeconds * 1000));
  const key = `ratelimit:mcp:${windowIndex}:${auth.userId}:${auth.clientId}`;
  const response = await fetch(`${env.UPSTASH_REDIS_REST_URL}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([["INCR", key], ["EXPIRE", key, windowSeconds]]),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new McpAuthError(503, "Unable to validate MCP rate limit.");
  }

  const payload = await response.json() as Array<{ result?: unknown }>;
  const count = payload[0]?.result;

  if (typeof count !== "number" || !Number.isFinite(count)) {
    throw new McpAuthError(503, "Unable to validate MCP rate limit.");
  }

  if (count > 120) {
    throw new McpAuthError(429, "Too many MCP requests.");
  }
}

export function getMcpAuthHeaders(status: 401 | 403): Record<string, string> {
  const config = getMcpConfig();

  if (!config) {
    return {};
  }

  const challenge = [
    "Bearer",
    status === 403 ? 'error="insufficient_scope"' : null,
    `resource_metadata="${config.resourceMetadataUrl}"`,
    `scope="${config.scopes.join(" ")}"`,
  ].filter(Boolean).join(", ");

  return { "WWW-Authenticate": challenge };
}
