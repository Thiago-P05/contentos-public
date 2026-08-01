import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/oauth/[platform]/start/route";

const oauthMocks = vi.hoisted(() => ({
  buildOAuthAuthorizationUrl: vi.fn(),
  isOAuthConfiguredForPlatform: vi.fn(),
  enforceApiRouteSecurity: vi.fn(),
}));

vi.mock("@/lib/oauth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/oauth")>();
  return {
    ...actual,
    buildOAuthAuthorizationUrl: oauthMocks.buildOAuthAuthorizationUrl,
    isOAuthConfiguredForPlatform: oauthMocks.isOAuthConfiguredForPlatform,
  };
});

vi.mock("@/lib/request-security", () => ({
  enforceApiRouteSecurity: oauthMocks.enforceApiRouteSecurity,
  logRouteError: vi.fn(),
}));

function callStart(request: NextRequest, platform = "youtube") {
  return GET(request, { params: Promise.resolve({ platform }) });
}

describe("OAuth start", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("APP_URL", "https://contentos.example.com");
    vi.stubEnv("CONNECTION_ENCRYPTION_SECRET", "oauth-start-test-secret");
    oauthMocks.isOAuthConfiguredForPlatform.mockReturnValue(true);
    oauthMocks.enforceApiRouteSecurity.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("redirecciona previews al dominio del callback antes de crear state", async () => {
    const response = await callStart(
      new NextRequest("https://contentos-git-feature-owner.vercel.app/api/oauth/youtube/start"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://contentos.example.com/api/oauth/youtube/start",
    );
    expect(response.cookies.get("oauth_state_youtube")).toBeUndefined();
    expect(oauthMocks.buildOAuthAuthorizationUrl).not.toHaveBeenCalled();
  });

  it("inicia OAuth en el dominio configurado", async () => {
    oauthMocks.buildOAuthAuthorizationUrl.mockReturnValue("https://accounts.google.com/o/oauth2/v2/auth");
    const response = await callStart(
      new NextRequest("https://contentos.example.com/api/oauth/youtube/start"),
    );

    expect(response.headers.get("location")).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(response.cookies.get("oauth_state_youtube")?.value).toBeTruthy();
  });
});
