import "server-only";

import { env } from "@/lib/env";

/**
 * Thin Upstash Redis REST client (pipeline).
 * Fail-open: every helper returns null/false when Redis is missing or errors.
 * Same env vars as rate limiting: UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN.
 */

export function isRedisConfigured() {
  return Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
}

let _warnedMissingRedis = false;

function warnMissingRedisOnce() {
  if (_warnedMissingRedis) {
    return;
  }
  _warnedMissingRedis = true;
  console.warn(
    "[cache] UPSTASH_REDIS_REST_URL/TOKEN not configured — read caches are disabled",
  );
}

async function redisPipeline(
  commands: unknown[][],
): Promise<Array<{ result?: unknown }> | null> {
  if (!isRedisConfigured()) {
    warnMissingRedisOnce();
    return null;
  }

  try {
    const response = await fetch(`${env.UPSTASH_REDIS_REST_URL}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commands),
      cache: "no-store",
    });

    if (!response.ok) {
      console.warn(`[cache] Redis pipeline failed: HTTP ${response.status}`);
      return null;
    }

    return (await response.json()) as Array<{ result?: unknown }>;
  } catch (error) {
    console.warn(
      "[cache] Redis pipeline error:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/** Returns the string value, or null on miss / error / unconfigured. */
export async function redisGet(key: string): Promise<string | null> {
  const payload = await redisPipeline([["GET", key]]);
  const result = payload?.[0]?.result;

  if (typeof result === "string") {
    return result;
  }

  return null;
}

/** SET key value EX ttlSeconds. Returns false on failure (fail-open). */
export async function redisSetEx(
  key: string,
  value: string,
  ttlSeconds: number,
): Promise<boolean> {
  const payload = await redisPipeline([["SET", key, value, "EX", ttlSeconds]]);
  return payload !== null;
}

/** INCR key. Returns the new value, or null on failure. */
export async function redisIncr(key: string): Promise<number | null> {
  const payload = await redisPipeline([["INCR", key]]);
  const result = payload?.[0]?.result;

  if (typeof result === "number" && Number.isFinite(result)) {
    return result;
  }

  return null;
}
