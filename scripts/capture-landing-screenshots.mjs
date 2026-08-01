import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outDir = path.join(repoRoot, "landing", "public", "screenshots");

const baseUrl = process.env.LANDING_CAPTURE_BASE_URL ?? "https://localhost:3010";

const shots = [
  { path: "/", file: "dashboard.png", waitMs: 2500 },
  { path: "/agents", file: "agents.png", waitMs: 2500 },
  { path: "/content", file: "content.png", waitMs: 2500 },
];

async function main() {
  await mkdir(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();

  for (const shot of shots) {
    const url = new URL(shot.path, baseUrl).toString();
    process.stdout.write(`Capturando ${url} -> ${shot.file}...\n`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
    if (shot.waitMs) {
      await new Promise((resolve) => setTimeout(resolve, shot.waitMs));
    }
    const target = path.join(outDir, shot.file);
    await page.screenshot({ path: target, fullPage: true });
  }

  await browser.close();
  process.stdout.write(`Listo. Archivos en: ${outDir}\n`);
}

main().catch((err) => {
  process.stderr.write(`${String(err)}\n`);
  process.exitCode = 1;
});
