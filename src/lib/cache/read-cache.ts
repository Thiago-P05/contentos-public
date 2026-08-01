import "server-only";

import { redisGet, redisIncr, redisSetEx } from "@/lib/cache/redis";
import type { DashboardRange, PlatformFilter } from "@/lib/types";

/** Global generation counter — INCR on successful sync to invalidate overview keys. */
export const DASHBOARD_GEN_KEY = "dashboard:gen";

/** Short TTL for expensive dashboard overview reads. */
export const DASHBOARD_OVERVIEW_TTL_SECONDS = 120;

/** Short TTL for content catalog reads; the shared generation invalidates after sync. */
export const CONTENT_CATALOG_TTL_SECONDS = 120;

/** Demographics change slowly; longer TTL is fine. */
export const AUDIENCE_OVERVIEW_TTL_SECONDS = 6 * 60 * 60;

export async function getDashboardCacheGeneration(): Promise<number> {
  const raw = await redisGet(DASHBOARD_GEN_KEY);

  if (raw === null) {
    return 0;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Bump gen so all overview keys that embed it become unreachable. Fail-open. */
export async function bumpDashboardCacheGeneration(): Promise<void> {
  await redisIncr(DASHBOARD_GEN_KEY);
}

export function buildDashboardOverviewCacheKey(params: {
  gen: number;
  range: DashboardRange;
  platform: PlatformFilter;
  connectionId?: string | null;
  anchor?: string | null;
}) {
  const connection = params.connectionId?.trim() || "all";
  const anchor = params.anchor?.trim() || "latest";
  return `dashboard:overview:v1:${params.gen}:${params.range}:${params.platform}:${connection}:${anchor}`;
}

export function buildAudienceOverviewCacheKey(connectionId?: string | null) {
  const connection = connectionId?.trim() || "all";
  return `audience:overview:v1:${connection}`;
}

type ContentCacheParams = {
  gen: number;
  platform?: PlatformFilter;
  query?: string;
  connectionId?: string | null;
  limit?: number;
  offset?: number;
  publishedAfter?: string;
};

function buildContentCacheKey(scope: "catalog" | "library", params: ContentCacheParams) {
  const values = [
    params.platform ?? "all",
    params.connectionId?.trim() || "all",
    params.limit ?? "all",
    params.offset ?? 0,
    params.publishedAfter ?? "all",
    params.query?.trim() || "all",
  ].map((value) => encodeURIComponent(String(value)));
  return `content:${scope}:v1:${params.gen}:${values.join(":")}`;
}

export function buildContentCatalogCacheKey(params: ContentCacheParams) {
  return buildContentCacheKey("catalog", params);
}

export function buildContentLibraryCacheKey(params: ContentCacheParams) {
  return buildContentCacheKey("library", params);
}

export async function getCachedJson<T>(key: string): Promise<T | null> {
  const raw = await redisGet(key);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    console.warn(`[cache] Failed to parse JSON for key ${key}`);
    return null;
  }
}

export async function setCachedJson(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  try {
    const serialized = JSON.stringify(value);
    await redisSetEx(key, serialized, ttlSeconds);
  } catch (error) {
    console.warn(
      `[cache] Failed to serialize/set key ${key}:`,
      error instanceof Error ? error.message : error,
    );
  }
}
