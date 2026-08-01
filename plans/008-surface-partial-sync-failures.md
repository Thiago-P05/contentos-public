# Plan 008: Hacer visibles los fallos parciales del sync (hoy se tragan con un console.warn)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 7ae93d2..HEAD -- src/lib/sync/run-full-sync.ts src/app/api/sync/run/route.ts`
> Ante un mismatch con los excerpts, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (toca el shape del resultado del sync; hay 3 consumidores)
- **Depends on**: none (si el plan 004 está en curso, coordinar: ambos tocan `run-full-sync.ts` — ejecutar este DESPUÉS)
- **Category**: bug
- **Planned at**: commit `7ae93d2`, 2026-06-11

## Why this matters

Cuando dentro de un sync falla la actualización de insights diarios de una conexión, o una conexión entera se saltea por credenciales vencidas, el error termina en `console.warn` y el sync reporta **éxito**. El usuario ve "Sync completado" con datos stale y no tiene forma de saberlo — en Vercel ni siquiera ve los logs. Para una app cuyo producto ES la frescura de las métricas, un éxito mentiroso es peor que un fallo.

## Current state

- `src/lib/sync/run-full-sync.ts` — loop principal sobre conexiones (zona ~líneas 410–440):

```ts
for (const connection of activeConnections) {
  let hydratedConnection: PlatformConnectionCredentials;

  try {
    hydratedConnection = await getConnectionWithFreshTokens(connection);
  } catch (error) {
    connectionErrors.push(error instanceof Error ? error : new Error(getErrorMessage(error)));
    console.warn(
      `Se omitio la conexion ${connection.platform}:${connection.accountExternalId} por error de credenciales: ${getErrorMessage(error)}`,
    );
    continue;          // ← la conexión desaparece del resultado sin rastro para el caller
  }

  try {
    await refreshConnectionDailyInsights(hydratedConnection);
  } catch (error) {
    console.warn(
      `No se pudieron actualizar los datos diarios para ${hydratedConnection.platform}:${hydratedConnection.accountExternalId}: ${getErrorMessage(error)}`,
    );                 // ← insights diarios stale, el sync sigue y reporta éxito
  }

  const items = await fetchConnectionContent(hydratedConnection);
  results.push(await syncConnection(hydratedConnection, items, options));
}

if (results.length === 0 && connectionErrors.length > 0) {
  throw connectionErrors[0];   // ← solo falla si fallaron TODAS
}
```

- El shape del retorno (línea ~400): `{ startedAt, filters, results }` donde cada result es `{ platform, connectionId, displayName, itemsProcessed, itemsSucceeded }` (ver `syncConnection`, líneas 290–296).
- Consumidores del resultado (los 3, verificar con `grep -rn "runFullSync" src/ scripts/`):
  - `src/app/api/sync/run/route.ts` — el endpoint del botón de la UI
  - `src/app/api/sync/cron/route.ts` — devuelve `result.results.map(...)` como `processed`
  - `scripts/run-sync.ts` — CLI
- Componente UI del botón de sync: localizar con `grep -rln "api/sync/run" src/app src/components` (al planear: el dashboard tiene un botón "Sync" que muestra toast de éxito/error).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `pnpm typecheck` | exit 0 |
| Tests | `pnpm test` | exit 0 |
| Sync manual | `pnpm sync:run` | exit 0, warnings visibles en el output |

## Scope

**In scope**:
- `src/lib/sync/run-full-sync.ts` (acumular warnings y devolverlos)
- `src/app/api/sync/run/route.ts` (propagar warnings en la respuesta)
- `src/app/api/sync/cron/route.ts` (ídem)
- El componente del botón de sync (mostrar el warning) — localizarlo en el Step 3
- `src/lib/types.ts` SOLO si el tipo del resultado del sync vive ahí

**Out of scope** (NO tocar):
- Lógica de reintentos o recuperación — este plan SOLO hace visible el fallo, no lo arregla.
- `scripts/run-sync.ts` — el CLI ya muestra los console.warn por stdout; no necesita cambios.
- Persistencia de warnings en `sync_runs` — la metadata ya guarda stats; no ampliar.

## Git workflow

- Branch: `advisor/008-surface-partial-sync-failures`
- Commit style: `fix: propagar fallos parciales del sync hasta la UI`
- NO pushear salvo instrucción del operador.

## Steps

### Step 1: Acumular warnings en el resultado del sync

En `run-full-sync.ts`:
1. Crear `const warnings: string[] = [];` junto a `connectionErrors`.
2. En el catch de credenciales: además del `console.warn`, `warnings.push(\`\${connection.platform}:\${connection.accountExternalId}: credenciales invalidas — conexion omitida\`)`.
3. En el catch de `refreshConnectionDailyInsights`: `warnings.push(\`\${...}: datos diarios no actualizados\`)`.
4. Incluir `warnings` en el objeto de retorno de `runFullSync` (ambos returns: el de conexión única ~línea 400 y el final).

NO incluir mensajes de error crudos de APIs externas en `warnings` (pueden contener tokens en URLs) — solo los mensajes fijos de arriba más plataforma/cuenta.

**Verify**: `pnpm typecheck` → exit 0.

### Step 2: Propagar en los dos endpoints

- `src/app/api/sync/run/route.ts`: incluir `warnings: result.warnings` en el JSON de respuesta.
- `src/app/api/sync/cron/route.ts`: ídem en su respuesta (`{ message, processed, warnings }`).

**Verify**: `pnpm typecheck` → exit 0; `grep -n "warnings" src/app/api/sync/run/route.ts src/app/api/sync/cron/route.ts` → presente en ambos.

### Step 3: Mostrar el warning en la UI

Localizar el componente que llama a `/api/sync/run` (`grep -rln "api/sync/run" src/`). En el handler del fetch: si `data.warnings?.length > 0`, mostrar un toast/banner de advertencia con el texto `Sync completado con advertencias: ${warnings.join(" · ")}` en lugar del toast de éxito limpio. Seguir el patrón de toast/feedback que el componente ya use para el caso de error (leerlo antes de editar; matchear estilo y idioma — español).

**Verify**: `pnpm typecheck` → exit 0. Manual: `pnpm dev`, click en Sync con todo sano → toast de éxito normal (warnings vacío no debe mostrar advertencia).

### Step 4: Test del contrato

Ver "Test plan".

**Verify**: `pnpm test` → exit 0.

## Test plan

- La función `runFullSync` orquesta I/O pesado; en lugar de mockear todo, extraer el formateo de warnings a una función pura `formatSyncWarning(platform, accountExternalId, kind)` en `run-full-sync.ts` y testearla en `src/lib/sync/run-full-sync.test.ts` (crear; patrón: `src/lib/dashboard-range.test.ts`): genera los dos tipos de mensaje, nunca incluye texto de error externo.
- Verificación: `pnpm test` → all pass.

## Done criteria

- [ ] `runFullSync` devuelve `warnings: string[]` y ambos endpoints lo exponen
- [ ] El botón de la UI muestra advertencia cuando `warnings.length > 0` y NO la muestra cuando está vacío
- [ ] Los warnings no contienen mensajes crudos de errores externos
- [ ] `pnpm typecheck` y `pnpm test` exit 0
- [ ] `git status` → solo archivos in-scope
- [ ] Fila actualizada en `plans/README.md`

## STOP conditions

- Los excerpts no coinciden (en particular si el plan 004 cambió `run-full-sync.ts` de forma incompatible).
- El componente del botón de sync no existe o el sync se dispara por otro mecanismo (reportar cómo se dispara realmente).
- Hay más de 3 consumidores de `runFullSync` (el grep del Step "Current state" encontró otros).

## Maintenance notes

- Esto es el paso 1 de la visibilidad operativa; el paso 2 natural (job status con polling y progreso por conexión) está registrado como opción de dirección D4 en `plans/README.md` — no implementarlo acá.
- Revisor: chequear que ningún warning interpola `error.message` de APIs externas.
