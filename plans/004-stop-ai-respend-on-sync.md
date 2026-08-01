# Plan 004: Cortar el re-gasto de IA en cada sync (guarda de reuso rota + reintentos sin límite)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 7ae93d2..HEAD -- src/lib/content-analysis-agent.ts src/lib/reel-transcription.ts src/lib/sync/run-full-sync.ts src/lib/ai/video-potential.ts`
> Si algún archivo in-scope cambió, comparar los excerpts de "Current state"
> contra el código vivo; ante un mismatch, STOP.

## Status

- **Priority**: P1 (gasto de dinero recurrente e innecesario)
- **Effort**: M
- **Risk**: MED (toca la decisión de cuándo se llama a la IA; un error al revés significa contenido sin analizar)
- **Depends on**: none
- **Category**: bug / cost
- **Planned at**: commit `7ae93d2`, 2026-06-11

## Why this matters

Cada sync (botón de la UI, cron, o script) recorre **todo** el contenido desde `BACKFILL_START_ISO = "2025-12-01"` (`src/lib/constants.ts:1`) y para cada pieza decide si re-analizar/re-transcribir. Las guardas de reuso existen pero tienen dos agujeros que generan gasto real en OpenRouter:

1. **La guarda de análisis exige un `videoPotential` parseable.** Si el modelo no devolvió un `videoPotential` válido (se persiste como `null`), la guarda nunca se cumple y ese item se **re-analiza en cada sync, para siempre** — aunque ya tenga un insight completo con status `ready`/`fallback`.
2. **Los fallos se reintentan sin límite ni backoff.** Un item con `analysisStatus: "failed"` o transcripción fallida (ej. media URL vencida) paga un intento de IA en **cada** sync, indefinidamente.

El dueño del proyecto reportó este gasto explícitamente. Tras este plan, un segundo sync consecutivo sin contenido nuevo debe costar $0 en llamadas de IA.

## Current state

- `src/lib/content-analysis-agent.ts` — orquesta el análisis por item. La guarda rota (líneas 123–134):

```ts
const existingInsightIsComplete = Boolean(
  detail.insight?.videoPotential &&
    (detail.item.analysisStatus === "ready" || detail.item.analysisStatus === "fallback"),
);

if (existingInsightIsComplete) {
  return { attempted: false, durationMs: Date.now() - startedAt, outcome: "reused" };
}
```

  El tipo de outcome (línea 20): `outcome: "reused" | "ready" | "fallback" | "failed";`
  El path de fallo (líneas 181–200) persiste `analysisStatus: "failed"` y `rawPayload.analysisError = { message, at, provider, agent }` — **ya hay timestamp del último intento** (`at`), pero nada lo consulta.

- `src/lib/ai/video-potential.ts:43-46` — `parseVideoPotentialEstimate` usa un schema Zod estricto (requiere rangos `views`/`reach`/`comments` completos); cualquier desviación → `null`.

- `src/lib/ai/analysis.ts:442,455,467` — el draft del insight guarda `videoPotential` (posiblemente `null`) en el rawPayload. Un insight con `videoPotential: null` y status `ready` queda atrapado en el loop de re-análisis.

- `src/lib/reel-transcription.ts` — `runReelTranscription` (líneas 139–165): si existe el text asset `transcript` → `reused` (esta guarda SÍ funciona). Pero si la transcripción anterior **falló** (no hay asset, `transcriptionStatus: "failed"`), se reintenta en cada sync sin límite. El item tiene columnas `transcriptionStatus`, `transcriptionError`, `transcriptionUpdatedAt` — el timestamp del último intento ya existe.

- `src/lib/sync/run-full-sync.ts:255-258` — el loop por item llama ambos:

```ts
const persisted = await persistItem(item);
await updateTranscriptionWithoutBlockingSync(persisted, transcriptionStats);
await updateAnalysisWithoutBlockingSync(persisted, analysisStats);
```

- Stats: `createReelTranscriptionStats()` / `createContentAnalysisStats()` acumulan `attempted/reused/failed/...` y se persisten en la metadata del sync run (`run-full-sync.ts:275-288`).

- Convención de tests del repo: tests unitarios de funciones puras junto al módulo, ej. `src/lib/reel-transcription.test.ts` (testea `getReusableTranscriptState` pura). Seguir ese patrón.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `pnpm typecheck` | exit 0 |
| Tests | `pnpm test` | exit 0 |
| Test de un archivo | `npx vitest run src/lib/content-analysis-agent.test.ts` | all pass |
| Sync real (verificación manual) | `pnpm sync:run` | ver Done criteria |

## Scope

**In scope**:
- `src/lib/content-analysis-agent.ts`
- `src/lib/reel-transcription.ts`
- `src/lib/content-analysis-agent.test.ts` (crear)
- `src/lib/reel-transcription.test.ts` (extender)

**Out of scope** (NO tocar):
- `src/lib/ai/video-potential.ts` y `src/lib/ai/analysis.ts` — el parseo estricto está bien; el backfill de `videoPotential` faltante se hace con `pnpm sync:ai` (script existente `scripts/run-ai-backfill.ts`), no en el sync regular.
- `src/lib/constants.ts` (`BACKFILL_START_ISO`) — acotar la ventana del sync es otra discusión.
- `src/lib/sync/run-full-sync.ts` — los call sites no cambian (solo cambia la decisión interna de las funciones `maybe*`). Si necesitás tocarlo, STOP.
- El schema de Supabase — este plan NO agrega columnas; usa los campos existentes (`rawPayload.analysisError.at`, `transcriptionUpdatedAt`).

## Git workflow

- Branch: `advisor/004-stop-ai-respend-on-sync`
- Commit style: `fix: evitar re-analisis y re-transcripcion de contenido ya procesado en sync`
- NO pushear salvo instrucción del operador.

## Steps

### Step 1: Extraer y arreglar la guarda de reuso del análisis

En `src/lib/content-analysis-agent.ts`, crear una función pura exportada (para poder testearla):

```ts
export function shouldReuseExistingAnalysis(detail: {
  insight: { videoPotential: unknown } | null;
  item: { analysisStatus: string | null };
}): boolean {
  // Un insight existente con status terminal es suficiente para reusar.
  // NO exigir videoPotential: los insights sin él se backfillean con sync:ai,
  // no re-analizando en cada sync.
  return Boolean(
    detail.insight &&
      (detail.item.analysisStatus === "ready" || detail.item.analysisStatus === "fallback"),
  );
}
```

Reemplazar el bloque de las líneas 123–134 para usar esta función. Ajustar los tipos a los reales del archivo (`detail` viene de `getContentDetail`; usar los tipos existentes, no `unknown` si ya hay tipos concretos — mirar cómo se tipa `detail` en el propio archivo).

**Verify**: `pnpm typecheck` → exit 0.

### Step 2: Agregar presupuesto de reintentos al análisis fallido

En el mismo archivo, función pura:

```ts
const ANALYSIS_RETRY_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24h
const ANALYSIS_MAX_ATTEMPTS = 5;

export function shouldSkipFailedAnalysis(
  analysisStatus: string | null,
  analysisError: { at?: unknown; attempts?: unknown } | null | undefined,
  now: number = Date.now(),
): boolean {
  if (analysisStatus !== "failed" || !analysisError) return false;
  const attempts = typeof analysisError.attempts === "number" ? analysisError.attempts : 1;
  if (attempts >= ANALYSIS_MAX_ATTEMPTS) return true;
  const at = typeof analysisError.at === "string" ? Date.parse(analysisError.at) : NaN;
  return Number.isFinite(at) && now - at < ANALYSIS_RETRY_COOLDOWN_MS;
}
```

En `runContentItemAnalysis`, después de la guarda de reuso: leer `detail.item.rawPayload.analysisError` y si `shouldSkipFailedAnalysis(...)` → devolver `{ attempted: false, durationMs, outcome: "skipped" }`.

Cambios acompañantes:
- Agregar `"skipped"` al union de `outcome` (línea 20) y al tipo `ContentAnalysisResult`.
- En el catch (líneas 181–200), incrementar el contador: `attempts: (previousAttempts ?? 0) + 1` dentro del objeto `analysisError` persistido (leer el valor previo de `detail.item.rawPayload.analysisError?.attempts`).
- En `updateContentAnalysisStats` (líneas 60–80 aprox.), manejar `outcome === "skipped"` con un contador `skipped` nuevo en `ContentAnalysisStats` (inicializarlo en `createContentAnalysisStats`).

**Verify**: `pnpm typecheck` → exit 0. `grep -n "skipped" src/lib/content-analysis-agent.ts` → aparece en el union, en la guarda y en las stats.

### Step 3: Agregar el mismo presupuesto a la transcripción fallida

En `src/lib/reel-transcription.ts`, función pura análoga:

```ts
const TRANSCRIPTION_RETRY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export function shouldSkipFailedTranscription(
  persisted: Pick<ContentItem, "transcriptionStatus" | "transcriptionUpdatedAt">,
  now: number = Date.now(),
): boolean {
  if (persisted.transcriptionStatus !== "failed") return false;
  const at = persisted.transcriptionUpdatedAt ? Date.parse(persisted.transcriptionUpdatedAt) : NaN;
  return Number.isFinite(at) && now - at < TRANSCRIPTION_RETRY_COOLDOWN_MS;
}
```

En `runReelTranscription`, después del check de reuso (línea ~165) y ANTES de marcar `pending`: si `shouldSkipFailedTranscription(persisted)` → devolver `{ eligible: true, attempted: false, durationMs: 0, outcome: "skipped" }`. Agregar `"skipped"` al union de `ReelTranscriptionResult.outcome` (línea 16) y un contador `skipped` a `ReelTranscriptionStats` + `createReelTranscriptionStats` + `updateReelTranscriptionStats`.

(Nota: acá no hay contador de attempts persistido sin tocar schema — el cooldown de 24h es suficiente: convierte "N reintentos por día" en "1 por día". Documentado en Maintenance notes.)

**Verify**: `pnpm typecheck` → exit 0.

### Step 4: Tests

Ver "Test plan". Escribirlos y correrlos.

**Verify**: `pnpm test` → exit 0, incluye los tests nuevos.

### Step 5: Verificación de punta a punta con un sync real (manual, requiere .env.local)

1. Correr `pnpm sync:run` y guardar el output (primera pasada: puede haber `attempted > 0` legítimo para items nuevos o re-elegibles).
2. Correr `pnpm sync:run` de nuevo inmediatamente.
3. En la segunda pasada, el resumen de stats debe mostrar `analysis.attempted: 0` y `transcription.attempted: 0` (todo `reused`/`skipped`/`not_applicable`).

**Verify**: segunda pasada con `attempted: 0` en ambos stats. Si no hay credenciales para sync real, marcarlo en el reporte y dejar este step como verificación pendiente del operador.

## Test plan

- `src/lib/content-analysis-agent.test.ts` (crear, modelar sobre `src/lib/reel-transcription.test.ts`):
  - `shouldReuseExistingAnalysis`: insight presente + status `ready` → true; + `fallback` → true; insight presente pero **sin** `videoPotential` + status `ready` → **true** (el caso del bug); insight `null` → false; status `failed` → false.
  - `shouldSkipFailedAnalysis`: status `failed` con `at` hace 1h → true; con `at` hace 25h → false; con `attempts: 5` → true (aunque `at` sea viejo); status `ready` → false; `analysisError` undefined → false; `at` no parseable → false.
- `src/lib/reel-transcription.test.ts` (extender):
  - `shouldSkipFailedTranscription`: failed + updatedAt hace 1h → true; failed + hace 25h → false; status `ready` → false; updatedAt null → false.
- Verificación: `pnpm test` → all pass.

## Done criteria

- [ ] `pnpm typecheck` exit 0
- [ ] `pnpm test` exit 0 con los tests nuevos listados arriba
- [ ] `grep -n "videoPotential" src/lib/content-analysis-agent.ts` → la guarda de reuso ya NO depende de él
- [ ] Ambos unions de outcome incluyen `"skipped"` y las stats lo cuentan
- [ ] `git status` → solo los 4 archivos in-scope modificados/creados
- [ ] (Si hay credenciales) segunda pasada de `pnpm sync:run` con `attempted: 0`
- [ ] Fila actualizada en `plans/README.md`

## STOP conditions

- Los excerpts de "Current state" no coinciden con el código (drift).
- `outcome` de cualquiera de los dos módulos se consume en algún lugar con un switch exhaustivo que rompe al agregar `"skipped"` — correr `grep -rn "outcome" src/ --include="*.ts" -l` y revisar consumidores; si hay más de los 2 conocidos (`run-full-sync.ts` y los propios módulos), STOP y listar.
- `detail.item.rawPayload` no es accesible o no es un objeto en `runContentItemAnalysis` (la suposición "analysisError vive en rawPayload" sería falsa).
- El fix requiere tocar `run-full-sync.ts` o el schema de Supabase.

## Maintenance notes

- **Backfill de videoPotential**: los insights viejos sin `videoPotential` parseable ya NO se re-analizan solos. Si se quiere completarlos, correr `pnpm sync:ai` (es su propósito). Si ese script usa la misma guarda nueva, puede necesitar un flag `--force` — revisar `scripts/run-ai-backfill.ts` en ese momento (deliberadamente fuera de alcance hoy).
- **Items con fallo permanente** (analysis attempts ≥ 5): quedan congelados hasta intervención manual (borrar `analysisError` del rawPayload o re-correr `sync:ai`). El revisor debe saber que esto es intencional.
- La transcripción solo tiene cooldown de 24h (sin cap de intentos) porque no hay dónde persistir el contador sin migración. Si el gasto por reintentos diarios sigue molestando, la migración (columna `transcription_attempts`) es el follow-up natural.
- Revisor: el riesgo principal es el sentido invertido de una guarda — verificar que contenido NUEVO (sin insight, sin transcript) sigue pasando a análisis/transcripción (los tests del caso `insight null → false` cubren esto).
