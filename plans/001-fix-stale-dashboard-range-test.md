# Plan 001: Reparar el test stale de `normalizeDashboardRange` para que la suite vuelva a verde

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 7ae93d2..HEAD -- src/lib/dashboard-range.ts src/lib/dashboard-range.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `7ae93d2`, 2026-06-11

## Why this matters

La suite de tests (`pnpm test`) sale en rojo SIEMPRE por un único test stale. Eso destruye el valor de toda la suite: nadie puede distinguir una regresión real de "el rojo de siempre". Este plan es prerequisito del plan 003 (CI), que necesita una suite verde para poder bloquear deploys. El test quedó desactualizado cuando el default del dashboard cambió de `"month"` a `"last30"` (ventanas rolling — ver commits `3df2038` y `96ce058` en `git log`).

## Current state

- `src/lib/dashboard-range.ts` — helpers de rangos del dashboard. La función bajo test (líneas 244–248):

```ts
export function normalizeDashboardRange(value: string | null | undefined): DashboardRange {
  return DASHBOARD_RANGE_OPTIONS.some((option) => option.value === value)
    ? (value as DashboardRange)
    : "last30";
}
```

- `src/lib/dashboard-range.test.ts` — el test stale (líneas 9–13):

```ts
it("normaliza valores invalidos a month", () => {
  expect(normalizeDashboardRange("month")).toBe("month");
  expect(normalizeDashboardRange("cualquier-cosa")).toBe("month");   // ← FALLA: el código devuelve "last30"
  expect(normalizeDashboardRange(undefined)).toBe("month");          // ← FALLA: el código devuelve "last30"
});
```

**Decisión ya tomada (no re-litigar)**: el comportamiento correcto es el del CÓDIGO (`"last30"` como fallback). El default rolling fue una decisión deliberada del mantenedor (múltiples commits de fixes alrededor de rolling windows). Se actualiza el TEST, no el código.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Test del archivo | `npx vitest run src/lib/dashboard-range.test.ts` | 3 passed, 0 failed |
| Suite completa | `pnpm test` | exit 0, 0 failed |
| Typecheck | `pnpm typecheck` | exit 0, sin output |

## Scope

**In scope** (los únicos archivos a modificar):
- `src/lib/dashboard-range.test.ts`

**Out of scope** (NO tocar):
- `src/lib/dashboard-range.ts` — el código es el comportamiento deseado.
- Cualquier otro test o archivo fuente.

## Git workflow

- Branch: `advisor/001-fix-stale-dashboard-range-test` (desde `contentOS-dashboard-v2`)
- Commit style: conventional commits en español, ej. `fix: actualizar test de normalizeDashboardRange al default last30`
- NO pushear ni abrir PR salvo instrucción del operador.

## Steps

### Step 1: Actualizar las aserciones y el nombre del test

En `src/lib/dashboard-range.test.ts` líneas 9–13, cambiar a:

```ts
it("normaliza valores invalidos a last30", () => {
  expect(normalizeDashboardRange("month")).toBe("month");
  expect(normalizeDashboardRange("cualquier-cosa")).toBe("last30");
  expect(normalizeDashboardRange(undefined)).toBe("last30");
});
```

(La primera aserción no cambia: `"month"` es un valor válido y se preserva.)

**Verify**: `npx vitest run src/lib/dashboard-range.test.ts` → `3 passed`

### Step 2: Confirmar que la suite completa queda en verde

**Verify**: `pnpm test` → exit 0, `0 failed`. Anotar el total de tests que pasan (al momento de planear: 67 tests en total, 1 fallaba).

## Test plan

Este plan ES un fix de test; no se agregan tests nuevos. La verificación es la suite completa en verde.

## Done criteria

- [ ] `npx vitest run src/lib/dashboard-range.test.ts` → 3 passed
- [ ] `pnpm test` → exit 0, 0 failed
- [ ] `git status` muestra solo `src/lib/dashboard-range.test.ts` modificado
- [ ] Fila de este plan actualizada en `plans/README.md`

## STOP conditions

Stop and report back (do not improvise) if:

- `normalizeDashboardRange` en `src/lib/dashboard-range.ts:244-248` ya no devuelve `"last30"` como fallback (drift — alguien cambió el default).
- Tras el fix, `pnpm test` sigue fallando en OTROS archivos (hay más tests rotos de los que este plan conoce — reportar la lista, no arreglarlos).

## Maintenance notes

- Si en el futuro cambia el rango default del dashboard, este test es el primero que va a fallar — es deliberado: obliga a confirmar el cambio de default como decisión consciente.
- Revisor: verificar que solo cambió el archivo de test.
