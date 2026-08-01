# Plan 009: Mover CRON_SECRET al schema de env validado

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 7ae93d2..HEAD -- src/lib/env.ts src/app/api/sync/cron/route.ts`
> Ante un mismatch con los excerpts, STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security (defense-in-depth)
- **Planned at**: commit `7ae93d2`, 2026-06-11

## Why this matters

Todo el repo centraliza env vars en `src/lib/env.ts` (validación Zod) — excepto `CRON_SECRET`, que el endpoint del cron lee directo de `process.env`. La comparación es correcta (timing-safe), pero la var queda fuera del único inventario auditable de configuración: no aparece en validación, no aparecerá en `.env.example` generado desde el schema, y un typo en el nombre falla silencioso (el endpoint rechaza todo con 401 sin pista). Es el único outlier — alinearlo es barato.

## Current state

- `src/app/api/sync/cron/route.ts:17-23`:

```ts
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;     // ← único acceso directo a process.env del API
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || !isValidCronAuth(authHeader, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
```

  La comparación `isValidCronAuth` (líneas 10–15) usa `timingSafeEqual` correctamente — NO tocarla.

- `src/lib/env.ts` — schema Zod de ~50 vars (campos en líneas 16–88), sin entrada `CRON_SECRET` (verificado con grep). Patrón de var opcional en el schema: mirar cómo está declarada cualquier var opcional existente (p. ej. `APIFY_TOKEN`) y copiar el estilo exacto.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `pnpm typecheck` | exit 0 |
| Tests | `pnpm test` | exit 0 |
| Grep de verificación | `grep -rn "process.env.CRON_SECRET" src/app/` | sin resultados al final; la única lectura permitida queda centralizada en `src/lib/env.ts` |

## Scope

**In scope**:
- `src/lib/env.ts` (agregar 1 campo)
- `src/app/api/sync/cron/route.ts` (cambiar la lectura)

**Out of scope** (NO tocar):
- `isValidCronAuth` y la lógica de comparación.
- Cualquier otra env var o el resto del schema.
- `.env.example` — lo cubre el plan 007 (ya incluye CRON_SECRET en su lista).

## Git workflow

- Branch: `advisor/009-cron-secret-env-schema`
- Commit style: `refactor: mover CRON_SECRET al schema de env`
- NO pushear salvo instrucción del operador.

## Steps

### Step 1: Agregar el campo al schema

En `src/lib/env.ts`, dentro del objeto del schema (líneas 16–88), agregar siguiendo el patrón de las vars opcionales existentes:

```ts
CRON_SECRET: z.string().min(1).optional(),
```

(Debe ser `.optional()`: en dev local sin cron configurado, la app debe seguir arrancando.)

Además, `getEnv()` construye explícitamente el objeto que valida el schema. Agregar allí:

```ts
CRON_SECRET: normalizeEnvValue(process.env.CRON_SECRET),
```

Esta lectura centralizada es intencional y es la única ocurrencia permitida de `process.env.CRON_SECRET`.

**Verify**: `pnpm typecheck` → exit 0.

### Step 2: Usar env.CRON_SECRET en el route

En `src/app/api/sync/cron/route.ts`: importar `env` desde `@/lib/env` (mirar cómo lo importan otros routes, p. ej. `grep -rn "from \"@/lib/env\"" src/app/api/ | head -3`) y cambiar:

```ts
const cronSecret = process.env.CRON_SECRET;
```

por:

```ts
const cronSecret = env.CRON_SECRET;
```

El resto del handler queda idéntico (el check `!cronSecret` ya cubre el caso ausente).

**Verify**: `pnpm typecheck` → exit 0; `grep -rn "process.env.CRON_SECRET" src/app/` → sin resultados; `grep -rn "process.env.CRON_SECRET" src/lib/` → exactamente un resultado en `src/lib/env.ts`.

### Step 3: Verificación funcional

`pnpm test` → exit 0. Verificación manual opcional (requiere `.env.local` con CRON_SECRET): `pnpm dev` y `curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer wrong" http://localhost:3000/api/sync/cron` → `401`.

## Test plan

Sin tests nuevos: `isValidCronAuth` no cambia y el cableado de env está cubierto por typecheck. (Si el repo tuviera tests del route, se extenderían — no los tiene; los tests de routes llegan con el plan 012.)

## Done criteria

- [ ] `grep -n "CRON_SECRET" src/lib/env.ts` → 2 resultados: schema + mapping de `getEnv()`
- [ ] `grep -rn "process.env.CRON_SECRET" src/app/` → 0 resultados
- [ ] `grep -rn "process.env.CRON_SECRET" src/lib/` → exactamente 1 resultado en `src/lib/env.ts`
- [ ] `pnpm typecheck` y `pnpm test` exit 0
- [ ] `git status` → solo los 2 archivos in-scope
- [ ] Fila actualizada en `plans/README.md`

## STOP conditions

- `env.ts` usa un mecanismo distinto a un objeto Zod plano (p. ej. lazy getters por var) y el patrón de arriba no aplica directamente — copiar el patrón real del archivo; si no es evidente, STOP.
- El import de `@/lib/env` en el cron route genera un ciclo de imports o rompe el build.

## Maintenance notes

- Si el cron de Vercel empieza a fallar con 401 tras el deploy, verificar que `CRON_SECRET` esté seteada en el dashboard de Vercel — este cambio no altera el valor esperado, pero es el sospechoso obvio.
- Revisor: confirmar que la comparación timing-safe quedó intacta.
