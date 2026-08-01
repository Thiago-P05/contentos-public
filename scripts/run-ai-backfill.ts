import { existsSync } from "node:fs";
import { join } from "node:path";
import { flushLangfuse, shutdownLangfuse } from "@/lib/observability/langfuse";
import { runAIBackfill } from "@/lib/sync/run-ai-backfill";
import type { PlatformFilter } from "@/lib/types";

function loadLocalEnvFiles() {
  const cwd = process.cwd();
  const envFiles = [".env.local", ".env"];

  for (const envFile of envFiles) {
    const filePath = join(cwd, envFile);

    if (existsSync(filePath)) {
      process.loadEnvFile(filePath);
    }
  }
}

function getArgValue(name: string) {
  const prefix = `--${name}=`;
  const value = process.argv.find((entry) => entry.startsWith(prefix));
  return value ? value.slice(prefix.length).trim() : null;
}

function getPlatformFilter(): PlatformFilter | undefined {
  const platform = getArgValue("platform");

  if (!platform) {
    return undefined;
  }

  if (platform === "all" || platform === "instagram" || platform === "tiktok" || platform === "youtube") {
    return platform;
  }

  throw new Error(`Plataforma no soportada: ${platform}`);
}

async function main() {
  loadLocalEnvFiles();

  const limit = Number(getArgValue("limit") ?? "25");
  const result = await runAIBackfill({
    platform: getPlatformFilter(),
    connectionId: getArgValue("connection-id"),
    limit: Number.isFinite(limit) && limit > 0 ? Math.trunc(limit) : 25,
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(async () => {
  await flushLangfuse();
  await shutdownLangfuse();
});
