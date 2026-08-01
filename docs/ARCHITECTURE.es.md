# Content OS — Arquitectura

> Documento de arquitectura en profundidad. Para instalar y correr el proyecto,
> empezá por el [README](../README.md).

Workspace self-hosted para operar el contenido de una cuenta desde un solo lugar.

La app conecta cuentas sociales por OAuth, sincroniza contenido y métricas a Supabase, genera transcripciones y análisis con IA, permite consultar insights desde dashboard y biblioteca, y expone un MCP remoto de solo lectura para agentes externos.

Este documento cubre el proyecto completo: qué hace, cómo está armado, por qué está diseñado así, qué módulos existen, qué rutas expone, qué tablas usa, cómo se despliega y qué supuestos de arquitectura hay detrás.

## Tabla de contenido

1. [Objetivo del proyecto](#objetivo-del-proyecto)
2. [Qué hace la app](#qué-hace-la-app)
3. [Principios de diseño](#principios-de-diseño)
4. [Stack tecnológico](#stack-tecnológico)
5. [Arquitectura general](#arquitectura-general)
6. [Estructura del repositorio](#estructura-del-repositorio)
7. [Rutas de la aplicación](#rutas-de-la-aplicación)
8. [Rutas API](#rutas-api)
9. [Capas internas en `src/lib`](#capas-internas-en-srclib)
10. [Modelo de datos en Supabase](#modelo-de-datos-en-supabase)
11. [Flujo de autenticación y seguridad](#flujo-de-autenticación-y-seguridad)
12. [Flujo OAuth por plataforma](#flujo-oauth-por-plataforma)
13. [Flujo de sincronización](#flujo-de-sincronización)
14. [Flujo de análisis IA](#flujo-de-análisis-ia)
15. [Módulos de competencia y automatizaciones](#módulos-de-competencia-y-automatizaciones)
16. [Variables de entorno](#variables-de-entorno)
17. [Scripts disponibles](#scripts-disponibles)
18. [Cómo correr el proyecto localmente](#cómo-correr-el-proyecto-localmente)
19. [Cómo desplegar en Vercel](#cómo-desplegar-en-vercel)
20. [Testing y validaciones](#testing-y-validaciones)
21. [Decisiones técnicas y por qué se hicieron así](#decisiones-técnicas-y-por-qué-se-hicieron-así)
22. [Limitaciones actuales](#limitaciones-actuales)
23. [Checklist de producción](#checklist-de-producción)

## Objetivo del proyecto

El objetivo no es ser una red social ni un SaaS multi-tenant generalista.

El objetivo es tener un **sistema operativo de contenido privado**, orientado a una sola operación real, donde:

- las cuentas sociales se conectan una vez,
- los datos se sincronizan y se almacenan de forma durable,
- la IA trabaja sobre datos propios en vez de prompts vacíos,
- el análisis, la biblioteca, la audiencia y el MCP comparten el mismo contexto,
- todo queda protegido para un único usuario autorizado.

En otras palabras: no es solo un dashboard ni solo un sync. Es una base de datos viva de contenido con una capa de lectura, consulta y operación encima.

## Qué hace la app

La app hoy cubre estos flujos principales:

1. Login privado con Supabase Auth.
2. Restricción de acceso por allowlist de un único usuario.
3. Conexión de cuentas de Instagram y TikTok por OAuth.
4. Sincronización manual de contenido y métricas.
5. Persistencia de contenido, métricas, captions, transcripciones, insights y conexiones.
6. Dashboard con métricas agregadas y tendencias.
7. Biblioteca de contenido con filtros y detalle por pieza.
8. Vista de audiencia y demografía.
9. Servidor MCP remoto de solo lectura para conectar agentes externos con contexto real de contenido.
10. Base preparada para módulos más avanzados: competencia y automatizaciones.

## Principios de diseño

Este proyecto sigue varias decisiones deliberadas:

1. **Privado primero**
   Todo el sistema está pensado para uso interno, no público.

2. **Datos propios antes que IA genérica**
   La IA solo tiene sentido si responde sobre la data sincronizada del negocio.

3. **Backend-for-frontend real**
   La UI no habla directo con la base; pasa por repositorios y rutas controladas.

4. **Persistencia antes que embellishment**
   Primero se guarda el contenido; después se intenta transcripción y análisis.

5. **Seguridad por capas**
   Proxy, allowlist, auth SSR, guards server-side, rate limit, origin checks, RLS, revokes, headers, CSP report-only.

6. **Evolución incremental**
   El schema tiene módulos más adelantados que la UI porque el proyecto creció por etapas reales de uso.

## Stack tecnológico

### Frontend / App

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Radix UI en algunos componentes base

### Backend / Datos

- Supabase
- Postgres
- pgvector
- Supabase Auth SSR

### IA / Observabilidad

- OpenRouter
- Langfuse

### Integraciones externas

- Instagram Graph API / OAuth
- TikTok API / OAuth
- Apify para competencia
- OpusClip para automatizaciones futuras
- Upstash Redis para rate limit en Vercel

## Arquitectura general

La arquitectura tiene cinco capas prácticas:

1. **App Router / páginas**
   Renderizan UI, leen datos del repositorio y disparan acciones vía rutas API.

2. **Proxy de acceso**
   `src/proxy.ts` intercepta requests, valida la sesión Supabase y verifica allowlist.

3. **Rutas API internas**
   Son la superficie de mutación/control: sync, OAuth, agentes, content, observability, disconnect, brief, etc.

4. **Librerías de dominio (`src/lib`)**
   Contienen auth, seguridad, OAuth, clientes externos, lógica IA, mappers, repositorios y sync.

5. **Supabase**
   Es la capa de almacenamiento central: contenido, métricas, insights, briefs, comentarios, hilos, automatizaciones, competencia, etc.

## Estructura del repositorio

```text
.
├── public/                 # Assets públicos de Next.js
├── scripts/                # Scripts CLI y tareas manuales
├── src/
│   ├── app/                # Rutas web + route handlers
│   ├── components/         # Componentes de UI y composición
│   ├── lib/                # Lógica de dominio e infraestructura
│   └── instrumentation.ts  # Instrumentación del runtime
├── supabase/
│   ├── migrations/         # Migraciones SQL versionadas
│   └── run_all_migrations.sql
├── next.config.ts
├── package.json
└── README.md
```

### Carpetas importantes

#### `src/app`

Contiene páginas de producto y rutas API. Acá vive la experiencia principal.

#### `src/components`

Contiene:

- layout global (`app-shell`),
- dashboard widgets,
- cards de análisis,
- previews de contenido,
- formularios de briefs,
- calendario,
- UI base reutilizable.

#### `src/lib`

Es la capa más importante del proyecto. Acá están las decisiones reales:

- seguridad,
- auth,
- OAuth,
- repositorio de Supabase,
- sync,
- clientes externos,
- análisis IA,
- agentes,
- competencia,
- observabilidad.

#### `supabase/migrations`

Documenta la historia del esquema. Este proyecto depende mucho del modelo de datos, así que esta carpeta es parte central de la arquitectura, no un detalle secundario.

## Rutas de la aplicación

### `/`

Archivo: `src/app/page.tsx`

No tiene lógica propia. Redirige a `/dashboard`.

**Por qué**: el dashboard es la entrada operativa principal del sistema actual.

### `/login`

Archivos:

- `src/app/login/page.tsx`
- `src/app/login/login-form.tsx`

Maneja login privado con Supabase Auth. Ya no expone signup porque el sistema es solo para un usuario autorizado.

### `/dashboard`

Archivo: `src/app/dashboard/page.tsx`

Muestra métricas agregadas, comparaciones de período, gráficos y contenido reciente.

### `/content`

Archivo: `src/app/content/page.tsx`

Es la biblioteca de piezas. Permite filtrar por plataforma, cuenta, sección, query y orden.

### `/content/[id]`

Archivo: `src/app/content/[id]/page.tsx`

Detalle completo de una pieza:

- métricas principales,
- métricas secundarias,
- preview visual,
- análisis IA,
- transcripción.

### `/calendar`

Archivo: `src/app/calendar/page.tsx`

Renderiza un calendario mensual con piezas existentes y una UX de programación.

### `/audience`

Archivo: `src/app/audience/page.tsx`

Muestra datos de audiencia y demografía, principalmente para Instagram.

### `/account`

Archivo: `src/app/account/page.tsx`

Es el centro de control de OAuth y de briefs estratégicos por cuenta.

### `/agents`

Archivo: `src/app/agents/page.tsx`

Administra el MCP remoto y permite activar o pausar análisis y transcripción por cuenta.

### `/patterns`

Archivo: `src/app/patterns/page.tsx`

Placeholder / superficie futura.

## Rutas API

### Auth

- `POST /api/auth/logout`
  - Archivo: `src/app/api/auth/logout/route.ts`
  - Cierra la sesión Supabase.

- `GET /auth/callback`
  - Archivo: `src/app/auth/callback/route.ts`
  - Callback del login por email con Supabase Auth.

### OAuth externo

- `GET /api/oauth/[platform]/start`
  - Archivo: `src/app/api/oauth/[platform]/start/route.ts`
  - Genera `state` firmado y PKCE para TikTok.

- `GET /api/oauth/[platform]/callback`
  - Archivo: `src/app/api/oauth/[platform]/callback/route.ts`
  - Intercambia el código por tokens y persiste la conexión.

### Sync y datos

- `POST /api/sync/run`
  - Archivo: `src/app/api/sync/run/route.ts`
  - Ejecuta sync full o dashboard.

- `GET /api/dashboard/overview`
  - Archivo: `src/app/api/dashboard/overview/route.ts`
  - Devuelve el payload del dashboard.

- `GET /api/content`
  - Archivo: `src/app/api/content/route.ts`
  - Lista catálogo paginable/filtrable.

- `GET /api/content/[id]`
  - Archivo: `src/app/api/content/[id]/route.ts`
  - Devuelve el detalle de una pieza.

### Configuración de agentes automáticos

- `PATCH /api/agents/settings/[connectionId]`

Activa o pausa análisis y transcripción por cuenta.

### Cuenta / briefs

- `POST /api/account/connections/[id]/brief`
- `POST /api/account/connections/[id]/disconnect`

Permiten persistir contexto estratégico por cuenta y desconectar credenciales.

### Observabilidad

- `GET /api/observability/langfuse/status`

Archivo: `src/app/api/observability/langfuse/status/route.ts`

Sirve para verificar el estado de instrumentación de Langfuse.

### Calendario

- `POST /api/calendar/publish`

Archivo: `src/app/api/calendar/publish/route.ts`

Actualmente no publica de verdad. Simula la operación para validar la experiencia y el flujo de programación.

## Capas internas en `src/lib`

## `env.ts`

Archivo: `src/lib/env.ts`

Centraliza la lectura y validación de variables de entorno con `zod`.

**Por qué**:

- evita leer strings sueltos por todo el proyecto,
- da defaults razonables,
- documenta dependencias reales,
- reduce errores silenciosos de configuración.

## `server-auth.ts`

Archivo: `src/lib/server-auth.ts`

Resuelve el usuario permitido a nivel server-side. Implementa:

- validación de allowlist,
- helper para APIs,
- helper para páginas protegidas.

**Por qué**:

- el proxy no alcanza por sí solo,
- las rutas y páginas que usan service role deben revalidar autorización en su propio contexto.

## `request-security.ts`

Archivo: `src/lib/request-security.ts`

Agrupa:

- auth obligatoria en APIs,
- check de `Origin` para mutaciones,
- rate limit con Upstash,
- manejo uniforme de errores públicos,
- logging server-side.

**Por qué**:

- evita copiar lógica de seguridad en cada route handler,
- baja riesgo de inconsistencias,
- permite endurecer la app por capas.

## `secure.ts`

Archivo: `src/lib/secure.ts`

Provee:

- cifrado de secretos,
- firmado/verificación de payloads,
- utilidad para resolver `APP_URL` absoluta.

Se usa especialmente en OAuth y almacenamiento de credenciales.

## `oauth.ts`

Archivo: `src/lib/oauth.ts`

Implementa toda la lógica de:

- callback URLs,
- armado de authorization URLs,
- scopes,
- intercambio de code por token,
- refresh de tokens,
- lectura de perfiles básicos.

**Por qué está separada**:

- la lógica OAuth es compleja,
- mezcla URLs, expiraciones, providers y shape distintos por plataforma,
- conviene aislarla del resto de la app.

## Capa Supabase

### `src/lib/supabase/server.ts`

Construye clientes SSR, de proxy y de route handlers.

### `src/lib/supabase/admin.ts`

Construye el cliente con `SUPABASE_SERVICE_ROLE_KEY`.

### `src/lib/supabase/repository.ts`

Fachada pública de acceso a datos. Exporta funciones de lectura y escritura desde una sola puerta de entrada.

### `src/lib/supabase/read-repository.ts`

Contiene queries de negocio más pesadas: dashboard, catálogo, overview, detalle, conexiones, sync runs, etc.

### `src/lib/supabase/write-repository.ts`

Contiene mutaciones y upserts sobre contenido, snapshots, insights, briefs, automations, threads y más.

**Por qué existe esta separación**:

- aislar lecturas de escrituras,
- mantener pages/API con menos ruido,
- preservar un punto claro de acceso a datos,
- evitar SQL y shape mapping repartidos por toda la app.

## Capa de sync

### `src/lib/sync/run-full-sync.ts`

Es el corazón operativo del proyecto.

Hace, entre otras cosas:

- determina cuentas activas,
- refresca tokens si hace falta,
- llama clientes de Instagram/TikTok,
- persiste contenido y métricas,
- dispara enriquecimiento IA.

### `src/lib/sync/run-ai-backfill.ts`

Sirve para reprocesar o completar análisis IA sobre contenido ya persistido.

**Por qué esto vive separado de la UI**:

- el sync es una pipeline operativa, no una responsabilidad del frontend,
- debe poder ejecutarse por API, CLI o tarea programada.

## Capa IA

### `src/lib/ai/analysis.ts`

Encapsula la lógica de análisis con IA y parte de la transcripción.

### `src/lib/content-analysis-agent.ts`

Orquesta análisis por pieza, decide inputs y cómo persistir resultados.

### `src/lib/reel-transcription.ts`

Resuelve transcripciones y el manejo de sus estados.

## Observabilidad

Archivo: `src/lib/observability/langfuse.ts`

Se encarga de:

- crear trazas y generaciones,
- capturar metadata de modelos,
- medir uso/costo,
- sanitizar payloads sensibles.

**Por qué**:

- una app con múltiples proveedores IA sin observabilidad se vuelve opaca,
- medir costo, latencia y resultado es esencial si el chat y el análisis van a escalar.

## Competencia y automatizaciones

### Competencia

Archivos:

- `src/lib/competition/analysis.ts`
- `src/lib/competition/apify.ts`
- `src/lib/competition/service.ts`
- `src/lib/competition/url.ts`

El módulo existe en backend y schema para:

- resolver perfiles,
- scrapear contenido con Apify,
- calcular métricas agregadas,
- generar reportes con IA.

### Automatizaciones

El schema y el dominio ya contemplan corridas automatizadas (`automation_runs`, `automation_outputs`, `automation_run_items`) con tipos como `opusclip_video_clipper` y `super_assistant`.

**Por qué esto existe aunque no toda la UI esté expuesta**:

- el producto fue creciendo por etapas,
- primero se consolidó la base y el modelo de datos,
- después se puede exponer cada capability a la interfaz cuando haga falta.

## Modelo de datos en Supabase

La base no es solo almacenamiento pasivo. Es el eje del producto.

## Tablas principales

### `content_items`

Representa cada pieza sincronizada.

Campos conceptuales importantes:

- plataforma
- external id
- fecha de publicación
- título/caption/description
- URLs de media/thumbnail/permalink
- estado de análisis
- payload raw original
- vínculo con `platform_connections`
- estado y metadata de transcripción

Es la tabla central del sistema.

### `content_metric_snapshots`

Guarda snapshots de métricas en distintos momentos.

**Por qué snapshots y no overwrite**:

- permite analizar evolución en el tiempo,
- hace posible construir tendencias,
- evita perder histórico por una sola actualización.

### `content_text_assets`

Guarda texto asociado al contenido:

- caption de plataforma
- caption oficial
- transcript
- fallback metadata

**Por qué separarlo de `content_items`**:

- una pieza puede tener múltiples fuentes textuales,
- simplifica reuso por análisis y chat,
- hace explícita la procedencia del texto.

### `ai_insights`

Persiste el resultado del análisis IA por pieza.

Incluye summary, strengths, weaknesses, hooks, improvements, confidence y payload raw del modelo.

### `embeddings`

Guarda embeddings vectoriales por pieza para usos presentes o futuros de recuperación semántica.

### `sync_runs`

Historial de ejecuciones de sincronización.

Sirve para observabilidad operativa y debug.

### `platform_connections`

Credenciales y metadata de las cuentas conectadas por OAuth.

### `platform_connection_briefs`

Contexto estratégico por cuenta:

- oferta,
- ICP,
- dolor,
- outcome,
- tono,
- CTA,
- notas.

Esta tabla es importante porque convierte a la IA de “genérica” a “alineada al negocio”.

### `platform_comments`

Comentarios sincronizados de contenido.

### `competitor_*`

Persisten perfiles, corridas y snapshots de competencia.

### `automation_*`

Persisten corridas y outputs de automatizaciones.

## Migraciones principales

**La lista autoritativa es `supabase/migrations/` en disco**, y cada archivo
lleva una cabecera que explica qué hace y por qué. Ver
[DATABASE.md](DATABASE.md#migration-history) para el recorrido comentado.

Esta sección tenía antes una lista escrita a mano que quedó en 13 de 21
migraciones. Ese mismo desfasaje fue el que dejó a `run_all_migrations.sql` sin
la migración de RLS, así que no se reintroduce: cualquier lista copiada acá se
vuelve mentira en el próximo cambio de schema.

## Flujo de autenticación y seguridad

La app usa varias capas, no una sola.

## 1. Supabase Auth SSR

Los helpers de `src/lib/supabase/server.ts` crean clientes SSR compatibles con cookies.

## 2. Proxy global

Archivo: `src/proxy.ts`

Hace estas validaciones:

- deja pasar archivos públicos y `_next`,
- detecta si Supabase Auth está configurado,
- valida la sesión actual,
- verifica si el usuario está en allowlist,
- redirige a `/login` si no corresponde,
- devuelve `401` en APIs privadas si no hay autorización.

## 3. Allowlist dura

Variables:

- `ALLOWED_USER_EMAIL`
- `ALLOWED_USER_ID`

Si la sesión existe pero el usuario no coincide, la app lo considera no autorizado.

**Por qué**:

- la app es para una sola operación,
- no queremos depender solo de “tener cuenta Supabase”.

## 4. Guards server-side en páginas y APIs

Archivos:

- `src/lib/server-auth.ts`
- `src/lib/request-security.ts`

Esto evita depender únicamente del proxy. Incluso si una ruta se mueve o cambia matcher, sigue habiendo validación explícita.

## 5. Origin checks

Toda mutación sensible valida `Origin` contra `APP_URL`.

**Por qué**:

- reduce superficie CSRF,
- es una protección simple y efectiva para una app privada.

## 6. Rate limit

Si se configuran:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

entonces las APIs sensibles aplican rate limit por usuario/IP.

## 7. RLS y revokes

La migración `20260504_lock_down_public_access.sql`:

- activa RLS en tablas públicas,
- revoca permisos a `anon` y `authenticated`.

**Por qué**:

- el `anon key` existe en frontend,
- por lo tanto no alcanza con “no usar Supabase desde el browser” si la base queda abierta.

## 8. Headers de seguridad

`next.config.ts` agrega:

- `Content-Security-Policy-Report-Only`
- `Strict-Transport-Security`
- `X-Content-Type-Options`
- `X-Frame-Options`
- `Referrer-Policy`
- `Permissions-Policy`
- `Cross-Origin-Opener-Policy`
- `Cross-Origin-Resource-Policy`

Se eligió `Report-Only` para CSP como paso inicial, porque una CSP estricta puede requerir más ajuste fino de scripts/estilos del runtime.

## Flujo OAuth por plataforma

## Inicio

Desde `/account`, el usuario dispara `/api/oauth/[platform]/start`.

La ruta:

- verifica auth y allowlist,
- aplica rate limit,
- genera `state` firmado,
- para TikTok genera PKCE,
- redirige al provider.

## Callback

`/api/oauth/[platform]/callback`:

- revalida auth,
- controla state,
- valida PKCE cuando aplica,
- intercambia el code por tokens,
- obtiene perfil básico,
- persiste/upsertea la conexión.

**Por qué está hecho así**:

- el callback maneja secretos y credenciales,
- por eso todo vive server-side,
- además se prefieren errores genéricos para no filtrar detalles internos al cliente.

## Flujo de sincronización

El sync se dispara desde:

- UI (`SyncButton`)
- API (`POST /api/sync/run`)
- CLI (`scripts/run-sync.ts`)
- tarea programada (`register-weekly-sync.ps1`)

## Pipeline conceptual

1. Obtener conexiones activas.
2. Filtrar según `platform` y `connectionId`.
3. Refrescar credenciales si vencen.
4. Traer contenido de provider.
5. Upsertear `content_items`.
6. Guardar snapshots de métricas.
7. Guardar assets textuales.
8. Guardar comentarios si corresponde.
9. Ejecutar transcripción y análisis cuando aplique.
10. Registrar el `sync_run`.

**Por qué este orden**:

- si la IA falla, el contenido igual queda almacenado,
- eso hace que el sistema degrade bien en vez de bloquear la sincronización completa.

## Flujo de análisis IA

El análisis por pieza combina:

- caption,
- transcript,
- metadata,
- payload raw,
- brief estratégico,
- reglas del modelo.

El resultado se persiste en `ai_insights`.

Los estados típicos son:

- `pending`
- `ready`
- `fallback`
- `failed`

**Por qué hay `fallback`**:

- en contenido real muchas veces no hay transcript ideal,
- el sistema necesita seguir produciendo una lectura útil con el mejor input disponible.

## Módulos de competencia y automatizaciones

## Competencia

Existe una base backend para:

- tomar un perfil/URL,
- scrapear contenido desde Apify,
- medir comportamiento agregado,
- generar un análisis competitivo.

Hoy el módulo está más adelantado en `src/lib` y `supabase/migrations` que en la UI expuesta al usuario.

## Automatizaciones

La base ya contempla corridas automatizadas y outputs persistidos para integraciones como OpusClip y `super_assistant`.

Esto significa que el proyecto no es solo dashboard/chat: ya está modelado para evolucionar hacia una capa de automatización más seria.

## Variables de entorno

## Core app

- `APP_URL`
- `ALLOWED_USER_EMAIL`
- `ALLOWED_USER_ID`
- `CONNECTION_ENCRYPTION_SECRET`

## Supabase

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Rate limit

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

## OAuth

- `INSTAGRAM_CLIENT_ID`
- `INSTAGRAM_CLIENT_SECRET`
- `TIKTOK_CLIENT_KEY`
- `TIKTOK_CLIENT_SECRET`

## IA

- `OPENROUTER_API_KEY`
- `OPENROUTER_API_KEY_ANALYSIS`
- `OPENROUTER_API_KEY_ANALYSIS_COMPETENCIA`
- `OPENROUTER_API_KEY_TRANSCRIPTION`

## Observabilidad

- `LANGFUSE_PUBLIC_KEY`
- `LANGFUSE_SECRET_KEY`
- `LANGFUSE_BASE_URL`
- `LANGFUSE_ENABLED`
- `LANGFUSE_DEBUG`

## Otros módulos

- `APIFY_TOKEN`
- `APIFY_INSTAGRAM_ACTOR_ID`
- `OPUSCLIP_API_KEY`
- `OPUSCLIP_ORG_ID`
- `OPUSCLIP_API_BASE_URL`

Para el listado exacto actual, ver `src/lib/env.ts` y `.env.example`.

## Scripts disponibles

Definidos en `package.json`:

- `pnpm dev`
- `pnpm dev:https`
- `pnpm build`
- `pnpm start`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm sync:dashboard`
- `pnpm sync:ai`
- `pnpm sync:run`
- `pnpm task:register`
- `pnpm reanalyze:april`

## Explicación de cada uno

### `dev`

Levanta Next en desarrollo.

### `dev:https`

Levanta Next con HTTPS experimental. Útil para validar algunos flujos locales más parecidos a producción.

### `build`

Build de producción.

### `start`

Sirve la build producida.

### `lint`

Corre ESLint.

### `typecheck`

Corre TypeScript sin emitir archivos.

### `test`

Corre Vitest con cobertura.

### `sync:dashboard`

Ejecuta el refresh de métricas/dashboard desde CLI.

### `sync:ai`

Backfill/reproceso de análisis IA.

### `sync:run`

Sync completo desde CLI.

### `task:register`

Registra una tarea de Windows para sync semanal.

### `reanalyze:april`

Script puntual de reanálisis histórico.

## Cómo correr el proyecto localmente

1. Instalar dependencias.

```bash
corepack enable
pnpm install --frozen-lockfile
```

2. Copiar `.env.example` a `.env.local` y completar las credenciales (ver `src/lib/env.ts` para la validación completa).

3. Configurar las variables reales.

4. Ejecutar migraciones en Supabase en orden cronológico.

5. Levantar desarrollo.

```bash
pnpm dev
```

## Cómo desplegar en Vercel

## Repositorio

Este proyecto está preparado para deployarse desde la **raíz del repositorio**.

## Configuración recomendada en Vercel

- Framework: Next.js
- Root Directory: `/`
- Install Command: `pnpm install --frozen-lockfile`
- Build Command: `pnpm build`

## Variables obligatorias en Vercel

Como mínimo:

- `APP_URL=https://tu-dominio.com`
- `ALLOWED_USER_EMAIL=vos@example.com`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CONNECTION_ENCRYPTION_SECRET`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Y luego las de OAuth / IA según el flujo que quieras habilitar.

## Pasos previos a producción

1. Aplicar todas las migraciones SQL.
2. Desactivar signup público en Supabase Auth.
3. Confirmar allowlist del usuario correcto.
4. Confirmar `APP_URL` final.
5. Configurar Upstash si querés rate limit real en serverless.
6. Rotar secretos sensibles si alguna vez estuvieron expuestos.

## Testing y validaciones

Comandos recomendados antes de cada deploy importante:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Qué cubren hoy los tests

Hay tests distribuidos en varios módulos de dominio:

- métricas
- dashboard range / trends
- media parsing
- preferred connection
- transcripción
- supabase mappers / queries
- competition
- observability
- agentes

No es una cobertura perfecta de producto end-to-end, pero sí cubre bastante lógica crítica de negocio.

## Decisiones técnicas y por qué se hicieron así

## 1. Supabase como storage central

Se eligió porque combina:

- Postgres,
- Auth,
- API rápida,
- buen fit para prototipos serios y apps internas.

Para un sistema privado con mucho dato semiestructurado (`jsonb`, raw payloads, snapshots), encaja bien.

## 2. Repositorio de datos interno en vez de queries por todos lados

Porque el proyecto cruza:

- páginas,
- APIs,
- sync,
- IA,
- dashboards.

Sin una capa de repositorio, el código se volvería caótico muy rápido.

## 3. `service_role` en backend + RLS cerrada

Parece redundante, pero no lo es.

- `service_role` sirve para operar internamente con libertad.
- RLS cerrada sirve para que el frontend y cualquier cliente con `anon` no toquen los datos.

Es una decisión de seguridad, no de comodidad.

## 4. App de un solo usuario

No se construyó multi-tenant porque no había necesidad real.

Agregar multiusuario por anticipación habría encarecido:

- schema,
- authz,
- políticas,
- UI,
- aislamiento de datos,
- testing.

La decisión fue optimizar para el caso real: una sola operación privada.

## 5. Snapshots de métricas

Se eligió snapshot en vez de “último valor” porque:

- permite ver evolución,
- hace posible medir tendencias,
- habilita comparativas temporales,
- reduce pérdida de información histórica.

## 6. Brief estratégico por cuenta

Es una de las decisiones más importantes del proyecto.

Sin esto, el análisis IA solo podría evaluar performance. Con esto, también puede evaluar **alineación estratégica**.

## 7. Calendario simulado primero

Se priorizó validar UX antes de integrar publicación real con storage/media workflows complejos.

Es una decisión pragmática: primero probar el flujo, después endurecer la automatización.

## 8. CSP en report-only antes que estricta inmediata

Porque una CSP estricta mal aplicada rompe apps modernas rápido.

La estrategia elegida fue:

- empezar reportando,
- observar,
- y luego endurecer cuando el runtime y los assets estén claros.

## 10. Automatizaciones y competencia adelantadas en schema

Porque el roadmap real del producto ya iba hacia ahí. El schema se preparó antes que toda la UI.

Eso evita rediseños dolorosos después.

## Limitaciones actuales

1. `calendar/publish` hoy simula publicación, no publica de verdad.
2. El módulo de competencia está más maduro en backend/schema que en UI.
3. El módulo de automatizaciones está modelado pero no completamente expuesto.
4. Puede haber drift histórico entre schema real y migraciones en algunos detalles puntuales.
5. La CSP aún está en `Report-Only`, no en modo estricto.

## Checklist de producción

1. `corepack enable && pnpm install --frozen-lockfile`
2. `pnpm lint`
3. `pnpm typecheck`
4. `pnpm test`
5. `pnpm build`
6. Configurar variables de entorno en Vercel
7. Aplicar migraciones en Supabase
8. Desactivar signup público en Supabase
9. Verificar `ALLOWED_USER_EMAIL`
10. Configurar Upstash
11. Verificar callbacks OAuth correctos
12. Probar login
13. Probar `/account`
14. Probar sync manual
15. Probar dashboard
16. Probar `/content`
17. Probar `/agents` y `/mcp`

## Resumen final

Este proyecto está construido como una combinación de:

- **sistema de sync**,
- **base de conocimiento de contenido**,
- **motor de análisis IA**,
- **workspace privado de operación**,
- **capa inicial de automatizaciones futuras**.

La clave de la arquitectura no está en que use Next.js o Supabase, sino en que todas las capas comparten el mismo centro:

**contenido real, métricas reales, contexto estratégico real y acceso privado controlado**.

Ese es el motivo principal por el que el proyecto está diseñado como está.
