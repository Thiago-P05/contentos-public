# ContentOS — Social Content Dashboard

Next.js 16 full-stack dashboard para análisis y gestión de contenido de redes sociales. Incluye sincronización de métricas, agentes automáticos y un MCP remoto de solo lectura.

## Stack

- **Framework**: Next.js 16 (App Router) · TypeScript
- **CSS**: Tailwind CSS v4 (`@import "tailwindcss"` — no `tailwind.config.ts`)
- **DB**: Supabase (Postgres + Auth)
- **Cache/Rate limit**: Upstash Redis
- **AI**: OpenRouter para análisis y transcripción
- **Observability**: Langfuse
- **Runtime**: Node.js (no Edge runtime)

## Comandos

```bash
pnpm dev              # dev server
pnpm build            # production build
pnpm typecheck        # tsc --noEmit (sin output = OK)
pnpm test             # vitest run --coverage
pnpm lint             # eslint
pnpm sync:run         # sync completo de datos
pnpm sync:dashboard   # sync solo dashboard
pnpm sync:ai          # backfill de análisis AI
```

## Estructura clave

```
src/
  app/
    dashboard/        # Métricas principales
    audience/         # Seguidores y audiencia
    content/          # Biblioteca de contenido
    agents/           # MCP + análisis/transcripción por cuenta
    api/
      agents/         # Settings de análisis/transcripción
      sync/           # Endpoints de sincronización
      oauth/          # Instagram/TikTok OAuth
  components/
    app-shell.tsx     # Layout principal (sidebar + header)
  lib/
    mcp/                      # Servidor y DTOs read-only para agentes externos
    content-analysis-agent.ts
    reel-transcription.ts
    env.ts                    # Validación de env vars con Zod
    supabase/                 # Repository pattern (queries, mappers)
    sync/                     # Sincronización de plataformas
  proxy.ts            # Auth middleware (en Next 16, middleware.ts se renombró a proxy.ts)
```

## App Shell Layout

```
h-screen flex overflow-hidden
├── Sidebar (w-[200px], lg:flex, colapsable)
└── flex flex-col flex-1 overflow-hidden
    ├── Header h-14 (3.5rem) — toggle sidebar + toggle de tema
    └── Main flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 xl:px-8 xl:py-8
        └── .ds-page {children}
```

## Design System

Basado en el preset shadcn `b3XpoFP53I` (style `radix-rhea`, baseColor `neutral`,
Inter body + Geist headings + Geist Mono, radius `0.625rem`). Todo vive en
`src/app/globals.css`.

### Temas

`:root` es **light**, `[data-theme="dark"]` es **dark**. El script inline de
`layout.tsx` fija el atributo antes del primer paint (default: dark) y
`src/lib/theme.ts` lo persiste en `localStorage`. `@custom-variant dark` está
redefinido a `[data-theme="dark"] &` para que las utilities `dark:` de Tailwind
sigan el mismo switch.

**Regla:** todo token declarado en `:root` debe tener su gemelo en
`[data-theme="dark"]`. Las únicas excepciones válidas son la geometría
(`--radius`, `--r-*`, `--chart-*-width/opacity`), los derivados
(`--ring-offset-background`, `--shadow-focus`) y `--brand`, que es el
color de acento y por definición no cambia entre temas. El nombre visible
sale de `NEXT_PUBLIC_APP_NAME` vía `src/lib/branding.ts` — no hardcodearlo.

### Semántica de tokens (convención shadcn)

`--muted`, `--secondary` y `--accent` son **superficies**, no colores de texto.
Los grises de texto salen de `--muted-foreground`. Usar `text-muted` o
`text-secondary` deja texto invisible — no existen como clases válidas.

### Escala tipográfica

`text-micro` (9px) · `text-label` (10px) · `text-caption` (11px) ·
`text-body-sm` (12px) · `text-body` (13px) · `text-lead` (14px, base del body) ·
`text-title` (17px). No usar `text-[Npx]` arbitrarios.

Tracking: `tracking-display` · `tracking-snug` · `tracking-label` ·
`tracking-caps` · `tracking-caps-wide`. Nombres propios a propósito, para no
pisar la escala core de Tailwind.

### Colores de datos

- **Series de métricas** (`--series-views`, `--series-likes`, …): 14 slots
  semánticos con hue propio. Única fuente de verdad; `src/lib/dashboard-metrics.ts`
  los consume vía `var(--series-*)`.
- **Rampa categórica** (`--chart-1..5`): neutrales del preset. Para cuentas,
  países, edades — categorías sin significado inherente.
- **Plataformas**: `getPlatformColor()` / `PLATFORM_TEXT_CLASSES` en
  `src/lib/platforms.ts`. No hardcodear el rosa de Instagram ni el rojo de YouTube.

### Clases `.ds-*`

Viven en `@layer components`, así que **las utilities de Tailwind les ganan**.
Antes estaban sin capa y era al revés. `cn()` usa `twMerge`, así que las clases
del call site sobreescriben limpio.

`.ds-animate-in` y `.ds-delay-1..6` llevan prefijo porque `animate-in` colisiona
con `tw-animate-css` y `delay-N` con el `transition-delay` del core de Tailwind.

### Verificación visual

`node scripts/capture-ui-baseline.mjs` captura todas las rutas en ambos temas.
Necesita `SHOT_EMAIL` / `SHOT_PASSWORD` para pasar el login; sin eso solo llega a
`/login`. Salida configurable con `UI_BASELINE_OUT`.

## Variables de entorno críticas

```bash
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
CONNECTION_ENCRYPTION_SECRET   # o AUTH_SECRET como fallback
AUTH_SECRET                    # firma el state de OAuth
ALLOWED_USER_EMAIL / ALLOWED_USER_ID   # allowlist de un solo usuario

# AI por función (independientes — no compartir entre agentes)
OPENROUTER_API_KEY_ANALYSIS          # análisis de contenido
OPENROUTER_API_KEY_TRANSCRIPTION     # transcripción de reels
```

**Regla de las API keys**: análisis y transcripción tienen grupos independientes. No cruzar keys entre dominios.

## Gotchas / Convenciones

### Tailwind v4 y CSS Cascade Layers
Las reglas de `globals.css` fuera de `@layer` tienen mayor prioridad que los utilities de Tailwind. El foco global (`textarea:focus-visible`) está en `@layer base` para que `focus-visible:outline-none` de Tailwind pueda sobreescribirlo.

### Métricas de seguidores
La métrica `follows` (seguidores ganados) usa `follower_count` daily data, no `follows_and_unfollows`. Ver commits `18e8328` y `1e37517` para contexto.

### Costos de IA en sync (no romper estas guardas)
El sync recorre TODO el contenido desde `BACKFILL_START_ISO` en cada corrida. Las guardas en `src/lib/content-analysis-agent.ts` y `src/lib/reel-transcription.ts` son lo único que evita re-pagar OpenRouter por contenido ya procesado:

- **Reuso de análisis**: insight existente + status `ready`/`fallback` → `reused` (`shouldReuseExistingAnalysis`). NO exige `videoPotential`: los insights sin él se backfillean con `pnpm sync:ai`, no endureciendo esta guarda.
- **Reintentos con presupuesto**: análisis fallido → cooldown 24h y máx 5 intentos (`attempts` en `rawPayload.analysisError`); transcripción fallida → cooldown 24h vía `transcriptionUpdatedAt`. Outcome `skipped` en las stats del sync run.
- **Verificación**: dos `pnpm sync:run` consecutivos → la segunda pasada debe mostrar `analysis.attempted: 0` y `transcription.attempted: 0`.

### Backlog de planes
`plans/` contiene planes de implementación (orden, dependencias y hallazgos rechazados en `plans/README.md`). Antes de auditar o planear trabajo nuevo, leer ese índice para no duplicar.

### Marca y despliegue
El proyecto es self-hosted: cada instancia corre para un único usuario autorizado
(`ALLOWED_USER_EMAIL` / `ALLOWED_USER_ID`). El nombre visible, el acento y la cuenta
preseleccionada son configurables por env — no hardcodear ninguno.
