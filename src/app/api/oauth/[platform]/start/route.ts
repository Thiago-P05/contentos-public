import {
  buildOAuthAuthorizationUrl,
  getOAuthCallbackUrl,
  getOAuthStateCookieConfig,
  isOAuthConfiguredForPlatform,
} from "@/lib/oauth";
import { enforceApiRouteSecurity, logRouteError } from "@/lib/request-security";
import { normalizePlatform } from "@/lib/platforms";
import { createSignedPayload } from "@/lib/secure";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const OAUTH_PKCE_TTL_SECONDS = 60 * 10;
const TIKTOK_PKCE_COOKIE_NAME = "oauth_pkce_tiktok";

type RouteProps = {
  params: Promise<{
    platform: string;
  }>;
};

function createTikTokPkcePair() {
  const codeVerifier = randomBytes(64).toString("hex");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");

  return { codeVerifier, codeChallenge };
}


function getTikTokPkceCookieConfig(value: string) {
  return {
    name: TIKTOK_PKCE_COOKIE_NAME,
    value,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: OAUTH_PKCE_TTL_SECONDS,
  };
}

export async function GET(request: NextRequest, { params }: RouteProps) {
  try {
    await enforceApiRouteSecurity(request, {
      bucket: "oauth-start",
      rateLimit: { limit: 10, windowSeconds: 300 },
      requireOrigin: false,
    });

    const { platform: rawPlatform } = await params;
    const platform = normalizePlatform(rawPlatform);

    if (!platform) {
      return NextResponse.redirect(new URL("/account?error=oauth", request.url));
    }

    if (!isOAuthConfiguredForPlatform(platform)) {
      return NextResponse.redirect(new URL("/account?error=oauth", request.url));
    }

    const requestUrl = new URL(request.url);
    const callbackUrl = new URL(getOAuthCallbackUrl(platform));

    // Preview deployments cannot share the state cookie with the registered callback domain.
    if (requestUrl.origin !== callbackUrl.origin) {
      return NextResponse.redirect(new URL(`/api/oauth/${platform}/start`, callbackUrl.origin));
    }

    const state = createSignedPayload({
      platform,
      nonce: randomUUID(),
      createdAt: new Date().toISOString(),
    });
    const pkcePair = platform === "tiktok" ? createTikTokPkcePair() : null;
    const response = NextResponse.redirect(
      buildOAuthAuthorizationUrl(
        platform,
        state,
        undefined,
        pkcePair ? { codeChallenge: pkcePair.codeChallenge } : undefined,
      ),
    );

    response.cookies.set(getOAuthStateCookieConfig(platform, state));

    if (pkcePair) {
      response.cookies.set(getTikTokPkceCookieConfig(pkcePair.codeVerifier));
    }

    return response;
  } catch (error) {
    logRouteError("oauth-start", error);
    return NextResponse.redirect(new URL("/account?error=oauth", request.url));
  }
}
