# Security Policy

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Use GitHub's private vulnerability reporting on this repository
(**Security → Report a vulnerability**). It opens a private channel visible only
to the maintainers.

Please include:

- what the issue is and roughly how severe you think it is,
- steps to reproduce, or a proof of concept,
- the version or commit you tested against.

You'll get an initial response within a week. This is a small project maintained
on a best-effort basis — there is no paid security team and no bug bounty.

## Supported versions

Only the latest commit on the default branch is supported. There are no
backported security fixes for older tags.

## What is in scope

Anything in this repository: the Next.js app, the sync pipeline, the OAuth flows,
the MCP server, and the SQL migrations — including the row-level security
policies.

Particularly interesting:

- ways to bypass the single-user allowlist (`src/proxy.ts`,
  `src/lib/server-auth.ts`),
- ways to read data through the `anon` key despite the RLS lockdown in
  `supabase/migrations/20260504_lock_down_public_access.sql`,
- ways to make the read-only MCP server return raw payloads or credentials,
- ways to recover connection tokens without `CONNECTION_ENCRYPTION_SECRET`.

## What is out of scope

- **Misconfigured deployments.** Leaked service-role keys, public Supabase
  signup left enabled, or a missing `ALLOWED_USER_ID` are operator errors, not
  vulnerabilities in this code. The README setup steps cover all three.
- **Third-party services.** Report issues in Supabase, Vercel, OpenRouter, Meta,
  TikTok, Google, Upstash, Langfuse, Apify or OpusClip to those vendors.
- **Vulnerabilities in npm dependencies** with no exploitable path through this
  code. Open a normal issue or a PR bumping the dependency instead.
- The fact that this application is single-user by design. That is documented,
  not a defect — see the README's Limitations.

## Notes for self-hosters

You are the operator of your own instance. The things that actually protect it:

- Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only. It bypasses RLS entirely.
- Set a strong, unique `CONNECTION_ENCRYPTION_SECRET`. It encrypts your platform
  OAuth tokens at rest. Changing it makes existing stored tokens unreadable.
- Disable public signup in Supabase Auth, and verify your allowlist.
- Apply `run_all_migrations.sql` in full. Skipping the lockdown migration leaves
  your tables reachable with the public `anon` key.
- Rotate any secret that has ever been pasted into a log, an issue or a chat.
