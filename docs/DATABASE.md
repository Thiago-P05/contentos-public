# Database reference

The Postgres schema behind ContentOS, why it is shaped this way, and how to
change it safely.

The database is not passive storage here. It is the product's centre of gravity:
the dashboard, the library, the AI analysis and the MCP server all read the same
tables, so the schema decisions below propagate everywhere.

For exact columns, read the SQL — every migration in `supabase/migrations/` now
carries a header explaining what it does and why. This document covers the shape
and the reasoning, which is the part the SQL cannot tell you.

## Contents

- [Provisioning](#provisioning)
- [Extensions](#extensions)
- [The tables](#the-tables)
- [Design decisions](#design-decisions)
- [Security model](#security-model)
- [Migration history](#migration-history)
- [Changing the schema](#changing-the-schema)

## Provisioning

Run `supabase/run_all_migrations.sql` once, in the SQL Editor of a **fresh**
Supabase project. It is generated from `supabase/migrations/` by `pnpm db:bundle`.

> ⚠ **The bundle is for fresh projects only.** The history is not purely
> additive: `20260409_remove_youtube_support.sql` deletes every row where
> `platform = 'youtube'`. On an empty database that does nothing. On a populated
> one it destroys your YouTube data. To upgrade an existing database, apply only
> the individual files you have not run yet.

Full walkthrough in [SETUP.md](SETUP.md#phase-2--supabase).

## Extensions

| Extension | Used for |
|---|---|
| `pgcrypto` | `gen_random_uuid()` — every primary key |
| `vector` | pgvector, backing the `embeddings` table at 3072 dimensions |
| `pg_trgm` | Trigram indexes on title, description and caption, so substring search in the library does not require a sequential scan |

One shared trigger function, `public.set_updated_at()`, keeps `updated_at`
current on every table that tracks it.

## The tables

Seventeen tables, in four groups.

### Content — the core

| Table | Holds |
|---|---|
| `content_items` | One row per published piece. Platform, external id, publish date, caption, media URLs, analysis status, transcription status, raw payload, and the connection it came from. **The central table** — most queries start here |
| `content_metric_snapshots` | Metrics captured at a point in time, one row per capture. Never overwritten |
| `content_text_assets` | Text belonging to a piece: platform caption, official caption, transcript, fallback metadata |
| `ai_insights` | The LLM verdict per piece: summary, strengths, weaknesses, hooks, improvements, confidence, and the raw model payload |
| `embeddings` | Vector embeddings per piece, for semantic retrieval |
| `platform_comments` | Comments synced from the platforms |

There is also a view, `latest_content_metric_snapshots`, which uses
`distinct on (content_item_id) … order by captured_at desc` to give you the
current value per piece without writing a window function at every call site.

### Accounts

| Table | Holds |
|---|---|
| `platform_connections` | One row per connected account. Tokens are stored in `access_token_encrypted` / `refresh_token_encrypted`, encrypted with `CONNECTION_ENCRYPTION_SECRET`. Unique on `(platform, account_external_id)` |
| `platform_connection_briefs` | The strategic brief per account: offer, ICP, pain, outcome, tone, CTA, notes |
| `platform_daily_insights` | Account-level daily time series — followers, reach, engagement — as opposed to per-piece metrics |

`platform_connection_briefs` is small but load-bearing. Without a brief the model
can only judge whether a piece performed; with one it can judge whether the piece
was aligned with what the account is actually trying to do. It is the difference
between generic advice and analysis about your business.

### Operations

| Table | Holds |
|---|---|
| `sync_runs` | History of sync executions, with per-run stats in metadata. This is where `analysis.attempted` and `transcription.attempted` land — the numbers you check to confirm the AI cost guards are holding |
| `mcp_audit_events` | Audit trail for the read-only MCP server: which tool was called and by whom, deliberately without storing prompts or transcripts |

### Competition and automation

| Table | Holds |
|---|---|
| `competitor_profiles`, `competitor_analysis_runs`, `competitor_content_snapshots` | Competitor tracking, scraped through Apify |
| `automation_runs`, `automation_outputs`, `automation_run_items` | Automated jobs, their results, and per-item progress |

Both groups are further along in the schema than in the exposed UI. That is
deliberate — the data model was prepared before the interface caught up.

## Design decisions

**Metrics are snapshots, not a mutable row.** Overwriting a single "current
metrics" row would be simpler and would destroy the history that makes trends
possible. Every capture appends. `latest_content_metric_snapshots` exists so the
common "just give me the current value" case stays cheap.

**Text lives apart from content.** A single piece can have several textual
sources — the platform caption, an official caption, a transcript, fallback
metadata. Keeping them in `content_text_assets` instead of columns on
`content_items` makes the provenance of each string explicit and lets analysis
and search reuse them without guessing.

**Content is persisted before AI runs.** The sync writes the piece and its
metrics first, then attempts transcription and analysis. A model failure or an
exhausted budget costs you the enrichment, never the sync.

**Transcription has its own lifecycle.** `transcription_status` and
`transcription_updated_at` are independent of analysis status. That timestamp is
not bookkeeping: the cost guard reads it to apply a 24-hour cooldown after a
failure, which is part of what stops every run re-paying to transcribe the same
broken video.

**Raw payloads are kept.** `raw_payload` columns hold what the platform actually
returned. Platforms change their APIs, and reprocessing stored payloads is much
cheaper than re-fetching history you may no longer be able to reach.

## Security model

Three layers, and they only work together:

1. **RLS is enabled on every table.**
2. **No policies exist.** RLS with no policy denies everything. This is
   intentional, not an oversight.
3. **`anon` and `authenticated` are revoked** from all tables, sequences and
   functions.

The only way into the data is the `service_role` key, used server-side. The app
never queries Postgres from the browser.

This matters because `NEXT_PUBLIC_SUPABASE_ANON_KEY` ships to every browser that
loads the app. Without the lockdown, anyone who opens devtools reads the whole
database. `20260504_lock_down_public_access.sql` is the migration that closes it
— never skip it.

Its statements only affect tables that existed when it ran, so **every table
added afterwards enables RLS and revokes in its own migration**. If you add a
table, you must do the same:

```sql
alter table public.your_new_table enable row level security;
revoke all on public.your_new_table from anon, authenticated;
```

Verify a live database with:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
```

Every row must read `true`.

## Migration history

Twenty-one migrations. The ones worth knowing about:

| Migration | What it did |
|---|---|
| `20260326_init` | Core content model, extensions, `set_updated_at()` |
| `20260328_oauth_connections` | Made the app multi-account. Before this, credentials came from env vars and there was one implicit account |
| `20260330_phase2_performance` | Indexes, `pg_trgm`, the latest-snapshot view |
| `20260404_connection_briefs…` | Strategic briefs — the AI stops being generic |
| `20260409_remove_youtube_support` | ⚠ Destructive. Deleted all YouTube data |
| `20260504_lock_down_public_access` | ⚠ Security. RLS and revokes |
| `20260724_youtube_support` | YouTube returns, three months later. Adds `platform_daily_insights` |
| `20260725090000_mcp_audit_events` | Audit trail for the MCP server |
| `20260726232921_remove_content_assistant` | Drops `spark_threads` / `spark_messages`, retiring the in-app chat |

Two oddities that look like mistakes and are not:

- **YouTube is removed and then re-added.** April dropped it, July brought it
  back. Replaying the history on a fresh database ends with YouTube supported.
- **`spark_threads` and `spark_messages` are created and later dropped.** They
  backed an in-app chat assistant that was retired; external agents now use the
  read-only MCP server instead.

## Changing the schema

1. Add a new file to `supabase/migrations/`, named `YYYYMMDDHHMMSS_what_it_does.sql`.
2. Start it with a comment explaining **what and why**. Every existing migration
   does; the next person reading it will not have your context.
3. If you create a table, enable RLS and revoke from `anon, authenticated` in the
   same file.
4. End every statement with a semicolon — the bundle concatenates files, and a
   missing semicolon merges statements across the boundary.
5. Regenerate the bundle:

```bash
pnpm db:bundle
```

Never edit `run_all_migrations.sql` directly. It is generated, and hand-editing
it is exactly how the RLS migration once went missing from it — leaving anyone
who followed the documented setup with a publicly readable database.
