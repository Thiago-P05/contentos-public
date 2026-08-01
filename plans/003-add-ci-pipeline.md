# Plan 003: Agregar CI con GitHub Actions para que nada deploye sin pasar lint, typecheck y tests

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 7ae93d2..HEAD -- .github/ package.json`
> Si ya existe `.github/workflows/`, STOP — alguien agregó CI desde que se escribió este plan.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW (solo agrega archivos nuevos; no toca código fuente)
- **Depends on**: plans/001 (la suite debe estar verde — un CI que nace en rojo se ignora para siempre)
- **Category**: dx
- **Planned at**: commit `7ae93d2`, 2026-06-11

## Why this matters

No existe `.github/workflows/` — cero CI. Vercel auto-deploya el branch `contentOS-dashboard-v2` en cada push, así que typecheck roto, lint roto o tests rotos llegan a producción sin que nada lo frene. Proyecto de un solo desarrollador sin code review: el CI es la única red de seguridad posible. Hoy mismo la suite está en rojo (1 test stale, ver plan 001) y nadie lo notó — exactamente el problema que esto arregla.

## Current state

- No existe `.github/` en el repo.
- Stack: Next.js 16, TypeScript, **pnpm 11.2.2** (hay `pnpm-lock.yaml` en el root). pnpm 11 requiere Node >=22.13 y GitHub Actions depreca Node 20, por lo que CI usa Node 24.
- Comandos del repo (de `package.json` scripts, verificados):
  - `pnpm lint` → eslint
  - `pnpm typecheck` → tsc --noEmit
  - `pnpm test` → vitest run --coverage
  - `pnpm build` → next build
- **Advertencia sobre el build**: `src/lib/env.ts` valida ~50 env vars con Zod y `next.config.ts` lee `APP_URL`/`SUPABASE_URL` (tolera ausencia). Es posible que `pnpm build` falle en CI sin env vars. El Step 3 lo maneja.
- `package.json` tiene `pnpm.onlyBuiltDependencies: ["esbuild", "sharp", "protobufjs", "unrs-resolver"]` — pnpm 10+ respeta esto automáticamente.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Validar YAML localmente | `npx --yes yaml-lint .github/workflows/ci.yml` (o revisar a ojo) | sin errores de sintaxis |
| Suite local (simula CI) | `pnpm lint; pnpm typecheck; pnpm test` | exit 0 cada uno |
| Build local | `pnpm build` | exit 0 |

## Scope

**In scope**:
- `.github/workflows/ci.yml` (crear)

**Out de scope** (NO tocar):
- Cualquier archivo de `src/`, `package.json`, configs.
- Configuración de Vercel (`vercel.json`) — el gate de deploy en Vercel ("solo deployar si CI pasa") es configuración del dashboard de Vercel, no del repo; queda como nota para el operador.
- Pre-commit hooks — fuera de alcance.

## Git workflow

- Branch: `advisor/003-add-ci-pipeline`
- Commit style: `ci: agregar workflow de lint, typecheck, test y build`
- NO pushear salvo instrucción del operador (nota: el workflow solo se puede probar de verdad pusheado; ver Step 4).

## Steps

### Step 1: Crear el workflow

Crear `.github/workflows/ci.yml` con este contenido:

```yaml
name: CI

on:
  push:
    branches: ["**"]
  pull_request:

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
        env:
          # Valores dummy SOLO para que el build de Next compile.
          # Nunca poner secretos reales acá.
          SUPABASE_URL: "https://dummy.supabase.co"
          SUPABASE_SERVICE_ROLE_KEY: "dummy"
          AUTH_SECRET: "dummy-secret-for-ci-build-only"
          AUTH_USERNAME: "ci"
          AUTH_PASSWORD: "ci"
```

Nota: `pnpm/action-setup@v4` lee la versión de pnpm del `packageManager` field si existe; si el repo no lo tiene, agregar `with: { version: 10 }` al action.

**Verify**: el archivo existe y `git status` lo muestra como nuevo.

### Step 2: Simular el job validate localmente

Correr en orden: `pnpm lint`, `pnpm typecheck`, `pnpm test`.

**Verify**: los tres exit 0. Si `pnpm test` falla en `dashboard-range.test.ts`, el plan 001 no se ejecutó — STOP (dependencia).

### Step 3: Simular el job build localmente SIN .env.local

PowerShell (para no usar el `.env.local` real, renombrarlo temporalmente):

```powershell
Rename-Item .env.local .env.local.bak
$env:SUPABASE_URL="https://dummy.supabase.co"; $env:SUPABASE_SERVICE_ROLE_KEY="dummy"; $env:AUTH_SECRET="dummy-secret-for-ci-build-only"; $env:AUTH_USERNAME="ci"; $env:AUTH_PASSWORD="ci"
pnpm build
Rename-Item .env.local.bak .env.local
```

**Verify**: `pnpm build` exit 0. Si falla por una env var faltante, agregar ESA var con valor dummy al bloque `env:` del workflow Y a este step, y reintentar. Si tras 3 vars agregadas sigue fallando, STOP y reportar la lista completa de vars exigidas.

**IMPORTANTE**: restaurar `.env.local` SIEMPRE, incluso si el build falla.

### Step 4: Entregar nota para el operador

Agregar al reporte final (no a un archivo): para que el CI realmente bloquee deploys, el operador debe (a) pushear este branch y verificar que el workflow corre en verde en GitHub Actions, y (b) en Vercel → Settings → Git, activar "Only deploy if checks pass" (o configurar branch protection en GitHub). Eso no se puede hacer desde el repo.

## Test plan

El workflow ES el test. Verificación real ocurre en el primer push (queda en manos del operador).

## Done criteria

- [ ] `.github/workflows/ci.yml` existe con los 2 jobs
- [ ] `pnpm lint && pnpm typecheck && pnpm test` exit 0 localmente
- [ ] `pnpm build` exit 0 con env dummy y sin `.env.local`
- [ ] `.env.local` restaurado (verificar que existe)
- [ ] `git status` → solo `.github/workflows/ci.yml` nuevo
- [ ] Fila actualizada en `plans/README.md`

## STOP conditions

- Ya existe `.github/workflows/` con contenido.
- `pnpm test` falla (dependencia del plan 001 incumplida).
- El build exige más de 3 env vars adicionales a las del Step 1 (la validación de env es más agresiva de lo esperado — reportar la lista; quizá convenga un job de build sin validación o ajustar `env.ts`, decisión del operador).
- `.env.local` no existe al empezar el Step 3 (no hay nada que renombrar — en ese caso simplemente correr el build con las vars dummy).

## Maintenance notes

- Cuando exista `.env.example` (plan 007), el bloque dummy del workflow debería derivarse de él.
- El job `build` con dummies NO valida lógica de runtime, solo compilación. Tests e2e quedan para otro plan (012 cubre tests de integración unitarios).
- Si se agregan migraciones de Supabase al flujo, considerar un job que valide migraciones — fuera de alcance hoy.
