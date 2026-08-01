# Plan 011: Consolidar en recharts y eliminar visx (dos librerías de charts en el bundle)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 7ae93d2..HEAD -- src/components/trend-chart.tsx src/components/ui/area-chart.tsx package.json`
> Ante un mismatch con los excerpts, STOP.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED (regresión visual en un chart del dashboard)
- **Depends on**: plans/010 (borra `line-charts-1.tsx`, que también importa recharts — menos ruido)
- **Category**: perf / tech-debt
- **Planned at**: commit `7ae93d2`, 2026-06-11

## Why this matters

El bundle carga DOS librerías de charts: `recharts` (usada por 7 componentes) y 6 paquetes `@visx/*` (usados por UNO solo: `src/components/ui/area-chart.tsx`, que a su vez tiene un único consumidor). Mantener visx por un solo chart cuesta peso de bundle, una API más que conocer, y duplicación de patrones. recharts ya es la convención de facto del repo — consolidar es eliminar la excepción.

## Current state

Mapa de uso verificado por grep en el commit de planificación:

- **visx** (`@visx/curve`, `@visx/event`, `@visx/grid`, `@visx/responsive`, `@visx/scale`, `@visx/shape` en `package.json`):
  - Único importador: `src/components/ui/area-chart.tsx`
  - Único consumidor de ese componente: `src/components/trend-chart.tsx` (`import ... from "@/components/ui/area-chart"`)
- **recharts** (`^3.8.1`): importado por `src/app/audience/audience-client.tsx`, `src/components/account-views-chart.tsx`, `engagement-split-chart.tsx`, `followers-lost-card.tsx`, `followers-sparkline-card.tsx`, `metric-area-chart.tsx`, `platform-split-chart.tsx` (y `ui/line-charts-1.tsx`, que el plan 010 borra).
- **Exemplar a imitar**: `src/components/metric-area-chart.tsx` — area chart con recharts ya existente en el repo; usar su estructura (ResponsiveContainer, AreaChart, gradientes con `<defs>`, tooltip custom) como patrón para la reescritura.
- `d3-array` está en dependencies — puede estar usado fuera de visx; verificar antes de tocar (Step 4).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `pnpm typecheck` | exit 0 |
| Tests | `pnpm test` | exit 0 |
| Build | `pnpm build` | exit 0 |
| Dev (verificación visual) | `pnpm dev` | chart de tendencias renderiza |

## Scope

**In scope**:
- `src/components/trend-chart.tsx` (reescribir su render con recharts)
- `src/components/ui/area-chart.tsx` (borrar al final)
- `package.json` + `pnpm-lock.yaml` (quitar los 6 `@visx/*`; `d3-array` solo si el Step 4 lo confirma sin uso)

**Out of scope** (NO tocar):
- Los demás componentes recharts — ya están bien.
- La dupla `framer-motion`/`motion` en package.json (mismo problema, otra librería) — registrado como follow-up en Maintenance notes, NO resolverlo acá.
- El diseño visual: el objetivo es paridad visual razonable, no rediseño.

## Git workflow

- Branch: `advisor/011-consolidate-chart-libraries`
- Commit style: `refactor: migrar trend-chart a recharts y eliminar visx`
- NO pushear salvo instrucción del operador.

## Steps

### Step 1: Capturar el estado visual actual (baseline)

`pnpm dev`, abrir la página que muestra el trend chart (Dashboard — localizar con `grep -rln "trend-chart" src/app src/components`), y capturar screenshot o anotar: tipo de curva, gradiente, ejes, tooltip, leyenda.

**Verify**: baseline documentado en notas del executor.

### Step 2: Leer ambos componentes y reescribir trend-chart con recharts

1. Leer `src/components/ui/area-chart.tsx` completo: qué props expone, qué features usa de visx (curva, grid, eventos de tooltip).
2. Leer `src/components/metric-area-chart.tsx` completo: el patrón recharts del repo.
3. Reescribir el render de `src/components/trend-chart.tsx` usando recharts directamente (o, si `area-chart.tsx` expone una API genérica usada con muchas props, crear la versión recharts dentro de `trend-chart.tsx` — NO crear otro componente genérico en `ui/` para un solo consumidor).
4. Eliminar el import de `@/components/ui/area-chart` en `trend-chart.tsx`.

**Verify**: `pnpm typecheck` → exit 0; `grep -rn "ui/area-chart" src/` → 0 resultados.

### Step 3: Borrar el componente visx y las dependencias

```
git rm src/components/ui/area-chart.tsx
```

En `package.json`, quitar las 6 entradas `@visx/*`. Luego `pnpm install`.

**Verify**: `grep -rn "@visx" src/ package.json` → 0 resultados; `pnpm typecheck` → exit 0; `pnpm build` → exit 0.

### Step 4: Evaluar d3-array

`grep -rn "d3-array" src/ --include="*.ts" --include="*.tsx"` — si tiene usos propios fuera del componente borrado, DEJARLO (y dejar `@types/d3-array`). Si no tiene ningún uso, quitar ambos de `package.json` y re-verificar typecheck + build.

**Verify**: typecheck y build exit 0 tras la decisión.

### Step 5: Verificación visual contra el baseline

`pnpm dev`, misma página del Step 1. Comparar contra el baseline: serie correcta, tooltip funcional, sin errores en consola del navegador.

**Verify**: paridad visual razonable. Diferencias menores de estilo (suavizado de curva, easing) son aceptables; datos incorrectos o tooltip roto NO.

## Test plan

- `pnpm test` → exit 0 (los tests de lógica de métricas no tocan el render; siguen siendo la red para los datos).
- No se exigen tests de render nuevos (el repo no tiene testing de componentes montado; agregar testing-library solo para esto sería scope creep).

## Done criteria

- [ ] `grep -rn "@visx" src/ package.json` → 0 resultados
- [ ] `src/components/ui/area-chart.tsx` no existe
- [ ] `pnpm typecheck`, `pnpm test`, `pnpm build` exit 0
- [ ] Trend chart verificado visualmente contra el baseline
- [ ] `git status` → solo archivos in-scope
- [ ] Fila actualizada en `plans/README.md`

## STOP conditions

- `trend-chart.tsx` o `area-chart.tsx` difieren del mapa de uso citado (drift).
- `area-chart.tsx` resulta tener más consumidores que `trend-chart.tsx` (re-correr `grep -rn "ui/area-chart" src/`).
- La reescritura con recharts no puede reproducir una feature esencial del chart (p. ej. un overlay custom de visx sin equivalente) — reportar cuál antes de degradar la UX.

## Maintenance notes

- **Follow-up registrado**: `package.json` también tiene `framer-motion` Y `motion` (la misma librería, nombre viejo y nuevo). Verificar cuál se importa realmente y quitar la otra — mismo patrón que este plan, menos riesgo.
- Revisor: foco en el chart renderizado (screenshot en el PR) más que en el código.
- Si se quiere animación de entrada en el chart nuevo, el repo ya tiene `motion` — no reintroducir visx para eso.
