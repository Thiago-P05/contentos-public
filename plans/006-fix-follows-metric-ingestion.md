# Plan 006: Sanear la métrica "follows" en la ingesta — una sola fuente de verdad (follower_count)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 7ae93d2..HEAD -- src/lib/clients/instagram-daily.ts src/lib/supabase/read-repository.ts`
> Ante un mismatch con los excerpts, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (cambia qué dato se almacena; requiere re-sync de datos históricos)
- **Depends on**: plans/005 (toca archivos vecinos; ejecutar después para evitar conflictos)
- **Category**: bug / tech-debt
- **Planned at**: commit `7ae93d2`, 2026-06-11

## Why this matters

La métrica "seguidores ganados" generó ~7 commits de fixes (`18e8328`, `90cc59f`, `1e37517`, `5e0c36b`, `54c0dd3`, `daae434`, `3df2038` — ver `git log`). La causa raíz sigue viva: la **ingesta** guarda como métrica diaria `follows` el valor de `follows_and_unfollows` de Instagram (un delta NETO que puede ser negativo), mientras que la **lectura** decidió (correctamente) que "seguidores ganados" debe salir de `follower_count` (nuevos seguidores por día). El resultado es una capa de parches en la lectura: un override que recalcula desde `follower_count` y una guarda final que clampa negativos. Mientras la ingesta siga guardando el dato equivocado bajo ese nombre, cada feature nueva que lea `follows` re-descubre el bug. CLAUDE.md ya documenta la decisión: *"La métrica follows (seguidores ganados) usa follower_count daily data, no follows_and_unfollows."*

## Current state

- `src/lib/clients/instagram-daily.ts:320-339` — el plan de métricas de la ingesta diaria:

```ts
const metricPlan: MetricPlan[] = [
  { target: "views", candidates: ["views", "content_views"], metricType: "total_value" },
  { target: "reach", candidates: ["reach"] },
  { target: "contentInteractions", candidates: ["total_interactions"], metricType: "total_value" },
  { target: "profileVisits", candidates: ["profile_views"], metricType: "total_value" },
  { target: "linkClicks", candidates: ["website_clicks", "profile_links_taps"], metricType: "total_value" },
  {
    target: "follows",
    candidates: ["follows_and_unfollows", "follows"],   // ← LA RAÍZ: delta neto guardado como "follows"
  },
  { target: "followerCount", candidates: ["follower_count"] },   // ← la fuente correcta ya se ingesta
];
```

- `src/lib/supabase/read-repository.ts` — los parches downstream (comentarios del propio código, líneas 1267, 1297, 1309, 1320):
  - `:1267` — `if (metricKey === "follows" && value <= 0)` (descarta valores no positivos)
  - `:1297` — comentario: *"ya suma follower_count diario (nuevos seguidores/día) que es el número correcto"*
  - `:1309` — comentario: *"follows_and_unfollows da cambio NETO (ganados - perdidos)"*
  - `:1320` — comentario: *"Guardia final: follows nunca puede ser negativo (es 'seguidores ganados', no neto)"*

- Consumidores de la métrica diaria `follows` (verificado por grep): `src/lib/supabase/read-repository.ts` (varias líneas), `src/lib/daily-dashboard-performance.ts` (SUM_METRICS), `src/app/dashboard/page.tsx:77` (card del dashboard).

**Estado final deseado**: la métrica diaria almacenada como `follows` contiene los valores diarios de `follower_count` de Instagram (nuevos seguidores/día — siempre ≥ 0), y los parches de la lectura se reducen a una verificación trivial. El delta neto `follows_and_unfollows` deja de ingestarse (nadie lo consume como valor final tras este cambio).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `pnpm typecheck` | exit 0 |
| Tests | `pnpm test` | exit 0 |
| Re-sync de datos (manual) | `pnpm sync:dashboard` | exit 0; reescribe los insights diarios desde 2025-12-01 |

## Scope

**In scope**:
- `src/lib/clients/instagram-daily.ts` (el `metricPlan`)
- `src/lib/supabase/read-repository.ts` (SOLO simplificación del override en la fase 2 — opcional, ver Step 4)

**Out of scope** (NO tocar):
- `src/lib/metric-aggregation.ts` / `daily-dashboard-performance.ts` / `dashboard-trends.ts` — `follows` sigue siendo "sum"; no cambia.
- El schema de Supabase y los mappers.
- TikTok: verificar en el Step 1 que no alimenta `follows`; si lo hace, STOP.
- `src/app/dashboard/page.tsx` — el consumidor no cambia.

## Git workflow

- Branch: `advisor/006-fix-follows-ingestion`
- Commit style: `fix: ingestar follows desde follower_count en vez de follows_and_unfollows`
- NO pushear salvo instrucción del operador.

## Steps

### Step 1: Confirmar el mapa de consumidores (investigación, sin cambios)

1. `grep -rn "follows_and_unfollows" src/` — listar todos los sitios. Esperado: `instagram-daily.ts` (ingesta) y `read-repository.ts:395` (fallback de lectura de rawPayload). Si aparece en MÁS lugares (p. ej. UI mostrando "cambio neto"), STOP y reportar.
2. `grep -rn "\"follows\"" src/lib/sync/ src/lib/clients/` — confirmar que TikTok no escribe la métrica `follows`.

**Verify**: ambos greps coinciden con lo esperado; anotar el output en el reporte.

### Step 2: Cambiar la fuente en el metricPlan

En `src/lib/clients/instagram-daily.ts:334-337`, cambiar:

```ts
{
  target: "follows",
  candidates: ["follows_and_unfollows", "follows"],
},
```

por:

```ts
{
  // "Seguidores ganados": follower_count diario = nuevos seguidores por día (≥ 0).
  // NO usar follows_and_unfollows: es delta neto y puede ser negativo.
  target: "follows",
  candidates: ["follower_count"],
},
```

Antes de editar, leer cómo `metricPlan` consume `candidates` y `metricType` en el resto del archivo (el fetch a la Graph API construye la query con esos nombres) para confirmar que `follower_count` como candidate es válido — ya se usa idéntico en el target `followerCount` de la línea 338, así que el patrón existe en el mismo array.

**Verify**: `pnpm typecheck` → exit 0; `pnpm test` → exit 0.

### Step 3: Re-sync para reescribir los datos históricos

Los insights diarios se upsertean por fecha desde `BACKFILL_START_ISO` (2025-12-01), así que un sync completo reescribe la serie entera con la fuente nueva:

```
pnpm sync:dashboard
```

**Verify**: exit 0. Después, validación de datos: abrir el dashboard (`pnpm dev`) y comparar la card "Seguidores ganados" antes/después — el número debe mantenerse o variar levemente (la lectura YA usaba follower_count vía el override; ahora el dato almacenado coincide con lo que la lectura calculaba).

### Step 4 (opcional — solo si el Step 3 validó): Simplificar el override de lectura

En `src/lib/supabase/read-repository.ts:1290-1325` aprox.: el bloque que re-deriva `follows` desde `follower_count` ahora es redundante (el dato almacenado ya ES eso). Simplificarlo a leer la métrica directa, **conservando** la guarda final de no-negatividad (`:1320`) como cinturón de seguridad barato. Leer el bloque completo antes de tocar; si la lógica del override hace algo más que re-derivar follows (p. ej. mezcla plataformas), STOP y dejar el Step 4 sin hacer — el sistema queda correcto igual, solo con redundancia.

**Verify**: `pnpm test` → exit 0; dashboard muestra el mismo número que en el Step 3.

## Test plan

- Si `src/lib/clients/instagram-daily.ts` tiene test (verificar: `ls src/lib/clients/*.test.ts`) — al momento de planear existe `instagram.test.ts` pero NO `instagram-daily.test.ts`. Agregar `src/lib/clients/instagram-daily.test.ts` con un test mínimo del `metricPlan`: exportar el plan (o una función que lo devuelva) y assertear que el target `follows` tiene candidates `["follower_count"]` y NO contiene `follows_and_unfollows`. Patrón estructural: `src/lib/clients/instagram.test.ts`.
- Verificación: `pnpm test` → all pass.

## Done criteria

- [ ] `grep -n "follows_and_unfollows" src/lib/clients/instagram-daily.ts` → sin resultados
- [ ] `pnpm typecheck` y `pnpm test` exit 0
- [ ] `pnpm sync:dashboard` corrido y dashboard validado visualmente
- [ ] `git status` → solo archivos in-scope
- [ ] Fila actualizada en `plans/README.md`

## STOP conditions

- El Step 1 revela consumidores de `follows_and_unfollows` no contemplados.
- La Graph API rechaza la query sin `follows_and_unfollows` (error en `pnpm sync:dashboard`) — reportar el error textual de la API.
- Tras el Step 3, la card "Seguidores ganados" muestra un número radicalmente distinto (>20% de diferencia) — la suposición "el override ya calculaba esto" sería falsa.
- El bloque del Step 4 hace más cosas que re-derivar follows.

## Maintenance notes

- Si algún día se quiere mostrar "cambio neto de seguidores" (ganados − perdidos), eso es una métrica NUEVA con nombre propio (`netFollows`) — no reciclar `follows`.
- CLAUDE.md (sección "Métricas de seguidores") debería actualizarse para reflejar que la ingesta ya es consistente — una línea, puede ir en el mismo PR.
- Revisor: el diff de datos (no de código) es el riesgo real — exigir la comparación antes/después del Step 3 en la descripción del PR.
