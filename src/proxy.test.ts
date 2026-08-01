import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { proxy } from "@/proxy";

const supabaseMocks = vi.hoisted(() => ({
  getClaims: vi.fn(),
  signOut: vi.fn(),
  createProxySupabaseClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createProxySupabaseClient: supabaseMocks.createProxySupabaseClient,
}));

function request(pathname: string) {
  return new NextRequest(`http://localhost:3000${pathname}`);
}

function expectPassThrough(response: Response) {
  expect(response.status).toBe(200);
  expect(response.headers.get("location")).toBeNull();
}

function expectRedirect(response: Response, pathname: string) {
  expect(response.status).toBe(307);
  const location = response.headers.get("location");
  expect(location).not.toBeNull();
  const redirectUrl = new URL(location!);
  expect(redirectUrl.pathname).toBe(pathname);
  return redirectUrl;
}

describe("auth proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    vi.stubEnv("ALLOWED_USER_ID", "");
    vi.stubEnv("ALLOWED_USER_EMAIL", "");
    supabaseMocks.getClaims.mockResolvedValue({ data: { claims: null }, error: null });
    supabaseMocks.signOut.mockResolvedValue(undefined);
    supabaseMocks.createProxySupabaseClient.mockReturnValue({
      auth: {
        getClaims: supabaseMocks.getClaims,
        signOut: supabaseMocks.signOut,
      },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("deja pasar assets sin consultar la autenticacion", async () => {
    for (const pathname of ["/_next/static/x.js", "/favicon.ico", "/logo.png"]) {
      expectPassThrough(await proxy(request(pathname)));
    }

    expect(supabaseMocks.createProxySupabaseClient).not.toHaveBeenCalled();
  });

  it("aplica el fallback de setup cuando Supabase no esta configurado", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    const pageUrl = expectRedirect(await proxy(request("/dashboard")), "/login");
    expect(pageUrl.searchParams.get("error")).toBe("setup");

    const apiResponse = await proxy(request("/api/x"));
    expect(apiResponse.status).toBe(503);
    await expect(apiResponse.json()).resolves.toEqual({ error: "Supabase Auth no configurado" });

    expectPassThrough(await proxy(request("/login")));
    expect(supabaseMocks.createProxySupabaseClient).not.toHaveBeenCalled();
  });

  it("deja pasar el webhook firmado de TikTok sin una sesion de navegador", async () => {
    expectPassThrough(await proxy(request("/api/webhooks/tiktok")));
    expect(supabaseMocks.createProxySupabaseClient).not.toHaveBeenCalled();
  });

  it("deja pasar MCP para que valide su propio bearer token", async () => {
    expectPassThrough(await proxy(request("/mcp")));
    expectPassThrough(await proxy(request("/.well-known/oauth-protected-resource/mcp")));
    expect(supabaseMocks.createProxySupabaseClient).not.toHaveBeenCalled();
  });

  it("redirige paginas y rechaza APIs cuando no hay usuario autenticado", async () => {
    const pageUrl = expectRedirect(await proxy(request("/dashboard")), "/login");
    expect(pageUrl.searchParams.get("next")).toBe("/dashboard");

    const apiResponse = await proxy(request("/api/x"));
    expect(apiResponse.status).toBe(401);
    await expect(apiResponse.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("permite un usuario por email sin distinguir mayusculas ni espacios", async () => {
    vi.stubEnv("ALLOWED_USER_EMAIL", "  Allowed@Example.COM  ");
    supabaseMocks.getClaims.mockResolvedValue({
      data: { claims: { sub: "user-1", email: " allowed@example.com " } },
      error: null,
    });

    expectPassThrough(await proxy(request("/dashboard")));
    expect(supabaseMocks.signOut).not.toHaveBeenCalled();
  });

  it("permite un usuario por id", async () => {
    vi.stubEnv("ALLOWED_USER_ID", "user-1");
    supabaseMocks.getClaims.mockResolvedValue({
      data: { claims: { sub: "user-1", email: "other@example.com" } },
      error: null,
    });

    expectPassThrough(await proxy(request("/dashboard")));
    expect(supabaseMocks.signOut).not.toHaveBeenCalled();
  });

  it("cierra la sesion y rechaza un usuario no permitido", async () => {
    vi.stubEnv("ALLOWED_USER_EMAIL", "allowed@example.com");
    supabaseMocks.getClaims.mockResolvedValue({
      data: { claims: { sub: "user-2", email: "blocked@example.com" } },
      error: null,
    });

    const redirectUrl = expectRedirect(await proxy(request("/dashboard")), "/login");

    expect(supabaseMocks.signOut).toHaveBeenCalledOnce();
    expect(redirectUrl.searchParams.get("error")).toBe("unauthorized");
  });

  it("redirige al inicio a un usuario permitido que visita login", async () => {
    vi.stubEnv("ALLOWED_USER_ID", "user-1");
    supabaseMocks.getClaims.mockResolvedValue({
      data: { claims: { sub: "user-1", email: null } },
      error: null,
    });

    expectRedirect(await proxy(request("/login")), "/");
  });
});
