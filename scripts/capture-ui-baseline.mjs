import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const baseUrl = process.env.UI_BASELINE_BASE_URL ?? "http://localhost:3000";
const outRoot = path.resolve(
  repoRoot,
  process.env.UI_BASELINE_OUT ?? ".artifacts/screens/before",
);
const email = process.env.SHOT_EMAIL ?? process.env.ALLOWED_USER_EMAIL ?? "";
const password = process.env.SHOT_PASSWORD ?? "";

const THEMES = ["dark", "light"];

const ROUTES = [
  { path: "/dashboard", file: "dashboard" },
  { path: "/content", file: "content" },
  { path: "/audience", file: "audience" },
  { path: "/calendar", file: "calendar" },
  { path: "/account", file: "account" },
  { path: "/agents", file: "agents" },
  { path: "/patterns", file: "patterns" },
];

// Applied before any script on the page, so the anti-FOUC snippet in
// layout.tsx reads the theme we want instead of falling back to dark.
function themeInitScript(theme) {
  return `try { localStorage.setItem('content-os.theme', ${JSON.stringify(theme)}); } catch (e) {}`;
}

async function signIn(context) {
  if (!email || !password) return false;

  const page = await context.newPage();
  await page.goto(new URL("/login", baseUrl).toString(), {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });

  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');

  try {
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
      timeout: 30_000,
    });
  } catch {
    const message = await page
      .locator("form p")
      .first()
      .textContent()
      .catch(() => null);
    await page.close();
    throw new Error(`Login fallido${message ? `: ${message.trim()}` : ""}`);
  }

  await page.close();
  return true;
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  // Log in once, then reuse the storage state across both theme contexts.
  const authContext = await browser.newContext({ ignoreHTTPSErrors: true });
  const authenticated = await signIn(authContext);
  const storageState = authenticated ? await authContext.storageState() : undefined;
  await authContext.close();

  if (!authenticated) {
    process.stdout.write(
      "AVISO: sin SHOT_EMAIL/SHOT_PASSWORD; solo se captura /login.\n",
    );
  }

  for (const theme of THEMES) {
    const outDir = path.join(outRoot, theme);
    await mkdir(outDir, { recursive: true });

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      ignoreHTTPSErrors: true,
      colorScheme: theme,
      ...(storageState ? { storageState } : {}),
    });
    await context.addInitScript(themeInitScript(theme));

    const page = await context.newPage();
    const targets = authenticated
      ? ROUTES
      : [{ path: "/login", file: "login" }];

    for (const route of targets) {
      const url = new URL(route.path, baseUrl).toString();
      process.stdout.write(`[${theme}] ${route.path} -> ${route.file}.png\n`);
      try {
        await page.goto(url, { waitUntil: "networkidle", timeout: 120_000 });
        await page.waitForTimeout(1200);
        await page.screenshot({
          path: path.join(outDir, `${route.file}.png`),
          fullPage: true,
        });
      } catch (error) {
        process.stderr.write(`  fallo en ${route.path}: ${String(error)}\n`);
      }
    }

    await context.close();
  }

  await browser.close();
  process.stdout.write(`Listo. Archivos en: ${outRoot}\n`);
}

main().catch((err) => {
  process.stderr.write(`${String(err)}\n`);
  process.exitCode = 1;
});
