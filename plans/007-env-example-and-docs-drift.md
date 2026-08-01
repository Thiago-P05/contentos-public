# Plan 007: Restaurar .env.example y corregir el drift de docs (CLAUDE.md dice Next.js 15)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 7ae93d2..HEAD -- src/lib/env.ts CLAUDE.md README.md .gitignore`
> Ante un mismatch con los excerpts, STOP.
>
> **REGLA CRÍTICA**: jamás copiar valores desde `.env.local` ni ningún archivo
> con credenciales. El `.env.example` lleva SOLO nombres de variables, comentarios
> y placeholders vacíos.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (solo docs y un template)
- **Depends on**: none
- **Category**: dx / docs
- **Planned at**: commit `7ae93d2`, 2026-06-11

## Why this matters

`.env.example` fue borrado (commit `93d290c "Delete .env.example"`) pero el README todavía instruye crearlo a partir de él — onboarding roto. `src/lib/env.ts` valida ~50 variables; sin template, levantar el proyecto en otra máquina es arqueología. Además `CLAUDE.md` (línea 1) dice "Next.js 15" cuando `package.json` tiene `next 16.2.1` — un agente que confíe en esa línea aplicará convenciones equivocadas (en Next 16, p. ej., el middleware se llama `proxy.ts`, no `middleware.ts`).

## Current state

- `.env.example` — NO existe (verificado).
- `README.md` — contiene una instrucción tipo "Crear `.env.local` a partir de `.env.example`" (localizarla con `grep -n "env.example" README.md`).
- `CLAUDE.md:1-3` — dice "Next.js 15 full-stack dashboard…". Real: `package.json` → `"next": "16.2.1"` (o `^16.2.5` si el plan 002 ya corrió).
- `src/lib/env.ts:16-88` — el schema Zod. Lista de variables (líneas verificadas en el commit de planificación):

```
APP_URL, ALLOWED_USER_EMAIL, ALLOWED_USER_ID, AUTH_USERNAME, AUTH_PASSWORD,
AUTH_SECRET, CONNECTION_ENCRYPTION_SECRET, GEMINI_API_KEY, GEMINI_TEXT_MODEL,
GEMINI_EMBEDDING_MODEL, GEMINI_TRANSCRIPTION_MODEL, OPENAI_API_KEY,
OPENAI_BASE_URL, OPENAI_TEXT_MODEL, OPENROUTER_API_KEY,
OPENROUTER_API_KEY_ANALYSIS, OPENROUTER_API_KEY_ANALYSIS_COMPETENCIA,
OPENROUTER_API_KEY_TRANSCRIPTION, OPENROUTER_BASE_URL, OPENROUTER_ANALYSIS_MODEL,
OPENROUTER_ANALYSIS_COMPETENCIA_MODEL, OPENROUTER_TRANSCRIPTION_MODEL,
CONTENT_ASSISTANT_OPENAI_API_KEY, CONTENT_ASSISTANT_XAI_API_KEY,
CONTENT_ASSISTANT_ANTHROPIC_API_KEY, CONTENT_ASSISTANT_GROK_MODEL,
CONTENT_ASSISTANT_CLAUDE_MODEL, CONTENT_ASSISTANT_OPENAI_MODEL,
LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_BASE_URL, LANGFUSE_ENABLED,
LANGFUSE_DEBUG, APIFY_TOKEN, APIFY_INSTAGRAM_ACTOR_ID, OPUSCLIP_API_KEY,
OPUSCLIP_ORG_ID, OPUSCLIP_API_BASE_URL, INSTAGRAM_CLIENT_ID,
INSTAGRAM_CLIENT_SECRET, INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_USER_ID,
INSTAGRAM_API_BASE_URL, INSTAGRAM_GRAPH_API_VERSION, TIKTOK_CLIENT_KEY,
TIKTOK_CLIENT_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, SKIP_AI_ANALYSIS_CONNECTIONS
```

  Además fuera del schema (leídas directo de `process.env`): `CRON_SECRET` (`src/app/api/sync/cron/route.ts:18` — el plan 009 la mueve al schema, incluirla igual en el example), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (`src/proxy.ts:8`).

- Agrupación y comentarios de referencia: la sección "Variables de entorno críticas" de `CLAUDE.md` ya agrupa y explica las críticas — usarla como guía de comentarios.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Ver si gitignore lo excluye | `git check-ignore -v .env.example` | exit 1 (NO ignorado) |
| Confirmar que no hay secretos | revisar a ojo el archivo nuevo | solo nombres y placeholders |

## Scope

**In scope**:
- `.env.example` (crear)
- `CLAUDE.md` (1 línea: versión de Next)
- `README.md` (solo la instrucción de setup que referencia `.env.example`)
- `.gitignore` (solo si `git check-ignore` dice que `.env.example` quedaría ignorado: agregar `!.env.example`)

**Out of scope** (NO tocar):
- `src/lib/env.ts` — el schema no cambia.
- `.env.local` — NI LEERLO.
- El resto del contenido de README.md y CLAUDE.md.

## Git workflow

- Branch: `advisor/007-env-example-docs`
- Commit style: `docs: restaurar .env.example y corregir version de Next en CLAUDE.md`
- NO pushear salvo instrucción del operador.

## Steps

### Step 1: Crear `.env.example`

Leer `src/lib/env.ts` completo para confirmar la lista de arriba (y captar cualquier var agregada después del planning). Crear `.env.example` con TODAS las variables, agrupadas con comentarios en español, valores vacíos o placeholder de formato. Estructura:

```bash
# ── Core ─────────────────────────────────────────────
APP_URL=
# Usuario único autorizado (Supabase Auth)
ALLOWED_USER_EMAIL=
ALLOWED_USER_ID=

# ── Auth ─────────────────────────────────────────────
AUTH_USERNAME=
AUTH_PASSWORD=
AUTH_SECRET=
# Cifrado de tokens de conexiones (fallback: AUTH_SECRET)
CONNECTION_ENCRYPTION_SECRET=

# ── Supabase ─────────────────────────────────────────
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
# ... (continuar con todos los grupos: AI por función, modelos,
#      Langfuse, Apify, OpusClip, Instagram, TikTok, Upstash, Cron)
```

Incluir el comentario regla-de-oro del repo: `# Cada grupo de API keys es independiente — NO reutilizar entre funciones (ver CLAUDE.md)`.

**Verify**: `git check-ignore -v .env.example` → exit 1. Revisar a ojo: cero valores reales.

### Step 2: Corregir CLAUDE.md

Línea ~3: "Next.js 15 full-stack dashboard…" → "Next.js 16 full-stack dashboard…". Verificar también la línea del stack ("**Framework**: Next.js 15…" si existe) con `grep -n "Next.js 15" CLAUDE.md` y corregir todas las ocurrencias.

**Verify**: `grep -n "Next.js 15" CLAUDE.md` → sin resultados.

### Step 3: Corregir el README

`grep -n "env.example" README.md` → actualizar la instrucción a: "Copiar `.env.example` a `.env.local` y completar las credenciales (ver `src/lib/env.ts` para la validación completa)."

**Verify**: `grep -n "env.example" README.md` → la instrucción nueva.

## Test plan

No aplica (docs). La verificación es por greps + revisión visual del example.

## Done criteria

- [ ] `.env.example` existe, trackeable por git, sin ningún valor real
- [ ] Cubre todas las vars de `src/lib/env.ts` + `CRON_SECRET` + las dos `NEXT_PUBLIC_*`
- [ ] `grep -n "Next.js 15" CLAUDE.md` → vacío
- [ ] README apunta al example correctamente
- [ ] `git status` → solo los archivos in-scope
- [ ] Fila actualizada en `plans/README.md`

## STOP conditions

- `src/lib/env.ts` difiere mucho de la lista citada (drift fuerte) — regenerar la lista desde el archivo y continuar SOLO si la diferencia son vars agregadas/quitadas; si la estructura del schema cambió por completo, STOP.
- Cualquier duda sobre si un valor es placeholder o secreto real → no escribirlo, STOP.

## Maintenance notes

- Al agregar una variable a `env.ts`, agregarla al example en el mismo PR — el revisor debe pedirlo.
- El bloque `env:` dummy del workflow de CI (plan 003) debería mantenerse alineado con este example.
