import { afterEach, describe, expect, it, vi } from "vitest";
import { getMcpConfig } from "@/lib/mcp/config";

describe("MCP configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("deriva la URL canonica desde APP_URL cuando MCP_SERVER_URL no existe", () => {
    vi.stubEnv("APP_URL", "https://contentos.example.com/");
    vi.stubEnv("MCP_SERVER_URL", "");
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");

    expect(getMcpConfig()).toMatchObject({
      serverUrl: "https://contentos.example.com/mcp",
      authorizationServerUrl: "https://project.supabase.co/auth/v1",
      resourceMetadataUrl: "https://contentos.example.com/.well-known/oauth-protected-resource/mcp",
      scopes: ["openid", "profile", "email"],
    });
  });

  it("requiere configuracion publica de Supabase y una URL del servidor", () => {
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("MCP_SERVER_URL", "");
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");

    expect(getMcpConfig()).toBeNull();
  });
});
