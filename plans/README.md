# Implementation Plans — ContentOS

Generados por el skill `improve` el 2026-06-11, contra el commit `7ae93d2`
(branch `contentOS-dashboard-v2`). Ejecutar en el orden de abajo salvo que las
dependencias indiquen otra cosa. Cada executor: leer el plan completo antes de
empezar, respetar sus STOP conditions, y actualizar su fila al terminar.

Reconciliados y ejecutados el 2026-07-22 contra `b7fce56`. Los cambios revisados
se integraron en la rama principal; las referencias a "clone …" en la tabla de
abajo apuntan a workspaces locales del autor original y no existen en este repo.

## Execution order & status

| Plan | Title | Priority | Effort | Depends on | Status |
|------|-------|----------|--------|------------|--------|
| 001 | Reparar test stale de `normalizeDashboardRange` (suite a verde) | P1 | S | — | DONE — `cf907b5`, clone `contentos-probe`, 3/3 targeted tests |
| 002 | Upgrade Next.js a 16.2.11 (advisories de Next cerradas) | P1 | S | — | DONE — `704c1c6`, clone `contentos-plan-002`, typecheck/build/audit revisados |
| 003 | CI con GitHub Actions (lint/typecheck/test/build) | P1 | M | 001, 010, 011, 013 | DONE — `0073a1b`, clone `contentos-plan-003-final`; falta push para verificar GitHub Actions y activar el gate de Vercel |
| 004 | Cortar re-gasto de IA en sync (guarda rota + retry sin límite) | P1 | M | — | DONE — `2a99d78` en HEAD principal; verificación con dos sync reales pendiente por credenciales/costo |
| 005 | Unificar definiciones sum/average de métricas | P2 | M | 001 | DONE — `e93eeee` sobre dependencia `5822641`, clone `contentos-plan-005`, 88/88 tests |
| 006 | Sanear ingesta de "follows" (follower_count como única fuente) | P2 | M | 005 | DONE — `d01486e`, clone `contentos-plan-006`, 89/89 tests; re-sync real pendiente por credenciales |
| 007 | Restaurar `.env.example` + drift de docs | P2 | S | — | DONE — `0ad1155`, clone `contentos-plan-007`; template sin valores reales |
| 008 | Superficie de fallos parciales del sync (warnings hasta la UI) | P2 | M | 004* | DONE — `34b7e32`, clone `contentos-plan-008`, typecheck + 3/3 targeted tests revisados |
| 009 | `CRON_SECRET` al schema de env | P3 | S | 001 | DONE — `c2a2e65` sobre dependencia `be39d01`, clone `contentos-plan-009`, 87/87 tests |
| 010 | Eliminar componentes UI muertos | P3 | S | — | DONE — `0963a2b`, clone `contentos-plan-010`, typecheck/build revisados |
| 011 | Consolidar charts en recharts, eliminar visx | P3 | M | 001, 010 | DONE — `fc92299` sobre dependencia `d130236`, clone `contentos-plan-011`, 87/87 tests + build + visual desktop/mobile |
| 012 | Tests de caracterización: auth proxy + OAuth callback | P2 | L | 001, 003* | DONE — `746922b`, clone `contentos-plan-012`, 14 targeted y 101/101 full tests revisados |
| 013 | Dejar baseline ESLint en verde para habilitar CI | P1 | M | 001, 011 | DONE — `6490a97`, clone `contentos-plan-013`, lint 0 errores + 87/87 tests + build |

Status values: TODO | IN PROGRESS | DONE | BLOCKED (con motivo en una línea) | REJECTED (con justificación).
`*` = dependencia blanda: no bloquea, pero conviene ese orden para evitar conflictos en los mismos archivos.

## Dependency notes

- **003 requiere 001**: un CI que nace con la suite en rojo se ignora desde el día uno.
- **003 requiere 013**: el primer intento se bloqueó por tres errores de ESLint preexistentes; 013 los corrige sin desactivar reglas.
- **003 se ejecutó sobre 010/011**: el componente visx eliminado por esos planes también contenía errores de pureza que bloqueaban lint.
- **006 después de 005**: tocan archivos vecinos de métricas; 005 deja un solo lugar donde 006 ajusta la semántica.
- **008 después de 004**: ambos editan `src/lib/sync/run-full-sync.ts`; ejecutarlos en serie evita merge conflicts.
- **011 después de 010**: 010 borra `line-charts-1.tsx` (también importa recharts) y limpia el mapa de uso.
- **012 después de 001/003**: los tests nuevos necesitan suite verde y, para tener valor, un CI que los corra.
- **004 y 006 mueven dinero/datos**: tras deployarlos, el primer `pnpm sync:run` es la validación real — mirar los stats (`attempted: 0` en la segunda pasada para 004; card "Seguidores ganados" estable para 006).
- **Commits en clones**: para integrar un plan, hacer fetch desde el path del clone indicado y revisar/cherry-pickear el commit. No asumir que las branches existen en el repo principal.
- **Integración final**: `pnpm 11.2.2`, instalación frozen, lint (0 errores), typecheck, 106/106 tests y build con Next.js 16.2.11 verificados en el branch combinado.

## Mapeo a los hallazgos de la auditoría

Tabla presentada al mantenedor → plan: #1→001, #2→002, #3→003, #4→006, #5→005, #6→007, #7→012, #8→011, #9→008, #10→010, #11→009. El hallazgo nuevo reportado por el mantenedor (re-análisis/re-transcripción con gasto de IA en cada sync) → 004.

## Findings considered and rejected

Registrados para que no se re-auditen:

- **Playwright "sin uso" (DEPS)**: falso — lo usa `scripts/capture-landing-screenshots.mjs`. No tocar.
- **`flushLangfuse` faltante en GET de mensajes (CORRECTNESS)**: el catch sí flushea; el path de éxito del GET no genera spans relevantes. Impacto ~cero, no vale un plan.
- **Email logueado en errores de auth (SEC)**: app single-user; sin superficie de enumeración. Defense-in-depth marginal.
- **God module `read-repository.ts` (1977 líneas)**: real, pero partirlo es esfuerzo L con riesgo MED sobre ~20 call sites y payoff difuso hoy. Verdict: "no ahora". Re-evaluar si el archivo sigue creciendo.
- **`ai-prompt-box.tsx` "muerto"**: falso positivo de subagente — lo importa `ruixen-moon-chat.tsx:7`. Documentado en el plan 010 para que nadie lo borre.
- **Validación de métricas negativas en `computeDerivedMetrics`**: especulativo (requiere corrupción de datos upstream); sin evidencia de ocurrencia. No planeado.
- **Vulnerabilidad OpenTelemetry/Prometheus exporter**: el exporter de Prometheus no corre en esta app (Langfuse usa OTLP). Las advisories restantes del audit se listan en el reporte del plan 002.

## Opciones de dirección (no planeadas — decisión de producto pendiente)

- **D1 — Módulo de competencia sin UI**: `src/lib/competition/` completo y testeado (10 archivos, integración Apify, tablas en schema), cero páginas que lo consuman. La capability más barata de destrabar; costo variable de Apify a presupuestar.
- **D2 — Calendar publish simulado**: `api/calendar/publish` es un `setTimeout(2500)` con comentario "SIMULACIÓN". O se implementa (Storage + ContentItem + APIs), o se deshabilita el botón.
- **D3 — Página Patterns "En construcción"**: los datos prometidos (hooks, `ai_insights`) ya existen; cablear o sacar del nav.
- **D4 — Visibilidad de progreso del sync**: job status + polling. El plan 008 es el paso 1 (warnings); esto sería el paso 2.
