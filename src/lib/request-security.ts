import "server-only";

import type { User } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { SecurityError } from "@/lib/security-error";
import { requireAllowedUser } from "@/lib/server-auth";

type RateLimitOptions = {
  bucket: string;
  limit: number;
  windowSeconds: number;
};

type RouteSecurityOptions = {
  bucket: string;
  rateLimit?: Omit<RateLimitOptions, "bucket">;
  requireOrigin?: boolean;
};

function isMutatingMethod(method: string) {
  return method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
}

function getAppOrigin() {
  if (!env.APP_URL) {
    throw new SecurityError(503, "Configuracion de seguridad incompleta.");
  }

  return new URL(env.APP_URL).origin;
}

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    const firstIp = forwardedFor
      .split(",")
      .map((value) => value.trim())
      .find(Boolean);

    if (firstIp) {
      return firstIp;
    }
  }

  return request.headers.get("x-real-ip") ?? request.headers.get("cf-connecting-ip") ?? null;
}

function getRateLimitIdentifier(request: Request, user: Pick<User, "id" | "email">) {
  if (user.email) {
    return `user:${user.email.toLowerCase()}`;
  }

  const clientIp = getClientIp(request);
  return clientIp ? `ip:${clientIp}` : `user-id:${user.id}`;
}

function hasUpstashRateLimitConfig() {
  return Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
}

async function incrementFixedWindowCounter(key: string, windowSeconds: number) {
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
    throw new SecurityError(503, "No se pudo validar el rate limit.");
  }

  const payload = (await response.json()) as Array<{ result?: unknown }>;
  const counter = payload[0]?.result;

  if (typeof counter !== "number" || !Number.isFinite(counter)) {
    throw new SecurityError(503, "No se pudo validar el rate limit.");
  }

  return counter;
}

let _warnedMissingRedis = false;

async function enforceRateLimit(
  request: Request,
  user: Pick<User, "id" | "email">,
  options: RateLimitOptions,
) {
  if (!hasUpstashRateLimitConfig()) {
    if (!_warnedMissingRedis) {
      _warnedMissingRedis = true;
      console.warn("[rate-limit] UPSTASH_REDIS_REST_URL/TOKEN not configured — rate limiting is disabled");
    }
    return;
  }

  const windowIndex = Math.floor(Date.now() / (options.windowSeconds * 1000));
  const identifier = getRateLimitIdentifier(request, user);
  const key = `ratelimit:${options.bucket}:${request.method}:${windowIndex}:${identifier}`;
  const counter = await incrementFixedWindowCounter(key, options.windowSeconds);

  if (counter > options.limit) {
    throw new SecurityError(429, "Demasiadas solicitudes. Intenta nuevamente en unos minutos.");
  }
}

export function assertAllowedOrigin(request: Request) {
  const rawOrigin = request.headers.get("origin");
  let requestOrigin: string | null = null;

  if (rawOrigin) {
    try { requestOrigin = new URL(rawOrigin).origin; } catch { /* invalid origin header */ }
  }

  if (!requestOrigin || requestOrigin !== getAppOrigin()) {
    throw new SecurityError(403, "Forbidden");
  }
}

export async function enforceApiRouteSecurity(request: Request, options: RouteSecurityOptions) {
  const user = await requireAllowedUser();

  if (options.requireOrigin ?? isMutatingMethod(request.method)) {
    assertAllowedOrigin(request);
  }

  if (options.rateLimit) {
    await enforceRateLimit(request, user, {
      bucket: options.bucket,
      limit: options.rateLimit.limit,
      windowSeconds: options.rateLimit.windowSeconds,
    });
  }

  return user;
}

export function getPublicErrorMessage(error: unknown, fallback: string) {
  if (error instanceof SecurityError) {
    return error.publicMessage;
  }

  return fallback;
}

export function getErrorStatus(error: unknown, fallback = 500) {
  if (error instanceof SecurityError) {
    return error.status;
  }

  return fallback;
}

export function logRouteError(context: string, error: unknown) {
  console.error(`[${context}]`, error);
}
