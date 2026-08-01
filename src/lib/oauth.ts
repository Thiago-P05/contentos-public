import {
  hasInstagramOAuthConfig,
  hasTikTokOAuthConfig,
  hasYouTubeOAuthConfig,
  requireEnvValue,
} from "@/lib/env";
import { getAbsoluteAppUrl } from "@/lib/secure";
import type { Platform, PlatformConnectionCredentials } from "@/lib/types";

const OAUTH_STATE_TTL_SECONDS = 60 * 10;


type OAuthConnectionResult = {
  platform: Platform;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: string | null;
  refreshTokenExpiresAt: string | null;
  scopes: string[];
  accountExternalId: string;
  accountUsername: string | null;
  displayName: string | null;
  rawProfile: Record<string, unknown>;
};

function asRecord(value: unknown) {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown) {
  return typeof value === "number" ? value : null;
}

function getTikTokErrorCode(payload: Record<string, unknown>) {
  const error = asRecord(payload.error);
  const code = asString(error?.code);
  return code && code !== "ok" && code !== "0" ? code : null;
}

function expiresAtFromSeconds(seconds: number | null) {
  if (!seconds || seconds <= 0) {
    return null;
  }

  return new Date(Date.now() + seconds * 1000).toISOString();
}

async function readJson(response: Response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { raw: text };
  }
}

async function fetchJson(
  input: URL | string,
  init?: RequestInit,
): Promise<Record<string, unknown>> {
  const response = await fetch(input, {
    cache: "no-store",
    ...init,
  });
  const payload = await readJson(response);

  if (!response.ok) {
    throw new Error(`OAuth/API error: ${response.status} ${response.statusText}`);
  }

  return payload;
}

function getInstagramScopes() {
  return ["instagram_business_basic", "instagram_business_manage_insights"];
}

function getTikTokScopes() {
  return ["user.info.basic", "user.info.profile", "user.info.stats", "video.list"];
}

function getYouTubeScopes() {
  return [
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/yt-analytics.readonly",
  ];
}

export function isOAuthConfiguredForPlatform(platform: Platform) {
  switch (platform) {
    case "instagram":
      return hasInstagramOAuthConfig();
    case "tiktok":
      return hasTikTokOAuthConfig();
    case "youtube":
      return hasYouTubeOAuthConfig();
    default:
      return false;
  }
}

export function getOAuthStateCookieName(platform: Platform) {
  return `oauth_state_${platform}`;
}

export function getOAuthStateCookieConfig(platform: Platform, value: string) {
  return {
    name: getOAuthStateCookieName(platform),
    value,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: OAUTH_STATE_TTL_SECONDS,
  };
}

export function getExpiredOAuthStateCookieConfig(platform: Platform) {
  return {
    ...getOAuthStateCookieConfig(platform, ""),
    maxAge: 0,
  };
}

export function getOAuthCallbackUrl(platform: Platform, baseUrl?: string) {
  return getAbsoluteAppUrl(`/api/oauth/${platform}/callback`, baseUrl);
}

export function buildOAuthAuthorizationUrl(
  platform: Platform,
  state: string,
  baseUrl?: string,
  options?: {
    codeChallenge?: string;
  },
) {
  switch (platform) {
    case "instagram": {
      const url = new URL("https://www.instagram.com/oauth/authorize");

      url.searchParams.set("client_id", requireEnvValue("INSTAGRAM_CLIENT_ID"));
      url.searchParams.set("redirect_uri", getOAuthCallbackUrl(platform, baseUrl));
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", getInstagramScopes().join(","));
      url.searchParams.set("state", state);

      return url.toString();
    }
    case "tiktok": {
      const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
      const codeChallenge = options?.codeChallenge;

      if (!codeChallenge) {
        throw new Error();
      }

      url.searchParams.set("client_key", requireEnvValue("TIKTOK_CLIENT_KEY"));
      url.searchParams.set("redirect_uri", getOAuthCallbackUrl(platform, baseUrl));
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", getTikTokScopes().join(","));
      url.searchParams.set("state", state);
      url.searchParams.set('code_challenge', codeChallenge);
      url.searchParams.set('code_challenge_method', 'S256');

      return url.toString();
    }
    case "youtube": {
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");

      url.searchParams.set("client_id", requireEnvValue("YOUTUBE_CLIENT_ID"));
      url.searchParams.set("redirect_uri", getOAuthCallbackUrl(platform, baseUrl));
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", getYouTubeScopes().join(" "));
      url.searchParams.set("state", state);
      url.searchParams.set("access_type", "offline");
      url.searchParams.set("include_granted_scopes", "true");
      url.searchParams.set("prompt", "select_account consent");

      return url.toString();
    }
    default:
      throw new Error(`Unsupported OAuth platform: ${platform satisfies never}`);
  }
}

async function fetchInstagramProfile(accessToken: string) {
  const url = new URL("https://graph.instagram.com/me");

  url.searchParams.set("fields", "user_id,username,name,profile_picture_url");
  url.searchParams.set("access_token", accessToken);

  return fetchJson(url);
}

async function exchangeInstagramCode(
  code: string,
  baseUrl?: string,
): Promise<OAuthConnectionResult> {
  const body = new URLSearchParams({
    client_id: requireEnvValue("INSTAGRAM_CLIENT_ID"),
    client_secret: requireEnvValue("INSTAGRAM_CLIENT_SECRET"),
    grant_type: "authorization_code",
    redirect_uri: getOAuthCallbackUrl("instagram", baseUrl),
    code,
  });

  const shortLivedPayload = await fetchJson("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const shortLivedAccessToken = asString(shortLivedPayload.access_token);

  if (!shortLivedAccessToken) {
    throw new Error("Instagram no devolvio access_token.");
  }

  let accessToken = shortLivedAccessToken;
  let tokenExpiresAt: string | null = null;

  try {
    const exchangeUrl = new URL("https://graph.instagram.com/access_token");

    exchangeUrl.searchParams.set("grant_type", "ig_exchange_token");
    exchangeUrl.searchParams.set("client_secret", requireEnvValue("INSTAGRAM_CLIENT_SECRET"));
    exchangeUrl.searchParams.set("access_token", shortLivedAccessToken);

    const longLivedPayload = await fetchJson(exchangeUrl);
    const longLivedAccessToken = asString(longLivedPayload.access_token);

    if (longLivedAccessToken) {
      accessToken = longLivedAccessToken;
      tokenExpiresAt = expiresAtFromSeconds(asNumber(longLivedPayload.expires_in));
    }
  } catch {
    tokenExpiresAt = null;
  }

  const profile = await fetchInstagramProfile(accessToken);
  const accountExternalId =
    asString(profile.user_id) ??
    asString(shortLivedPayload.user_id) ??
    asString(profile.id);

  if (!accountExternalId) {
    throw new Error("Instagram no devolvio un user_id utilizable.");
  }

  return {
    platform: "instagram",
    accessToken,
    refreshToken: null,
    tokenExpiresAt,
    refreshTokenExpiresAt: null,
    scopes: getInstagramScopes(),
    accountExternalId,
    accountUsername: asString(profile.username),
    displayName: asString(profile.name) ?? asString(profile.username),
    rawProfile: {
      token: shortLivedPayload,
      profile,
    },
  };
}

async function fetchTikTokProfile(accessToken: string) {
  const url = new URL("https://open.tiktokapis.com/v2/user/info/");

  url.searchParams.set(
    "fields",
    "open_id,display_name,avatar_url,username,bio_description,is_verified,follower_count,following_count,likes_count,video_count",
  );

  return fetchJson(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

async function exchangeTikTokCode(
  code: string,
  baseUrl?: string,
  codeVerifier?: string | null,
): Promise<OAuthConnectionResult> {
  if (!codeVerifier) {
    throw new Error("TikTok OAuth requiere code_verifier.");
  }
  const body = new URLSearchParams({
    client_key: requireEnvValue("TIKTOK_CLIENT_KEY"),
    client_secret: requireEnvValue("TIKTOK_CLIENT_SECRET"),
    code,
    grant_type: "authorization_code",
    redirect_uri: getOAuthCallbackUrl("tiktok", baseUrl),
    code_verifier: codeVerifier,
  });

  const tokenPayload = await fetchJson("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const tokenErrorCode = getTikTokErrorCode(tokenPayload);
  if (tokenErrorCode) {
    throw new Error(`TikTok OAuth fallo: ${tokenErrorCode}.`);
  }
  const tokenData = asRecord(tokenPayload.data) ?? tokenPayload;
  const accessToken = asString(tokenData.access_token);
  const refreshToken = asString(tokenData.refresh_token);

  if (!accessToken) {
    throw new Error("TikTok no devolvio access_token.");
  }

  const profilePayload = await fetchTikTokProfile(accessToken);
  const profileErrorCode = getTikTokErrorCode(profilePayload);
  if (profileErrorCode) {
    throw new Error(`TikTok perfil fallo: ${profileErrorCode}.`);
  }
  const user = asRecord(asRecord(profilePayload.data)?.user);

  if (!user) {
    throw new Error("TikTok no devolvio datos de usuario.");
  }
  const accountExternalId = asString(user.open_id);

  if (!accountExternalId) {
    throw new Error("TikTok no devolvio un open_id utilizable.");
  }

  return {
    platform: "tiktok",
    accessToken,
    refreshToken,
    tokenExpiresAt: expiresAtFromSeconds(asNumber(tokenData.expires_in)),
    refreshTokenExpiresAt: expiresAtFromSeconds(asNumber(tokenData.refresh_expires_in)),
    scopes:
      asString(tokenData.scope)?.split(",").filter(Boolean) ??
      asString(tokenData.granted_scopes)?.split(",").filter(Boolean) ??
      getTikTokScopes(),
    accountExternalId,
    accountUsername: asString(user.username),
    displayName: asString(user.display_name) ?? "Cuenta de TikTok",
    rawProfile: {
      token: tokenPayload,
      profile: profilePayload,
    },
  };
}

async function fetchYouTubeChannel(accessToken: string) {
  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.searchParams.set("part", "id,snippet,statistics,contentDetails");
  url.searchParams.set("mine", "true");
  url.searchParams.set("maxResults", "50");

  return fetchJson(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

async function exchangeYouTubeCode(
  code: string,
  baseUrl?: string,
): Promise<OAuthConnectionResult> {
  const body = new URLSearchParams({
    client_id: requireEnvValue("YOUTUBE_CLIENT_ID"),
    client_secret: requireEnvValue("YOUTUBE_CLIENT_SECRET"),
    code,
    grant_type: "authorization_code",
    redirect_uri: getOAuthCallbackUrl("youtube", baseUrl),
  });
  const tokenPayload = await fetchJson("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const accessToken = asString(tokenPayload.access_token);

  if (!accessToken) {
    throw new Error("YouTube no devolvio access_token.");
  }

  const refreshToken = asString(tokenPayload.refresh_token);

  if (!refreshToken) {
    throw new Error("YouTube no devolvio refresh_token. Revoca el acceso de la app en Google y reconecta el canal.");
  }

  const channelPayload = await fetchYouTubeChannel(accessToken);
  const channels = Array.isArray(channelPayload.items)
    ? channelPayload.items.map(asRecord).filter((channel): channel is Record<string, unknown> => Boolean(channel))
    : [];

  if (channels.length !== 1) {
    throw new Error("Google no devolvio un unico canal de YouTube seleccionable.");
  }

  const channel = channels[0]!;
  const snippet = asRecord(channel.snippet);
  const accountExternalId = asString(channel.id);

  if (!accountExternalId) {
    throw new Error("YouTube no devolvio un channel ID utilizable.");
  }

  return {
    platform: "youtube",
    accessToken,
    refreshToken,
    tokenExpiresAt: expiresAtFromSeconds(asNumber(tokenPayload.expires_in)),
    refreshTokenExpiresAt: null,
    scopes: asString(tokenPayload.scope)?.split(" ").filter(Boolean) ?? getYouTubeScopes(),
    accountExternalId,
    accountUsername: asString(snippet?.customUrl),
    displayName: asString(snippet?.title) ?? "Canal de YouTube",
    rawProfile: {
      channel,
    },
  };
}

export async function exchangeOAuthCode(
  platform: Platform,
  code: string,
  baseUrl?: string,
  options?: {
    codeVerifier?: string | null;
  },
) {
  switch (platform) {
    case "instagram":
      return exchangeInstagramCode(code, baseUrl);
    case "tiktok":
      return exchangeTikTokCode(code, baseUrl, options?.codeVerifier ?? null);
    case "youtube":
      return exchangeYouTubeCode(code, baseUrl);
    default:
      throw new Error(`Unsupported OAuth platform: ${platform satisfies never}`);
  }
}

export async function refreshPlatformConnectionTokens(
  connection: PlatformConnectionCredentials,
): Promise<Pick<OAuthConnectionResult, "accessToken" | "refreshToken" | "tokenExpiresAt" | "refreshTokenExpiresAt"> | null> {
  switch (connection.platform) {
    case "instagram": {
      if (!connection.accessToken || !connection.tokenExpiresAt) {
        return null;
      }

      const expiresAt = new Date(connection.tokenExpiresAt).getTime();

      if (expiresAt > Date.now() + 1000 * 60 * 60 * 24 * 7) {
        return null;
      }

      const url = new URL("https://graph.instagram.com/refresh_access_token");

      url.searchParams.set("grant_type", "ig_refresh_token");
      url.searchParams.set("access_token", connection.accessToken);

      const payload = await fetchJson(url);
      const refreshedToken = asString(payload.access_token);

      if (!refreshedToken) {
        return null;
      }

      return {
        accessToken: refreshedToken,
        refreshToken: null,
        tokenExpiresAt: expiresAtFromSeconds(asNumber(payload.expires_in)),
        refreshTokenExpiresAt: null,
      };
    }
    case "tiktok": {
      if (!connection.refreshToken) {
        return null;
      }

      const expiresAt = connection.tokenExpiresAt ? new Date(connection.tokenExpiresAt).getTime() : 0;

      if (expiresAt > Date.now() + 1000 * 60 * 60 * 12) {
        return null;
      }

      const body = new URLSearchParams({
        client_key: requireEnvValue("TIKTOK_CLIENT_KEY"),
        client_secret: requireEnvValue("TIKTOK_CLIENT_SECRET"),
        refresh_token: connection.refreshToken,
        grant_type: "refresh_token",
      });
      const payload = await fetchJson("https://open.tiktokapis.com/v2/oauth/token/", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });
      const tokenData = asRecord(payload.data) ?? payload;
      const accessToken = asString(tokenData.access_token);

      if (!accessToken) {
        return null;
      }

      return {
        accessToken,
        refreshToken: asString(tokenData.refresh_token) ?? connection.refreshToken,
        tokenExpiresAt: expiresAtFromSeconds(asNumber(tokenData.expires_in)),
        refreshTokenExpiresAt:
          expiresAtFromSeconds(asNumber(tokenData.refresh_expires_in)) ??
          connection.refreshTokenExpiresAt,
      };
    }
    case "youtube": {
      if (!connection.refreshToken) {
        return null;
      }

      const expiresAt = connection.tokenExpiresAt ? new Date(connection.tokenExpiresAt).getTime() : 0;

      if (expiresAt > Date.now() + 1000 * 60 * 5) {
        return null;
      }

      const body = new URLSearchParams({
        client_id: requireEnvValue("YOUTUBE_CLIENT_ID"),
        client_secret: requireEnvValue("YOUTUBE_CLIENT_SECRET"),
        refresh_token: connection.refreshToken,
        grant_type: "refresh_token",
      });
      const payload = await fetchJson("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });
      const accessToken = asString(payload.access_token);

      if (!accessToken) {
        return null;
      }

      return {
        accessToken,
        refreshToken: asString(payload.refresh_token) ?? connection.refreshToken,
        tokenExpiresAt: expiresAtFromSeconds(asNumber(payload.expires_in)),
        refreshTokenExpiresAt: null,
      };
    }
    default:
      return null;
  }
}

export async function revokeYouTubeToken(token: string) {
  const body = new URLSearchParams({ token });
  const response = await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`No se pudo revocar el token de YouTube (${response.status}).`);
  }
}

export async function revokeTikTokToken(token: string) {
  const body = new URLSearchParams({
    client_key: requireEnvValue("TIKTOK_CLIENT_KEY"),
    client_secret: requireEnvValue("TIKTOK_CLIENT_SECRET"),
    token,
  });
  const response = await fetch("https://open.tiktokapis.com/v2/oauth/revoke/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });
  const payload = await readJson(response);
  const error = asRecord(payload.error);

  const errorCode = asString(error?.code);
  if (!response.ok || (errorCode && errorCode !== "ok" && errorCode !== "0")) {
    throw new Error(`No se pudo revocar el token de TikTok (${response.status}).`);
  }
}

