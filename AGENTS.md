<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Working on this repo

Read before changing anything. Rules below are ordered by how expensive it is to
get them wrong.

## Setting the project up

Follow [docs/SETUP.md](docs/SETUP.md). You can complete phases 1–3 and 7
unattended. You **cannot** complete phases 4–6: creating Meta, TikTok and Google
developer apps needs a human in a browser accepting legal terms, and usually an
app review. Do what you can, then give the user an exact list of the values you
need back.

## Hard rules

| Rule | Why |
|---|---|
| Never invent a credential or commit `.env.local` | It is gitignored; this repo has never contained real secrets and must not start |
| Never hardcode an account, email, domain or brand name | It is a public repo. Deployment-specific values go in the environment and `.env.example` |
| Schema changes go in `supabase/migrations/`, then `pnpm db:bundle` | The bundle is generated. Hand-editing it is how the RLS migration once went missing, leaving databases publicly readable |
| Do not touch the AI cost guards without proving it | See below — this one costs real money |
| `SUPABASE_SERVICE_ROLE_KEY` is server-side only | It bypasses RLS entirely. Never prefix with `NEXT_PUBLIC_` |

## Verification

```bash
pnpm typecheck   # silence means success
pnpm test
pnpm lint
pnpm build
```

All four must pass before you report work as done. CI runs the same set.

## Conventions

[CLAUDE.md](CLAUDE.md) documents the ones that are easy to get wrong: design
tokens need a dark twin, the typography scale replaces arbitrary pixel values,
`--muted` and `--secondary` are surfaces rather than text colours, and the
display name comes from `NEXT_PUBLIC_APP_NAME` via `src/lib/branding.ts`.

---

# Agentes de IA — ContentOS

La aplicación no incluye un chatbot interno. Los clientes externos consultan datos mediante el MCP remoto de solo lectura en `/mcp`.

El panel `/agents` administra exclusivamente el MCP y los agentes automáticos de análisis y transcripción.

### API Keys — regla de independencia

Cada grupo de keys es independiente y NO se comparte:

| Uso | Env var |
|---|---|
| Análisis de contenido | `OPENROUTER_API_KEY_ANALYSIS` |
| Transcripción de reels | `OPENROUTER_API_KEY_TRANSCRIPTION` |
| Análisis de competencia | `OPENROUTER_API_KEY_ANALYSIS_COMPETENCIA` |
| Fallback general | `OPENROUTER_API_KEY` |

No extender la cadena de fallback para que una key cruce entre dominios — genera confusión y fue reverted (ver commit `d2c2e5e`).

## Agentes de sync: `content_analysis` y `content_transcription`

Corren dentro del sync (`src/lib/sync/run-full-sync.ts`) por cada pieza de contenido, en cada corrida. Las guardas anti-gasto son lo único que evita re-pagar OpenRouter por contenido ya procesado — **no relajarlas ni endurecerlas sin entender esto**:

| Guarda | Regla | Dónde |
|---|---|---|
| Reuso de análisis | Insight existente + status `ready`/`fallback` → `reused`. NO exige `videoPotential` | `shouldReuseExistingAnalysis` en `src/lib/content-analysis-agent.ts` |
| Retry de análisis fallido | Cooldown 24h + máx 5 intentos (`attempts` en `rawPayload.analysisError`) → `skipped` | `shouldSkipFailedAnalysis` (mismo archivo) |
| Reuso de transcripción | Existe text asset `transcript` → `reused` | `getReusableTranscriptState` en `src/lib/reel-transcription.ts` |
| Retry de transcripción fallida | Cooldown 24h vía `transcriptionUpdatedAt` → `skipped` | `shouldSkipFailedTranscription` (mismo archivo) |

- Los outcomes `reused`/`skipped` se acumulan en las stats del sync run (metadata de `sync_runs`).
- Backfill de `videoPotential` faltante: `pnpm sync:ai` (`scripts/run-ai-backfill.ts`) — ese es el camino, NO volver a exigir `videoPotential` en la guarda de reuso del sync.
- Items con análisis fallido 5 veces quedan congelados hasta intervención manual (borrar `analysisError` del rawPayload o re-correr `sync:ai`). Es intencional.
- Verificación de salud: dos `pnpm sync:run` consecutivos → la segunda pasada debe mostrar `analysis.attempted: 0` y `transcription.attempted: 0`.

Las funciones de guarda son puras y tienen tests en `src/lib/content-analysis-agent.test.ts` y `src/lib/reel-transcription.test.ts` — cualquier cambio de comportamiento debe pasar por ahí.
