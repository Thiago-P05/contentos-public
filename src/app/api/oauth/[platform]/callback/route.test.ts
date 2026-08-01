import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSignedPayload } from "@/lib/secure";
import { getOAuthStateCookieName } from "@/lib/oauth";
import { GET } from "@/app/api/oauth/[platform]/callback/route";
import type { Platform } from "@/lib/types";

const oauthMocks = vi.hoisted(() => ({
  exchangeOAuthCode: vi.fn(),
  isOAuthConfiguredForPlatform: vi.fn(),
  upsertPlatformConnection: vi.fn(),
  enforceApiRouteSecurity: vi.fn(),
  logRouteError: vi.fn(),
}));

vi.mock("@/lib/oauth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/oauth")>();
  return {
    ...actual,
    exchangeOAuthCode: oauthMocks.exchangeOAuthCode,
    isOAuthConfiguredForPlatform: oauthMocks.isOAuthConfiguredForPlatform,
  };
});

vi.mock("@/lib/supabase/repository", () => ({
  upsertPlatformConnection: oauthMocks.upsertPlatformConnection,
}));

vi.mock("@/lib/request-security", () => ({
  enforceApiRouteSecurity: oauthMocks.enforceApiRouteSecurity,
  logRouteError: oauthMocks.logRouteError,
}));

const connection = {
  platform: "instagram" as const,
  accessToken: "access-token",
  refreshToken: null,
  tokenExpiresAt: null,
  refreshTokenExpiresAt: null,
  scopes: ["instagram_business_basic"],
  accountExternalId: "account-1",
  accountUsername: "creator",
  displayName: "Creator",
  rawProfile: {},
};

function callbackRequest(
  platform: Platform,
  query: Record<string, string>,
  cookies: Record<string, string> = {},
) {
  const url = new URL(`http://localhost:3000/api/oauth/${platform}/callback`);
  for (const [name, value] of Object.entries(query)) {
    url.searchParams.set(name, value);
  }

  const cookie = Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");

  return new NextRequest(url, cookie ? { headers: { cookie } } : undefined);
}

function createState(platform: Platform) {
  return createSignedPayload({ platform, createdAt: new Date().toISOString() });
}

function callCallback(request: NextRequest, platform: Platform) {
  return GET(request, { params: Promise.resolve({ platform }) });
}

function expectRedirect(response: Response, expectedQuery: string) {
  expect(response.status).toBe(307);
  expect(response.headers.get("location")).toBe(
    `http://localhost:3000/account?${expectedQuery}`,
  );
}

function expectOAuthCookiesExpired(response: Awaited<ReturnType<typeof GET>>, platform: Platform) {
  expect(response.cookies.get(getOAuthStateCookieName(platform))).toMatchObject({
    value: "",
    maxAge: 0,
  });
  expect(response.cookies.get("oauth_pkce_tiktok")).toMatchObject({
    value: "",
    maxAge: 0,
  });
}

describe("OAuth callback", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("CONNECTION_ENCRYPTION_SECRET", "");
    vi.stubEnv("AUTH_SECRET", "oauth-test-secret");
    oauthMocks.isOAuthConfiguredForPlatform.mockReturnValue(true);
    oauthMocks.enforceApiRouteSecurity.mockResolvedValue(undefined);
    oauthMocks.exchangeOAuthCode.mockResolvedValue(connection);
    oauthMocks.upsertPlatformConnection.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rechaza un state distinto al guardado en la cookie", async () => {
    const state = createState("instagram");
    const response = await callCallback(
      callbackRequest(
        "instagram",
        { code: "auth-code", state },
        { [getOAuthStateCookieName("instagram")]: `${state}-different` },
      ),
      "instagram",
    );

    expectRedirect(response, "error=oauth");
    expectOAuthCookiesExpired(response, "instagram");
    expect(oauthMocks.exchangeOAuthCode).not.toHaveBeenCalled();
  });

  it("rechaza un state copiado con firma invalida", async () => {
    const state = "payload.invalid-signature";
    const response = await callCallback(
      callbackRequest(
        "instagram",
        { code: "auth-code", state },
        { [getOAuthStateCookieName("instagram")]: state },
      ),
      "instagram",
    );

    expectRedirect(response, "error=oauth");
    expectOAuthCookiesExpired(response, "instagram");
    expect(oauthMocks.exchangeOAuthCode).not.toHaveBeenCalled();
  });

  it("rechaza un state firmado para otra plataforma", async () => {
    const state = createState("tiktok");
    const response = await callCallback(
      callbackRequest(
        "instagram",
        { code: "auth-code", state },
        { [getOAuthStateCookieName("instagram")]: state },
      ),
      "instagram",
    );

    expectRedirect(response, "error=oauth");
    expectOAuthCookiesExpired(response, "instagram");
    expect(oauthMocks.exchangeOAuthCode).not.toHaveBeenCalled();
  });

  it("rechaza un state firmado vencido", async () => {
    const state = createSignedPayload({
      platform: "youtube",
      createdAt: "2020-01-01T00:00:00.000Z",
    });
    const response = await callCallback(
      callbackRequest(
        "youtube",
        { code: "auth-code", state },
        { [getOAuthStateCookieName("youtube")]: state },
      ),
      "youtube",
    );

    expectRedirect(response, "error=oauth");
    expectOAuthCookiesExpired(response, "youtube");
    expect(oauthMocks.exchangeOAuthCode).not.toHaveBeenCalled();
  });

  it("intercambia y persiste una conexion de YouTube sin PKCE de TikTok", async () => {
    const state = createState("youtube");
    const youtubeConnection = { ...connection, platform: "youtube" as const };
    oauthMocks.exchangeOAuthCode.mockResolvedValue(youtubeConnection);
    const response = await callCallback(
      callbackRequest(
        "youtube",
        { code: "auth-code", state },
        { [getOAuthStateCookieName("youtube")]: state },
      ),
      "youtube",
    );

    expect(oauthMocks.exchangeOAuthCode).toHaveBeenCalledWith(
      "youtube",
      "auth-code",
      undefined,
      { codeVerifier: null },
    );
    expect(oauthMocks.upsertPlatformConnection).toHaveBeenCalledWith(youtubeConnection);
    expectRedirect(response, "connected=youtube");
  });

  it("propaga el error del provider y expira las cookies OAuth", async () => {
    const response = await callCallback(
      callbackRequest(
        "instagram",
        { error: "access_denied" },
        {
          [getOAuthStateCookieName("instagram")]: "state",
          oauth_pkce_tiktok: "verifier",
        },
      ),
      "instagram",
    );

    expectRedirect(response, "error=oauth");
    expectOAuthCookiesExpired(response, "instagram");
    expect(oauthMocks.exchangeOAuthCode).not.toHaveBeenCalled();
  });

  it("rechaza TikTok cuando falta la cookie PKCE", async () => {
    const state = createState("tiktok");
    const response = await callCallback(
      callbackRequest(
        "tiktok",
        { code: "auth-code", state },
        { [getOAuthStateCookieName("tiktok")]: state },
      ),
      "tiktok",
    );

    expectRedirect(response, "error=oauth");
    expectOAuthCookiesExpired(response, "tiktok");
    expect(oauthMocks.exchangeOAuthCode).not.toHaveBeenCalled();
  });

  it("intercambia TikTok con su verifier PKCE y persiste la conexion", async () => {
    const state = createState("tiktok");
    const tiktokConnection = { ...connection, platform: "tiktok" as const };
    oauthMocks.exchangeOAuthCode.mockResolvedValue(tiktokConnection);
    const response = await callCallback(
      callbackRequest(
        "tiktok",
        { code: "auth-code", state },
        {
          [getOAuthStateCookieName("tiktok")]: state,
          oauth_pkce_tiktok: "pkce-verifier",
        },
      ),
      "tiktok",
    );

    expect(oauthMocks.exchangeOAuthCode).toHaveBeenCalledWith(
      "tiktok",
      "auth-code",
      undefined,
      { codeVerifier: "pkce-verifier" },
    );
    expect(oauthMocks.upsertPlatformConnection).toHaveBeenCalledWith(tiktokConnection);
    expectRedirect(response, "connected=tiktok");
  });

  it("intercambia el code, persiste la conexion y expira cookies para Instagram", async () => {
    const state = createState("instagram");
    const response = await callCallback(
      callbackRequest(
        "instagram",
        { code: "auth-code", state },
        { [getOAuthStateCookieName("instagram")]: state },
      ),
      "instagram",
    );

    expect(oauthMocks.exchangeOAuthCode).toHaveBeenCalledWith(
      "instagram",
      "auth-code",
      undefined,
      { codeVerifier: null },
    );
    expect(oauthMocks.upsertPlatformConnection).toHaveBeenCalledWith(connection);
    expectRedirect(response, "connected=instagram");
    expectOAuthCookiesExpired(response, "instagram");
  });

  it("redirige a error y no persiste cuando falla el intercambio", async () => {
    const state = createState("instagram");
    oauthMocks.exchangeOAuthCode.mockRejectedValue(new Error("exchange failed"));

    const response = await callCallback(
      callbackRequest(
        "instagram",
        { code: "auth-code", state },
        { [getOAuthStateCookieName("instagram")]: state },
      ),
      "instagram",
    );

    expectRedirect(response, "error=oauth");
    expectOAuthCookiesExpired(response, "instagram");
    expect(oauthMocks.upsertPlatformConnection).not.toHaveBeenCalled();
  });
});
