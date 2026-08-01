## What changed

<!-- One or two sentences. What does this do, and why? -->

## Why

<!-- The problem this solves. Link the issue if there is one. -->

## Checklist

- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` all pass
- [ ] No hardcoded account, email, domain or brand name — deployment-specific
      values go through the environment and `.env.example`
- [ ] Schema changes live in `supabase/migrations/`, and I ran `pnpm db:bundle`
- [ ] Tests added or updated for logic changes

## If you touched the AI cost guards

`src/lib/content-analysis-agent.ts` and `src/lib/reel-transcription.ts` are the
only thing stopping a sync from re-paying OpenRouter for processed content.

- [ ] Two consecutive `pnpm sync:run` passes; the second reported
      `analysis.attempted: 0` and `transcription.attempted: 0`

## Notes for self-hosters

<!-- Anything an operator needs to do when upgrading: new env vars, a migration
     to apply, changed defaults. Write "none" if there is nothing. -->
