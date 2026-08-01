# Contributing to ContentOS

Thanks for taking the time. This is a small, self-hosted project — contributions
are welcome, and so is the honest answer that a change may not fit its scope.

## Scope

ContentOS is deliberately **single-user and self-hosted**. Changes that assume a
multi-tenant SaaS, a hosted service, or shared instances across customers are out
of scope unless they come with the full data-ownership rewrite described in the
README's Limitations. Please open an issue to discuss before building anything
that large.

## Getting set up

Follow the [README setup steps](README.md#setup). You need your own Supabase
project; there is no shared development backend.

You do **not** need platform OAuth apps to work on most of the codebase — the app
boots fine with no connected accounts.

## Before you open a pull request

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

CI runs the same four. A PR that fails any of them will not be reviewed until
it's green.

## Conventions

Read [CLAUDE.md](CLAUDE.md) first — it documents the conventions that are easy to
get wrong:

- **Design tokens.** Every token in `:root` needs a twin in `[data-theme="dark"]`.
  Use the typography scale (`text-body`, `text-lead`, …), not arbitrary pixel
  values. `--muted` and `--secondary` are surfaces, not text colours.
- **Never hardcode branding.** The display name comes from
  `NEXT_PUBLIC_APP_NAME` via `src/lib/branding.ts`. Platform colours come from
  `src/lib/platforms.ts`.
- **Never hardcode an account, email or domain.** Anything deployment-specific
  belongs in the environment and in `.env.example`.
- **Database changes go in `supabase/migrations/`**, then run `pnpm db:bundle` to
  regenerate `run_all_migrations.sql`. Do not edit the bundle by hand. New tables
  must enable RLS and revoke from `anon, authenticated` in the same migration —
  see [docs/DATABASE.md](docs/DATABASE.md#changing-the-schema).

### The AI cost guards

The guards in `src/lib/content-analysis-agent.ts` and
`src/lib/reel-transcription.ts` are the only thing stopping a sync from re-paying
OpenRouter for already-processed content. If you touch them, prove it with two
consecutive `pnpm sync:run` passes where the second reports
`analysis.attempted: 0` and `transcription.attempted: 0`, and say so in the PR.

## Commits and pull requests

- Write commit subjects in the imperative: `fix: stop clipping the last week`.
- Keep a PR to one concern. Several unrelated fixes are several PRs.
- Describe what changed and why. If it changes behaviour a self-hoster would
  notice, say so explicitly.
- Add tests for logic changes. The suite is strongest on business logic — keep it
  that way.

## Reporting bugs

Open an issue with: what you expected, what happened, the relevant log output,
and enough environment detail to reproduce it. **Scrub your credentials, account
names and Supabase project ref before pasting anything.**

## Security

Do not open a public issue for a vulnerability. See [SECURITY.md](SECURITY.md).

## Licence

By contributing, you agree that your contributions are licensed under the
[Apache License 2.0](LICENSE), the same terms that cover the project.
