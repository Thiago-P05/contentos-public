# Plan 005: Unificar las definiciones de agregación de métricas (sum vs average) en un solo módulo

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 7ae93d2..HEAD -- src/lib/daily-dashboard-performance.ts src/lib/dashboard-trends.ts`
> Ante un mismatch con los excerpts, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (refactor mecánico con tests existentes que cubren ambos módulos)
- **Depends on**: none (ejecutar ANTES que el plan 006, que toca los mismos archivos)
- **Category**: tech-debt
- **Planned at**: commit `7ae93d2`, 2026-06-11

## Why this matters

La decisión "esta métrica se SUMA y esta se PROMEDIA" está definida dos veces, con listas distintas, en dos archivos hermanos. Es la zona de mayor churn del repo (~7 commits de fixes sobre la métrica `follows`): cuando una regla cambia en un archivo y no en el otro, los números del dashboard divergen silenciosamente. Centralizar la semántica de agregación deja UN lugar donde mirar y cambia el modo de fallo de "divergencia silenciosa" a "error de compilación".

## Current state

- `src/lib/daily-dashboard-performance.ts:7-9`:

```ts
const SUM_METRICS: DashboardTrendMetricKey[] = ["views", "comments", "likes", "shares", "saves", "reach", "contentInteractions", "profileVisits", "linkClicks", "follows", "watchTimeMinutes", "subscribersGained", "subscribersLost"];
const AVG_METRICS: DashboardTrendMetricKey[] = ["avgWatchTimeMs", "skipRate", "followerCount", "averageViewDurationSeconds"];
const METRIC_ORDER: DashboardTrendMetricKey[] = [...SUM_METRICS, ...AVG_METRICS];
```

- `src/lib/dashboard-trends.ts:12-31` — redefine listas MÁS CHICAS (es deliberado: esta superficie usa menos métricas) y además un mapa redundante:

```ts
const SUM_METRICS: DashboardTrendMetricKey[] = ["views", "comments", "likes", "shares", "saves", "reach", "contentInteractions", "profileVisits", "linkClicks"];
const AVERAGE_METRICS: DashboardTrendMetricKey[] = ["avgWatchTimeMs", "skipRate"];
const METRIC_KEYS: DashboardTrendMetricKey[] = [...SUM_METRICS, ...AVERAGE_METRICS];

const AGGREGATION: Partial<Record<DashboardTrendMetricKey, "sum" | "average">> = {
  views: "sum",
  comments: "sum",
  // ... repite lo mismo una tercera vez
```

**Dato clave**: los SETS de métricas difieren a propósito (cada superficie consume un subconjunto), pero la CLASE de agregación de cada métrica (sum vs average) debe ser única. La consolidación correcta es: un mapa global `métrica → "sum" | "average"`, y cada consumidor define solo SU subconjunto de keys, derivando la clase del mapa compartido.

- Tipo compartido: `DashboardTrendMetricKey` en `src/lib/types.ts`.
- Tests existentes que cubren estos módulos: `src/lib/daily-dashboard-performance.test.ts` y `src/lib/dashboard-trends.test.ts` — son la red de seguridad del refactor; NO modificar sus aserciones.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `pnpm typecheck` | exit 0 |
| Tests de los 2 módulos | `npx vitest run src/lib/daily-dashboard-performance.test.ts src/lib/dashboard-trends.test.ts` | all pass, sin cambios en aserciones |
| Suite completa | `pnpm test` | exit 0 |

## Scope

**In scope**:
- `src/lib/metric-aggregation.ts` (crear)
- `src/lib/daily-dashboard-performance.ts`
- `src/lib/dashboard-trends.ts`

**Out of scope** (NO tocar):
- `src/lib/dashboard-metrics.ts`, `src/lib/content-library-metrics.ts` — tienen lógica propia de resolución por alias; consolidarlos es otro nivel de riesgo. Deliberadamente excluidos.
- `src/lib/types.ts` — no cambiar `DashboardTrendMetricKey`.
- Los archivos `.test.ts` de ambos módulos — las aserciones existentes son el contrato.
- Cualquier comportamiento: este plan NO cambia qué métrica se suma o promedia; solo dónde se define.

## Git workflow

- Branch: `advisor/005-unify-metric-aggregation`
- Commit style: `refactor: centralizar definicion sum/average de metricas en metric-aggregation.ts`
- NO pushear salvo instrucción del operador.

## Steps

### Step 1: Crear el módulo central

Crear `src/lib/metric-aggregation.ts`:

```ts
import type { DashboardTrendMetricKey } from "@/lib/types";

export type MetricAggregationKind = "sum" | "average";

/**
 * Única fuente de verdad: cómo se agrega cada métrica entre buckets/días.
 * Los consumidores eligen SU subconjunto de keys; la clase sale de acá.
 */
export const METRIC_AGGREGATION: Record<DashboardTrendMetricKey, MetricAggregationKind> = {
  views: "sum",
  comments: "sum",
  likes: "sum",
  shares: "sum",
  saves: "sum",
  reach: "sum",
  contentInteractions: "sum",
  profileVisits: "sum",
  linkClicks: "sum",
  follows: "sum",
  watchTimeMinutes: "sum",
  subscribersGained: "sum",
  subscribersLost: "sum",
  avgWatchTimeMs: "average",
  skipRate: "average",
  followerCount: "average",
  averageViewDurationSeconds: "average",
};

export function sumMetricsOf(keys: DashboardTrendMetricKey[]) {
  return keys.filter((key) => METRIC_AGGREGATION[key] === "sum");
}

export function averageMetricsOf(keys: DashboardTrendMetricKey[]) {
  return keys.filter((key) => METRIC_AGGREGATION[key] === "average");
}
```

IMPORTANTE: si `DashboardTrendMetricKey` tiene keys que no aparecen en las listas de los dos archivos actuales, TypeScript va a exigirlas en el `Record` — agregarlas con la clase que su semántica indique y anotarlo en el reporte. Si no es obvio cuál corresponde, STOP.

**Verify**: `pnpm typecheck` → exit 0.

### Step 2: Migrar daily-dashboard-performance.ts

Reemplazar las líneas 7–8 derivando del módulo nuevo, preservando el ORDEN actual de `METRIC_ORDER` (el orden de las listas actuales importa para la UI):

```ts
import { sumMetricsOf, averageMetricsOf } from "@/lib/metric-aggregation";

const DAILY_METRIC_KEYS: DashboardTrendMetricKey[] = ["views", "comments", "likes", "shares", "saves", "reach", "contentInteractions", "profileVisits", "linkClicks", "follows", "watchTimeMinutes", "subscribersGained", "subscribersLost", "avgWatchTimeMs", "skipRate", "followerCount", "averageViewDurationSeconds"];
const SUM_METRICS = sumMetricsOf(DAILY_METRIC_KEYS);
const AVG_METRICS = averageMetricsOf(DAILY_METRIC_KEYS);
const METRIC_ORDER: DashboardTrendMetricKey[] = [...SUM_METRICS, ...AVG_METRICS];
```

**Verify**: `npx vitest run src/lib/daily-dashboard-performance.test.ts` → all pass.

### Step 3: Migrar dashboard-trends.ts

Igual: definir `const TREND_METRIC_KEYS = [...]` con las 11 keys actuales de ese archivo, derivar `SUM_METRICS`/`AVERAGE_METRICS` con los helpers, y **eliminar el mapa `AGGREGATION` local** (líneas 26+), reemplazando sus usos por `METRIC_AGGREGATION` importado (o por los arrays derivados — mirar cómo se consume `AGGREGATION` en el resto del archivo y mantener el comportamiento idéntico).

**Verify**: `npx vitest run src/lib/dashboard-trends.test.ts` → all pass.

### Step 4: Verificación final

**Verify**:
- `pnpm typecheck` → exit 0
- `pnpm test` → exit 0
- `grep -rn "AGGREGATION\s*:" src/lib/dashboard-trends.ts` → sin resultados (el mapa local se fue)

## Test plan

- Agregar UN test nuevo en un archivo nuevo `src/lib/metric-aggregation.test.ts` (patrón: `src/lib/dashboard-range.test.ts`): asserts de que `sumMetricsOf`/`averageMetricsOf` particionan correctamente y que `follows` es `"sum"` y `followerCount` es `"average"` (las dos métricas históricamente conflictivas).
- Los tests existentes de ambos módulos pasan SIN cambios — esa es la prueba de que el refactor no cambió comportamiento.

## Done criteria

- [ ] `src/lib/metric-aggregation.ts` existe y es la única definición sum/average
- [ ] `pnpm typecheck` exit 0; `pnpm test` exit 0
- [ ] Tests existentes de los 2 módulos sin modificar y en verde
- [ ] `git status` → solo los 4 archivos in-scope (3 + test nuevo)
- [ ] Fila actualizada en `plans/README.md`

## STOP conditions

- Los excerpts no coinciden (drift) — en particular si el plan 006 se ejecutó primero y ya tocó estas listas.
- `DashboardTrendMetricKey` contiene keys cuya clase de agregación no es inferible de los archivos actuales.
- Algún test existente falla tras la migración: NO ajustar el test; el refactor rompió comportamiento. Revertir el step y reportar cuál métrica cambió de clase.

## Maintenance notes

- El plan 006 (semántica de `follows`) editará la fila `follows` de este mapa si cambia su fuente — por eso este plan va primero.
- Follow-up deferido: `dashboard-metrics.ts` y `content-library-metrics.ts` tienen resolución de métricas por alias propia; unificarlos con este módulo es deseable pero requiere su propio plan.
- Revisor: comparar elemento a elemento las listas derivadas vs las hardcodeadas borradas (el diff las muestra juntas).
