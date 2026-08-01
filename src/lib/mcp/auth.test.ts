import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getClaims: vi.fn(),
  createClient: vi.fn(),
  isAllowedSupabaseUser: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/lib/server-auth", () => ({
  isAllowedSupabaseUser: mocks.isAllowedSupabaseUser,
}));

import { authenticateMcpRequest } from "@/lib/mcp/auth";

function request(token = "token") {
  return new Request("https://contentos.example.com/mcp", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

describe("MCP bearer authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("MCP_SERVER_URL", "https://contentos.example.com/mcp");
    vi.stubEnv("APP_URL", "https://contentos.example.com");
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    mocks.createClient.mockReturnValue({ auth: { getClaims: mocks.getClaims } });
    mocks.isAllowedSupabaseUser.mockReturnValue(true);
    mocks.getClaims.mockResolvedValue({
      data: {
        claims: {
          sub: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          email: "user@example.com",
          client_id: "mcp-client",
          exp: 1_800_000_000,
          iss: "https://project.supabase.co/auth/v1",
          aud: "https://contentos.example.com/mcp",
        },
      },
      error: null,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("acepta un JWT verificado, allowlisted y emitido para este MCP", async () => {
    await expect(authenticateMcpRequest(request())).resolves.toEqual({
      userId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      clientId: "mcp-client",
      token: "token",
      expiresAt: 1_800_000_000,
    });
  });

  it("rechaza tokens emitidos para otro recurso", async () => {
    mocks.getClaims.mockResolvedValue({
      data: {
        claims: {
          sub: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          client_id: "mcp-client",
          iss: "https://project.supabase.co/auth/v1",
          aud: "https://other.example.com/mcp",
        },
      },
      error: null,
    });

    await expect(authenticateMcpRequest(request())).rejects.toMatchObject({ status: 401 });
  });

  it("requiere un bearer token", async () => {
    await expect(authenticateMcpRequest(new Request("https://contentos.example.com/mcp"))).rejects.toMatchObject({ status: 401 });
  });
});
