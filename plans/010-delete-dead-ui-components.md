# Plan 010: Eliminar componentes UI muertos (glowing-card, line-charts-1, textarea)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 7ae93d2..HEAD -- src/components/ui/`
> Ante un mismatch (p. ej. alguien empezó a importar estos archivos), STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW (archivos sin imports; el typecheck + build atrapan cualquier error)
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `7ae93d2`, 2026-06-11

## Why this matters

Tres archivos en `src/components/ui/` no los importa nadie (verificado por grep en el commit de planificación). Son restos de design-kits pegados durante la iteración de UI. Código muerto = superficie de mantenimiento gratis: aparece en búsquedas, confunde a agentes que lo toman como convención del repo, y `line-charts-1.tsx` además importa `recharts` (ruido para el plan 011 de consolidación de charts).

**ADVERTENCIA — falso positivo conocido**: una auditoría anterior marcó `ai-prompt-box.tsx` como muerto. Es FALSO: lo importa `src/components/ui/ruixen-moon-chat.tsx:7` (`import { PromptInputBox } from "@/components/ui/ai-prompt-box"`) y es el input del chat Ask AI (documentado en CLAUDE.md). NO borrarlo.

## Current state

Candidatos a borrar, con su verificación (cero imports en todo `src/`):

| Archivo | Verificación que debe dar vacío |
|---------|--------------------------------|
| `src/components/ui/glowing-card.tsx` | `grep -rn "ui/glowing-card" src/` |
| `src/components/ui/line-charts-1.tsx` | `grep -rn "ui/line-charts-1" src/` |
| `src/components/ui/textarea.tsx` | `grep -rn "ui/textarea" src/` |

NO borrar (usados — verificado): `ai-prompt-box.tsx`, `animated-ai-chat.tsx`, `ruixen-moon-chat.tsx`, `area-chart.tsx` (lo consume `trend-chart.tsx`; lo maneja el plan 011).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Verificar no-uso | los 3 greps de la tabla | 0 resultados cada uno |
| Typecheck | `pnpm typecheck` | exit 0 |
| Build | `pnpm build` | exit 0 |

## Scope

**In scope** (solo borrado):
- `src/components/ui/glowing-card.tsx`
- `src/components/ui/line-charts-1.tsx`
- `src/components/ui/textarea.tsx`

**Out of scope**:
- TODO el resto de `src/components/ui/` — en particular `ai-prompt-box.tsx` (ver advertencia).
- `package.json` — no quitar dependencias (recharts sigue usado por otros componentes).

## Git workflow

- Branch: `advisor/010-delete-dead-ui-components`
- Commit style: `chore: eliminar componentes UI sin uso`
- NO pushear salvo instrucción del operador.

## Steps

### Step 1: Re-verificar el no-uso (obligatorio — el grep es la única red)

Correr los 3 greps de la tabla de "Current state". Además, por componentes referenciados sin path (`import { Textarea } from`):

```
grep -rn "from \"@/components/ui/textarea\"\|from '@/components/ui/textarea'" src/
grep -rln "GlowingCard\|LineCharts1\|LineChartsOne" src/ --include="*.tsx" --include="*.ts"
```

**Verify**: todos los greps → 0 resultados fuera de los propios archivos a borrar. Si CUALQUIERA tiene resultados, sacar ese archivo de la lista de borrado y reportarlo.

### Step 2: Borrar los 3 archivos

```
git rm src/components/ui/glowing-card.tsx src/components/ui/line-charts-1.tsx src/components/ui/textarea.tsx
```

**Verify**: `pnpm typecheck` → exit 0.

### Step 3: Build de confirmación

**Verify**: `pnpm build` → exit 0.

## Test plan

No aplica — borrado de código sin referencias. Typecheck + build son la verificación.

## Done criteria

- [ ] Los 3 archivos no existen
- [ ] `pnpm typecheck` exit 0 y `pnpm build` exit 0
- [ ] `ai-prompt-box.tsx` intacto (`git status` no lo lista)
- [ ] `git status` → solo los 3 borrados
- [ ] Fila actualizada en `plans/README.md`

## STOP conditions

- Cualquier grep del Step 1 encuentra un import — la suposición "muerto" es falsa para ese archivo.
- `pnpm typecheck` o `pnpm build` fallan tras el borrado (hay una referencia que los greps no vieron — restaurar con `git checkout -- <archivo>` y reportar).

## Maintenance notes

- `src/components/ui/` acumula componentes de design-kits; cuando se agregue uno nuevo, conviene confirmar que se usa antes de commitearlo.
- Si Ask AI se rediseña, `animated-ai-chat.tsx` y `ruixen-moon-chat.tsx` pueden quedar muertos — re-correr los greps de este plan en ese momento.
