# Plan 013: Dejar el baseline de ESLint en verde para habilitar CI

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If a
> STOP condition occurs, stop and report. A dispatched executor must skip the
> `plans/README.md` update because the reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat fc92299..HEAD -- src/app/ask-ai/page.tsx src/components/calendar/publish-modal.tsx`
> Any unexpected in-scope drift is a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/001, plans/011
- **Category**: dx / correctness
- **Planned at**: commit `fc92299`, 2026-07-22

## Why this matters

Plan 003 cannot add a useful blocking CI workflow while the committed source
already fails ESLint. After plan 011 removes the obsolete visx component, three
`react-hooks/set-state-in-effect` errors remain in two active client components.
This plan removes those synchronous effect updates without disabling lint rules
or changing the user-visible Ask AI and calendar behavior.

## Current state

- `src/app/ask-ai/page.tsx:118-124` reads `localStorage` in an effect and calls
  `setChatPanelHidden` synchronously.
- `src/app/ask-ai/page.tsx:145-175` synchronously mirrors
  `requestedThreadId` into state and resets chat state before loading messages.
  Preserve `skipNextThreadFetchRef`; AGENTS.md documents it as the guard against
  overwriting optimistic messages for a newly created thread.
- `src/components/calendar/publish-modal.tsx:32-38` synchronously corrects
  `targetAccountId` from an effect whenever connections or selection change.
- After plan 011, `pnpm exec eslint .` reports exactly these three errors. Existing
  unused-variable warnings are not part of this plan and do not fail lint.

Repository conventions:

- Keep React state local to the client component.
- Prefer deriving values during render when no external synchronization is
  required.
- Effects that read external systems may update state from an asynchronous
  callback with cleanup; do not suppress `react-hooks/set-state-in-effect`.
- Do not add `eslint-disable` comments.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Scoped lint | `pnpm exec eslint src/app/ask-ai/page.tsx src/components/calendar/publish-modal.tsx` | exit 0 |
| Full lint | `pnpm lint` | exit 0, warnings allowed, zero errors |
| Typecheck | `pnpm typecheck` | exit 0 |
| Tests | `pnpm test` | exit 0 |
| Build | `pnpm build` | exit 0 |

If pnpm 11 blocks because the existing `pnpm-workspace.yaml` values are
placeholders, temporarily set only the four existing `allowBuilds` values to
boolean `true`, install/verify, and restore that file exactly before commit.

## Scope

**In scope**:

- `src/app/ask-ai/page.tsx`
- `src/components/calendar/publish-modal.tsx`

**Out of scope**:

- ESLint configuration or rule suppression.
- Existing warning-only files.
- Ask AI API routes, message persistence, or prompt behavior.
- Calendar publishing API behavior.
- `pnpm-workspace.yaml` in the final diff.

## Git workflow

- Branch: `advisor/013-fix-eslint-baseline`
- Commit: `fix: eliminar actualizaciones sincronicas de estado en effects`
- Do not push or open a PR.

## Steps

### Step 1: Remove the synchronous localStorage state update

Refactor the mount-time `localStorage` read so the state setter runs from a
scheduled callback with cleanup, or use another hydration-safe React pattern.
Preserve the existing storage key, fallback `false`, and write-back effect.

**Verify**: scoped ESLint reports no error around the panel state.

### Step 2: Stop synchronously mirroring the requested thread in the effect

Refactor thread selection/loading so URL changes still select the requested
thread, `/ask-ai` still clears the conversation, newly created threads still
preserve optimistic messages through `skipNextThreadFetchRef`, and stale fetch
responses are not made worse. Do not remove the race guard. State updates that
come from `fetchJson` promise callbacks are acceptable.

**Verify**: scoped ESLint exits 0 and typecheck exits 0.

### Step 3: Derive a valid calendar target without an effect setter

Replace the target-account correction effect with render-time derivation or an
event-boundary reset. The displayed account and submitted `accountId` must use a
currently available connection, while an explicit empty selection must remain
empty if the UI supports it.

**Verify**: scoped ESLint and typecheck exit 0.

### Step 4: Run the complete baseline

Run full lint, tests, typecheck, and build. Restore any temporary pnpm workspace
configuration before checking Git scope.

## Test plan

- Existing tests must remain unchanged and pass.
- No component test harness exists; do not add a new testing dependency.
- Run a dev-server smoke check for `/ask-ai` and `/calendar` if the auth setup
  permits it. Report manual interaction as pending if credentials are required.

## Done criteria

- [ ] Full ESLint exits 0 with zero errors.
- [ ] Typecheck, tests, and build exit 0.
- [ ] No `eslint-disable` was added.
- [ ] `skipNextThreadFetchRef` remains active in the new-thread flow.
- [ ] Only the two in-scope source files changed.
- [ ] Worktree is clean after the commit.

## STOP conditions

- Fixing lint requires changing an API route, persisted message behavior, or
  lint configuration.
- Ask AI optimistic messages are lost when a new thread is created.
- Calendar account selection can submit an ID not present in `connections`.
- Any verification error remains after two scoped attempts.

## Maintenance notes

- Plan 003 should be executed from a branch containing this plan after review.
- Reviewer focus: URL-driven thread transitions, the new-thread race guard, and
  calendar submission using the same effective account shown in the UI.
