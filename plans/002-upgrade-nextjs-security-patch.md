# Plan 002: Actualizar Next.js a ≥16.2.5 para cerrar las vulnerabilidades high del audit

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 7ae93d2..HEAD -- package.json pnpm-lock.yaml`
> If `package.json` changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED (upgrade de framework; necesita smoke-test)
- **Depends on**: none (recomendado después de 001 para tener suite verde como baseline)
- **Category**: security
- **Planned at**: commit `7ae93d2`, 2026-06-11

## Why this matters

`pnpm audit --prod` reporta **17 vulnerabilidades (10 high, 5 moderate, 2 low)**, concentradas en `next@16.2.1`. Entre ellas: cache poisoning vía colisiones en el cache-busting de React Server Components. Todas las advisories de `next` están parcheadas en `>=16.2.5`. La app deploya a Vercel y expone endpoints públicos (login, OAuth callbacks), así que las vulnerabilidades de framework son superficie real.

## Current state

- `package.json` — versiones actuales:
  - dependencia `"next": "16.2.1"` (pin exacto, sin `^`)
  - devDependency `"eslint-config-next": "16.2.1"`
  - `"react": "19.2.4"` y `"react-dom": "19.2.4"` (compatibles con next 16.2.x — no tocar)
- Gestor de paquetes: **pnpm**. Hay sección `pnpm.onlyBuiltDependencies` en `package.json` — no modificarla.
- `pnpm audit --prod` hoy: `17 vulnerabilities found — Severity: 2 low | 5 moderate | 10 high`, con `next` vulnerable en `>=16.0.0 <16.2.5`, patched `>=16.2.5`. El paquete `geist` resuelve `next` como peer — se arregla solo al subir `next`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install | `pnpm install` | exit 0 |
| Audit | `pnpm audit --prod` | sin advisories high de `next` |
| Typecheck | `pnpm typecheck` | exit 0 |
| Tests | `pnpm test` | exit 0 (ver nota: si el plan 001 no se ejecutó aún, va a fallar exactamente 1 test en `dashboard-range.test.ts` — ese fallo NO lo causa este upgrade) |
| Build | `pnpm build` | exit 0, build completo |
| Dev smoke-test | `pnpm dev` | server arranca sin errores |

## Scope

**In scope**:
- `package.json` (solo las entradas `next` y `eslint-config-next`)
- `pnpm-lock.yaml` (regenerado por pnpm)

**Out of scope** (NO tocar):
- `react` / `react-dom` — no subir de versión en este plan.
- `next.config.ts` — no debería requerir cambios; si los requiere, es STOP condition.
- Cualquier otro paquete del manifest (las advisories restantes no-next se evalúan en otro momento).

## Git workflow

- Branch: `advisor/002-upgrade-nextjs-security-patch`
- Commit style: `build: actualizar next a 16.2.x para parchear advisories de seguridad`
- NO pushear ni abrir PR salvo instrucción del operador.

## Steps

### Step 1: Subir las versiones en package.json

Editar `package.json`:
- `"next": "16.2.1"` → `"next": "^16.2.5"`
- `"eslint-config-next": "16.2.1"` → `"eslint-config-next": "^16.2.5"`

Luego: `pnpm install`

**Verify**: `pnpm install` → exit 0; `pnpm list next` → muestra una versión `>=16.2.5`.

### Step 2: Confirmar que las advisories de next desaparecieron

**Verify**: `pnpm audit --prod` → ninguna advisory lista `next` como paquete vulnerable. (Pueden quedar advisories de otros paquetes — registrarlas en el reporte final pero NO arreglarlas aquí.)

### Step 3: Verificación de regresión

Correr en orden:
1. `pnpm typecheck` → exit 0
2. `pnpm test` → exit 0 (o solo el fallo pre-existente de `dashboard-range.test.ts` si 001 no se ejecutó)
3. `pnpm build` → exit 0

**Verify**: los tres comandos con el resultado esperado.

### Step 4: Smoke-test manual del dev server

`pnpm dev`, esperar a que compile, y verificar con `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/login` → `200`. Detener el server después.

**Verify**: HTTP 200 en `/login`.

## Test plan

Sin tests nuevos — es un bump de versión. La cobertura es la suite existente + build + smoke-test.

## Done criteria

- [ ] `pnpm list next` → versión `>=16.2.5`
- [ ] `pnpm audit --prod` → cero advisories de `next`
- [ ] `pnpm typecheck` exit 0
- [ ] `pnpm build` exit 0
- [ ] `git status` → solo `package.json` y `pnpm-lock.yaml` modificados
- [ ] Fila actualizada en `plans/README.md`

## STOP conditions

Stop and report back if:

- `pnpm install` no puede resolver `next@^16.2.5` (no existe la versión en el registry — reportar qué versiones hay disponibles).
- `pnpm build` falla con errores que no existían antes del bump (correr `git stash && pnpm install && pnpm build` para confirmar el baseline, luego `git stash pop`). Reportar el error textual.
- El upgrade exige cambios en `next.config.ts` o en código de `src/` para compilar.
- `eslint-config-next@^16.2.5` no existe — en ese caso subir solo `next` y reportarlo.

## Maintenance notes

- Quedan advisories no-next en el audit (el total era 17). El reporte final del executor debe listar las que sobreviven para decidir un sweep posterior.
- Revisor: mirar el diff de `pnpm-lock.yaml` para confirmar que solo se movieron `next`/`eslint-config-next` y sus transitividades.
- Vercel deployará esto automáticamente al pushear a `contentOS-dashboard-v2` — verificar el deploy preview antes de merge.
