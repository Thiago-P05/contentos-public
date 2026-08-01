import {
  exchangeOAuthCode,
  getExpiredOAuthStateCookieConfig,
  getOAuthStateCookieName,
  isOAuthConfiguredForPlatform,
} from "@/lib/oauth";
import { normalizePlatform } from "@/lib/platforms";
import { enforceApiRouteSecurity, logRouteError } from "@/lib/request-security";
import { verifySignedPayload } from "@/lib/secure";
import { upsertPlatformConnection } from "@/lib/supabase/repository";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const TIKTOK_PKCE_COOKIE_NAME = "oauth_pkce_tiktok";
const OAUTH_STATE_TTL_MS = 1000 * 60 * 10;

type RouteProps = {
  params: Promise<{
    platform: string;
  }>;
};

function getExpiredTikTokPkceCookieConfig() {
  return {
    name: TIKTOK_PKCE_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };
}

export async function GET(request: NextRequest, { params }: RouteProps) {
  try {
    await enforceApiRouteSecurity(request, {
      bucket: "oauth-callback",
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

    const url = new URL(request.url);
    const providerError = url.searchParams.get("error");
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const cookieState = request.cookies.get(getOAuthStateCookieName(platform))?.value;
    const codeVerifier =
      platform === "tiktok" ? request.cookies.get(TIKTOK_PKCE_COOKIE_NAME)?.value ?? null : null;
    const accountUrl = new URL("/account", request.url);

    if (providerError) {
      accountUrl.searchParams.set("error", "oauth");
      const response = NextResponse.redirect(accountUrl);
      response.cookies.set(getExpiredOAuthStateCookieConfig(platform));
      response.cookies.set(getExpiredTikTokPkceCookieConfig());
      return response;
    }

    if (!code || !state || !cookieState || state !== cookieState) {
      accountUrl.searchParams.set("error", "oauth");
      const response = NextResponse.redirect(accountUrl);
      response.cookies.set(getExpiredOAuthStateCookieConfig(platform));
      response.cookies.set(getExpiredTikTokPkceCookieConfig());
      return response;
    }

    if (platform === "tiktok" && !codeVerifier) {
      accountUrl.searchParams.set("error", "oauth");
      const response = NextResponse.redirect(accountUrl);
      response.cookies.set(getExpiredOAuthStateCookieConfig(platform));
      response.cookies.set(getExpiredTikTokPkceCookieConfig());
      return response;
    }

    const parsedState = verifySignedPayload<{ platform: string; createdAt?: string }>(state);
    const createdAt = parsedState?.createdAt ? new Date(parsedState.createdAt).getTime() : Number.NaN;
    const isFreshState =
      Number.isFinite(createdAt) && createdAt <= Date.now() && Date.now() - createdAt <= OAUTH_STATE_TTL_MS;

    if (!parsedState || parsedState.platform !== platform || !isFreshState) {
      accountUrl.searchParams.set("error", "oauth");
      const response = NextResponse.redirect(accountUrl);
      response.cookies.set(getExpiredOAuthStateCookieConfig(platform));
      response.cookies.set(getExpiredTikTokPkceCookieConfig());
      return response;
    }

    try {
      const connection = await exchangeOAuthCode(platform, code, undefined, {
        codeVerifier,
      });
      await upsertPlatformConnection(connection);

      accountUrl.searchParams.set("connected", platform);
      const response = NextResponse.redirect(accountUrl);
      response.cookies.set(getExpiredOAuthStateCookieConfig(platform));
      response.cookies.set(getExpiredTikTokPkceCookieConfig());
      return response;
    } catch (error) {
      logRouteError(`oauth-callback:${platform}`, error);
      accountUrl.searchParams.set("error", "oauth");
      const response = NextResponse.redirect(accountUrl);
      response.cookies.set(getExpiredOAuthStateCookieConfig(platform));
      response.cookies.set(getExpiredTikTokPkceCookieConfig());
      return response;
    }
  } catch (error) {
    logRouteError("oauth-callback", error);
    return NextResponse.redirect(new URL("/account?error=oauth", request.url));
  }
}
