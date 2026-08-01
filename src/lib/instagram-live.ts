import { INSTAGRAM_INSIGHT_METRICS } from "@/lib/constants";
import { env, hasInstagramLegacyConfig, hasSupabaseConfig } from "@/lib/env";
import {
  getActivePlatformConnections,
  getPlatformConnectionCredentials,
} from "@/lib/supabase/repository";
import type {
  AudienceBreakdownEntry,
  AudienceOverview,
  MetricMap,
  PlatformConnectionCredentials,
} from "@/lib/types";

type InsightResponse = {
  data?: Array<{
    name?: string;
    values?: Array<{
      value?: number;
    }>;
  }>;
};

type DemographicResponse = {
  data?: Array<{
    total_value?: {
      breakdowns?: Array<{
        dimension_keys?: string[];
        results?: Array<{
          dimension_values?: string[];
          value?: number;
        }>;
      }>;
    };
  }>;
};

type LiveInstagramCredential = PlatformConnectionCredentials & {
  sourceLabel: string;
};

async function fetchGraph<T>(url: URL | string) {
  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    const rawBody = await response.text();

    throw new Error(
      `Instagram API error: ${response.status} ${response.statusText}${
        rawBody ? ` - ${rawBody}` : ""
      }`,
    );
  }

  return (await response.json()) as T;
}

function toMetricMap(response: InsightResponse) {
  return (response.data ?? []).reduce<MetricMap>((accumulator, metric) => {
    const key = metric.name === "saved" ? "saves" : metric.name;

    if (!key) {
      return accumulator;
    }

    accumulator[key] = metric.values?.[0]?.value ?? null;
    return accumulator;
  }, {});
}

function getLegacyCredential(): LiveInstagramCredential | null {
  if (!hasInstagramLegacyConfig()) {
    return null;
  }

  return {
    id: "legacy-instagram-env",
    platform: "instagram",
    accountExternalId: env.INSTAGRAM_USER_ID!,
    accountUsername: null,
    displayName: "Instagram manual",
    accessToken: env.INSTAGRAM_ACCESS_TOKEN!,
    refreshToken: null,
    tokenExpiresAt: null,
    refreshTokenExpiresAt: null,
    scopes: [],
    status: "active",
    rawProfile: {},
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    sourceLabel: "Instagram",
  };
}

async function resolveInstagramCredentials(preferredConnectionId?: string | null) {
  if (preferredConnectionId && hasSupabaseConfig()) {
    const connection = await getPlatformConnectionCredentials(preferredConnectionId);

    if (connection?.platform === "instagram") {
      return [
        {
          ...connection,
          sourceLabel:
            connection.displayName ??
            connection.accountUsername ??
            connection.accountExternalId,
        },
      ] satisfies LiveInstagramCredential[];
    }
  }

  if (hasSupabaseConfig()) {
    const connections = await getActivePlatformConnections({
      platform: "instagram",
      connectionId: null,
    });

    if (connections.length > 0) {
      const hydratedConnections = await Promise.all(
        connections.map(async (connection) => {
          const fullConnection = await getPlatformConnectionCredentials(connection.id);

          if (!fullConnection) {
            return null;
          }

          return {
            ...fullConnection,
            sourceLabel:
              fullConnection.displayName ??
              fullConnection.accountUsername ??
              fullConnection.accountExternalId,
          } satisfies LiveInstagramCredential;
        }),
      );

      const filteredConnections = hydratedConnections.filter(
        (connection): connection is LiveInstagramCredential => connection !== null,
      );

      if (filteredConnections.length > 0) {
        return filteredConnections;
      }
    }
  }

  const legacyCredential = getLegacyCredential();
  return legacyCredential ? [legacyCredential] : [];
}

async function fetchDemographicBreakdown(
  credential: LiveInstagramCredential,
  breakdown: "city" | "country" | "gender" | "age",
) {
  const url = new URL(
    `${env.INSTAGRAM_API_BASE_URL}/${env.INSTAGRAM_GRAPH_API_VERSION}/${credential.accountExternalId}/insights`,
  );

  url.searchParams.set("metric", "follower_demographics");
  url.searchParams.set("period", "lifetime");
  url.searchParams.set("metric_type", "total_value");
  url.searchParams.set("breakdown", breakdown);
  url.searchParams.set("access_token", credential.accessToken);

  const response = await fetchGraph<DemographicResponse>(url);

  return (
    response.data?.[0]?.total_value?.breakdowns?.[0]?.results?.map((result) => ({
      label: result.dimension_values?.[0] ?? "Sin dato",
      value: result.value ?? 0,
    })) ?? []
  );
}

function normalizeCountryLabel(label: string) {
  try {
    const display = new Intl.DisplayNames(["es"], { type: "region" });
    return display.of(label.toUpperCase()) ?? label;
  } catch {
    return label;
  }
}

function buildAudienceEntries(map: Map<string, number>): AudienceBreakdownEntry[] {
  const total = Array.from(map.values()).reduce((sum, value) => sum + value, 0);

  return Array.from(map.entries())
    .sort((left, right) => right[1] - left[1])
    .map(([label, value]) => ({
      label,
      value,
      share: total > 0 ? (value / total) * 100 : 0,
    }));
}

function mergeAudienceMap(target: Map<string, number>, items: Array<{ label: string; value: number }>) {
  for (const item of items) {
    target.set(item.label, (target.get(item.label) ?? 0) + item.value);
  }
}

export async function fetchInstagramAudienceOverview(
  preferredConnectionId?: string | null,
): Promise<AudienceOverview | null> {
  const {
    AUDIENCE_OVERVIEW_TTL_SECONDS,
    buildAudienceOverviewCacheKey,
    getCachedJson,
    setCachedJson,
  } = await import("@/lib/cache/read-cache");

  const cacheKey = buildAudienceOverviewCacheKey(preferredConnectionId);
  const cached = await getCachedJson<AudienceOverview>(cacheKey);
  if (cached) {
    return cached;
  }

  const credentials = await resolveInstagramCredentials(preferredConnectionId);

  if (credentials.length === 0) {
    return null;
  }

  const cityMap = new Map<string, number>();
  const countryMap = new Map<string, number>();
  const provinceMap = new Map<string, number>();
  const genderMap = new Map<string, number>();
  const ageMap = new Map<string, number>();

  await Promise.all(
    credentials.map(async (credential) => {
      const [cities, countries, genders, ages] = await Promise.all([
        fetchDemographicBreakdown(credential, "city"),
        fetchDemographicBreakdown(credential, "country"),
        fetchDemographicBreakdown(credential, "gender"),
        fetchDemographicBreakdown(credential, "age"),
      ]);

      mergeAudienceMap(cityMap, cities);
      mergeAudienceMap(
        countryMap,
        countries.map((item) => ({
          ...item,
          label: normalizeCountryLabel(item.label),
        })),
      );
      mergeAudienceMap(genderMap, genders);
      mergeAudienceMap(ageMap, ages);

      for (const city of cities) {
        const [, province] = city.label.split(",").map((value) => value.trim());

        if (!province) {
          continue;
        }

        provinceMap.set(province, (provinceMap.get(province) ?? 0) + city.value);
      }
    }),
  );

  const countries = buildAudienceEntries(countryMap);
  const cities = buildAudienceEntries(cityMap);
  const provinces = buildAudienceEntries(provinceMap);
  const genders = buildAudienceEntries(genderMap);
  const ages = buildAudienceEntries(ageMap);
  const totalFollowers =
    countries.reduce((sum, entry) => sum + entry.value, 0) ||
    ages.reduce((sum, entry) => sum + entry.value, 0) ||
    genders.reduce((sum, entry) => sum + entry.value, 0);

  const overview: AudienceOverview = {
    platform: "instagram",
    sourceLabel:
      credentials.length === 1 ? credentials[0]!.sourceLabel : `Instagram (${credentials.length} cuentas)`,
    totalFollowers,
    countries: countries.slice(0, 8),
    cities: cities.slice(0, 8),
    provinces: provinces.slice(0, 8),
    genders,
    ages,
  };

  await setCachedJson(cacheKey, overview, AUDIENCE_OVERVIEW_TTL_SECONDS);
  return overview;
}

export async function fetchInstagramMediaLiveMetrics(
  mediaId: string,
  preferredConnectionId?: string | null,
) {
  const credentials = await resolveInstagramCredentials(preferredConnectionId);
  const credential = credentials[0] ?? null;

  if (!credential) {
    return null;
  }

  const url = new URL(
    `${env.INSTAGRAM_API_BASE_URL}/${env.INSTAGRAM_GRAPH_API_VERSION}/${mediaId}/insights`,
  );

  url.searchParams.set("metric", INSTAGRAM_INSIGHT_METRICS.join(","));
  url.searchParams.set("access_token", credential.accessToken);

  try {
    const response = await fetchGraph<InsightResponse>(url);
    return toMetricMap(response);
  } catch {
    return null;
  }
}

