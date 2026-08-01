import { existsSync } from "node:fs";
import { join } from "node:path";
import { flushLangfuse, shutdownLangfuse } from "@/lib/observability/langfuse";
import { runFullSync } from "@/lib/sync/run-full-sync";

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

async function main() {
  loadLocalEnvFiles();
  const result = await runFullSync();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(async () => {
  await flushLangfuse();
  await shutdownLangfuse();
});
