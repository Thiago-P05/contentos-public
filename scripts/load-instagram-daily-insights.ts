import { existsSync } from "node:fs";
import { join } from "node:path";
import { env, hasInstagramLegacyConfig } from "@/lib/env";
import { fetchInstagramDailyInsights } from "@/lib/clients/instagram-daily";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { upsertPlatformDailyInsights } from "@/lib/supabase/platform-daily-insights";
import { getActivePlatformConnections, getPlatformConnectionCredentials, upsertPlatformConnection } from "@/lib/supabase/repository";

function loadLocalEnvFiles() {
  const cwd = process.cwd();
  for (const envFile of [".env.local", ".env"]) {
    const filePath = join(cwd, envFile);
    if (existsSync(filePath)) process.loadEnvFile(filePath);
  }
}

async function resolveInstagramConnection() {
  const activeConnections = await getActivePlatformConnections({ platform: "instagram" });
  if (activeConnections.length > 0) {
    return getPlatformConnectionCredentials(activeConnections[0].id);
  }
  if (!hasInstagramLegacyConfig()) throw new Error("No hay conexion OAuth ni token manual de Instagram.");
  const connection = await upsertPlatformConnection({
    platform: "instagram",
    accountExternalId: env.INSTAGRAM_USER_ID!,
    accountUsername: null,
    displayName: "Instagram manual migrado",
    accessToken: env.INSTAGRAM_ACCESS_TOKEN!,
    refreshToken: null,
    tokenExpiresAt: null,
    refreshTokenExpiresAt: null,
    scopes: [],
    rawProfile: { source: "legacy-env" },
  });
  return getPlatformConnectionCredentials(connection.id);
}

async function main() {
  loadLocalEnvFiles();
  const connection = await resolveInstagramConnection();
  if (!connection) throw new Error("No se pudo hidratar la conexion de Instagram.");
  const rows = await fetchInstagramDailyInsights(connection);
  await upsertPlatformDailyInsights(rows);
  const supabase = getSupabaseAdmin();
  const { count, error: countError } = await supabase.from("platform_daily_insights").select("*", { count: "exact", head: true }).eq("platform", "instagram").eq("connection_id", connection.id);
  if (countError) throw countError;
  const { data: sample, error: sampleError } = await supabase.from("platform_daily_insights").select("insight_date, views, impressions, reach, content_interactions, profile_visits, link_clicks, follows, follower_count").eq("platform", "instagram").eq("connection_id", connection.id).order("insight_date", { ascending: false }).limit(5);
  if (sampleError) throw sampleError;
  console.log(JSON.stringify({ connectionId: connection.id, accountExternalId: connection.accountExternalId, rowsLoadedThisRun: rows.length, totalRows: count ?? 0, sample: sample ?? [] }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

