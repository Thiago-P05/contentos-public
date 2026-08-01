/**
 * Concatenates supabase/migrations/*.sql into a single file that a self-hoster
 * can paste into the Supabase SQL Editor to provision a fresh project.
 *
 * The bundle drifts silently if it is maintained by hand — that is how RLS once
 * went missing from it — so it is generated. Run this after adding a migration.
 *
 *   node scripts/bundle-migrations.mjs
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = "supabase/migrations";
const OUTPUT = "supabase/run_all_migrations.sql";

const files = readdirSync(MIGRATIONS_DIR)
  .filter((file) => file.endsWith(".sql"))
  .sort();

if (files.length === 0) {
  console.error(`No migrations found in ${MIGRATIONS_DIR}`);
  process.exit(1);
}

const lines = [
  "-- ============================================================",
  "-- ContentOS — all migrations, concatenated in order.",
  "--",
  "-- Generated from supabase/migrations/ — do not edit by hand.",
  "-- Regenerate with: pnpm db:bundle",
  "--",
  "-- ⚠  RUN THIS ONCE, ON A FRESH PROJECT ONLY.",
  "--",
  "-- This bundle replays the whole history, and that history is not purely",
  "-- additive. 20260409_remove_youtube_support.sql deletes every row where",
  "-- platform = 'youtube' — connections, content, metrics, comments and sync",
  "-- runs — because YouTube was dropped in April. It was added back in July",
  "-- by 20260724_youtube_support.sql, but the delete still runs first.",
  "--",
  "-- On an empty database that deletes nothing. On a populated one it will",
  "-- silently destroy your YouTube data. To upgrade an existing database,",
  "-- apply only the individual files from supabase/migrations/ that you have",
  "-- not run yet.",
  "-- ============================================================",
  "",
];

files.forEach((file, index) => {
  lines.push("");
  lines.push(`-- ── ${index + 1}. ${file} ──────────────────────────────────────`);
  lines.push(readFileSync(join(MIGRATIONS_DIR, file), "utf8").replace(/\s+$/, ""));
});

lines.push("");
writeFileSync(OUTPUT, lines.join("\n"), "utf8");
console.log(`Bundled ${files.length} migrations into ${OUTPUT}`);
