# Guia hiper detallada para crear un Sistema Operativo de Contenido similar a ContentOS

> **Esto es un plano, no la documentacion de este repo.** Describe como construir
> un sistema parecido desde cero, y cubre un superset de lo que ContentOS tiene
> hoy: menciona un agente de chat interno (`spark_threads`, `spark_messages`) que
> este proyecto elimino a favor del servidor MCP de solo lectura.
>
> Para el schema real, ver [docs/DATABASE.md](docs/DATABASE.md). Para la
> arquitectura real, [docs/ARCHITECTURE.es.md](docs/ARCHITECTURE.es.md).

Esta guia explica como construir un Sistema Operativo de Contenido similar al proyecto analizado. Esta escrita para tres tipos de personas:

- Personas sin conocimientos de programacion que quieren entender que se esta construyendo.
- Personas que quieren pedirle a una IA de codigo como OpenCode, Codex, Claude Code o Cursor que cree el sistema.
- Agentes de IA que necesitan instrucciones claras para implementar el producto paso a paso.

El objetivo no es copiar codigo linea por linea, sino entender la arquitectura, las piezas necesarias, el orden correcto de construccion y los prompts que hay que darle a una IA para crear un sistema parecido.

## 1. Que es un Sistema Operativo de Contenido

Un Sistema Operativo de Contenido es una aplicacion privada que centraliza toda la operacion de contenido de una marca, creador, agencia o empresa.

No es solamente un dashboard.

No es solamente una biblioteca de publicaciones.

No es solamente un chatbot.

No es solamente un calendario editorial.

Es una base de datos viva donde se conectan cuentas sociales, se sincronizan publicaciones, se guardan metricas reales, se analizan piezas con IA y se usa toda esa informacion para tomar mejores decisiones de contenido.

En una frase simple:

> Un Content OS es el lugar donde una marca ve que publico, como rindio, por que rindio, que puede aprender y que deberia crear despues.

## 2. Que hace el proyecto analizado

El proyecto analizado es una aplicacion privada llamada Content OS. Su objetivo es operar contenido desde un solo lugar.

Funciones principales:

- Login privado con Supabase Auth.
- Acceso limitado a un usuario permitido por allowlist.
- Conexion OAuth de cuentas de Instagram y TikTok.
- Sincronizacion de contenido publicado.
- Guardado de publicaciones en Supabase.
- Guardado de metricas historicas por pieza.
- Guardado de captions, transcripciones e insights.
- Dashboard con metricas agregadas.
- Biblioteca centralizada de contenido.
- Pagina de detalle por pieza.
- Vista de audiencia.
- Calendario editorial.
- Agente IA en `/ask-ai` para ideas, guiones y analisis.
- Modulos preparados para competencia y automatizaciones.

## 3. Idea mental para personas no tecnicas

Para entenderlo sin saber programar, imagina que el sistema tiene estas partes:

1. **Puerta de entrada:** login privado para que solo entre la persona autorizada.

2. **Llaves de redes sociales:** conexiones a Instagram y TikTok para poder leer contenido y metricas.

3. **Deposito central:** base de datos donde se guarda todo.

4. **Motor de sincronizacion:** proceso que trae publicaciones y metricas desde las redes.

5. **Panel de control:** dashboard para ver numeros generales.

6. **Biblioteca:** lugar donde estan todas las piezas de contenido ordenadas.

7. **Ficha individual:** pagina de cada post o reel con metricas, preview, transcripcion y analisis.

8. **Cerebro IA:** agente que usa la informacion real del negocio para generar ideas, guiones y recomendaciones.

9. **Calendario:** espacio para ver y planificar contenido.

10. **Configuracion:** lugar para conectar cuentas y escribir el brief estrategico del negocio.

## 4. Stack tecnologico recomendado

Para crear un sistema similar se recomienda este stack:

- **Next.js:** framework para crear la aplicacion web.
- **React:** libreria para construir interfaces.
- **TypeScript:** JavaScript con tipos para evitar errores.
- **Tailwind CSS:** sistema de estilos rapido.
- **Supabase:** base de datos, autenticacion y storage.
- **Postgres:** base de datos relacional usada por Supabase.
- **Supabase Auth:** login con email y password.
- **OpenRouter:** gateway para modelos de IA.
- **Instagram Graph API:** para leer contenido y metricas de Instagram.
- **TikTok API:** para leer contenido y metricas de TikTok.
- **Upstash Redis:** rate limit para proteger rutas API.
- **Langfuse:** observabilidad de llamadas a IA, opcional.
- **Vercel:** despliegue recomendado para Next.js.

## 5. Arquitectura general

La arquitectura correcta se divide en capas.

### 5.1 Capa de interfaz

Es lo que ve el usuario.

Paginas principales:

- `/login`: inicio de sesion.
- `/dashboard`: metricas generales.
- `/content`: biblioteca de contenido.
- `/content/[id]`: detalle de una pieza.
- `/calendar`: calendario editorial.
- `/audience`: audiencia y demografia.
- `/account`: conexiones, configuracion y brief.
- `/ask-ai`: agente IA.

### 5.2 Capa de rutas API

Son endpoints internos que permiten hacer acciones.

Ejemplos:

- Crear chats.
- Enviar mensajes al agente.
- Sincronizar contenido.
- Conectar cuentas OAuth.
- Obtener datos del dashboard.
- Guardar briefs.
- Desconectar cuentas.

### 5.3 Capa de dominio

Es la logica del negocio.

Aqui viven:

- Seguridad.
- Autenticacion.
- Clientes de Instagram/TikTok.
- Repositorios de Supabase.
- Normalizadores de metricas.
- Analisis IA.
- Transcripciones.
- Sync.
- Contexto del agente.

### 5.4 Capa de base de datos

Supabase/Postgres guarda todos los datos.

Tablas principales:

- `platform_connections`
- `content_items`
- `content_metric_snapshots`
- `content_text_assets`
- `ai_insights`
- `sync_runs`
- `platform_comments`
- `platform_daily_insights`
- `platform_connection_briefs`
- `spark_threads`
- `spark_messages`

### 5.5 Capa de IA

El sistema usa IA para tres tareas:

- Analizar piezas de contenido.
- Transcribir videos o reels.
- Responder en el agente `/ask-ai` con datos reales.

## 6. Estructura de carpetas recomendada

```text
.
├── public/
├── scripts/
├── src/
│   ├── app/
│   │   ├── login/
│   │   ├── dashboard/
│   │   ├── content/
│   │   ├── calendar/
│   │   ├── audience/
│   │   ├── account/
│   │   ├── ask-ai/
│   │   └── api/
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   │   ├── agents/
│   │   ├── ai/
│   │   ├── clients/
│   │   ├── competition/
│   │   ├── oauth/
│   │   ├── supabase/
│   │   └── sync/
│   └── proxy.ts
├── supabase/
│   └── migrations/
├── package.json
└── README.md
```

## 7. Pantallas que debe tener el producto

### 7.1 Login

Objetivo:

- Permitir que solo usuarios autorizados entren al sistema.

Debe incluir:

- Campo email.
- Campo password.
- Boton entrar.
- Error visible si falla login.
- Redireccion al dashboard o `/ask-ai` si entra correctamente.

### 7.2 Dashboard

Objetivo:

- Ver estado general del contenido.

Debe incluir:

- Total views.
- Reach.
- Likes.
- Comments.
- Shares.
- Saves.
- Engagement.
- Grafico temporal.
- Top contenido.
- Filtros por plataforma.
- Filtros por cuenta.
- Filtros por rango de fecha.
- Boton de sincronizar.

### 7.3 Biblioteca de contenido

Objetivo:

- Ver todo el contenido centralizado.

Debe incluir:

- Grid o lista de publicaciones.
- Thumbnail.
- Plataforma.
- Tipo de contenido.
- Fecha.
- Caption o titulo.
- Metric cards pequeñas.
- Estado de analisis IA.
- Filtros por tipo.
- Busqueda.
- Orden por fecha, views o engagement.
- Paginacion o boton `Ver mas`.

### 7.4 Detalle de contenido

Objetivo:

- Ver toda la informacion de una pieza concreta.

Debe incluir:

- Preview visual.
- Link externo.
- Caption completo.
- Fecha de publicacion.
- Metric cards.
- Tendencias.
- Transcripcion.
- Analisis IA.
- Recomendaciones.

### 7.5 Calendario

Objetivo:

- Ver y planificar contenido.

Debe incluir:

- Vista mensual en desktop.
- Vista agenda en mobile.
- Posts publicados.
- Borradores.
- Contenido programado.
- Estados: `draft`, `scheduled`, `published`, `failed`.
- Modal para crear contenido.

Importante:

- No decir que publica realmente si todavia solo simula.
- Si no hay integracion real con APIs de publicacion, mostrarlo como calendario editorial.

### 7.6 Audience

Objetivo:

- Ver demografia y audiencia.

Debe incluir:

- Total followers.
- Paises principales.
- Ciudades principales.
- Edad.
- Genero.
- Provincias o regiones.
- Estado vacio si la plataforma no da esos datos.

### 7.7 Account

Objetivo:

- Configurar conexiones y contexto estrategico.

Debe incluir:

- Boton conectar Instagram.
- Boton conectar TikTok.
- Estado de cada conexion.
- Boton desconectar.
- Formulario de brief.

Campos del brief:

- Oferta.
- Cliente ideal.
- Dolor principal.
- Resultado deseado.
- Diferenciador.
- Tono.
- Cosas a evitar.
- CTA principal.
- Notas.

### 7.8 Ask AI

Objetivo:

- Chat con IA que usa datos reales del negocio.

Debe incluir:

- Lista de chats.
- Crear nuevo chat.
- Borrar chat.
- Caja de texto.
- Mensajes en Markdown.
- Loading state.
- Respuestas con contexto real.

## 8. Modelo de datos explicado para principiantes

### 8.1 `platform_connections`

Guarda cuentas conectadas.

Ejemplo:

- Instagram de la marca.
- TikTok de la marca.

Campos importantes:

- `platform`: instagram o tiktok.
- `account_external_id`: ID de la cuenta en la plataforma.
- `account_username`: usuario.
- `display_name`: nombre visible.
- `access_token_encrypted`: token cifrado.
- `refresh_token_encrypted`: refresh token cifrado.
- `token_expires_at`: vencimiento.
- `status`: active, disconnected o error.

### 8.2 `content_items`

Guarda cada pieza de contenido.

Ejemplo:

- Un Reel.
- Un TikTok.
- Un carrusel.
- Una historia si se soporta.

Campos importantes:

- `platform`.
- `external_id`.
- `connection_id`.
- `published_at`.
- `caption`.
- `permalink`.
- `thumbnail_url`.
- `media_url`.
- `status`.
- `analysis_status`.
- `transcription_status`.

### 8.3 `content_metric_snapshots`

Guarda metricas historicas.

Por que no guardar solo una metrica final:

- Porque las metricas cambian con el tiempo.
- Un video puede tener 1.000 views hoy y 20.000 views en tres dias.
- Los snapshots permiten ver evolucion.

Campos importantes:

- `content_item_id`.
- `captured_at`.
- `metrics` en JSON.

### 8.4 `content_text_assets`

Guarda textos asociados al contenido.

Tipos:

- Caption de plataforma.
- Transcripcion.
- Metadata fallback.

### 8.5 `ai_insights`

Guarda analisis IA de una pieza.

Campos recomendados:

- `summary`.
- `strengths`.
- `weaknesses`.
- `topics`.
- `hooks`.
- `improvements`.
- `hook_type`.
- `hook_assessment`.
- `confidence`.
- `model`.

### 8.6 `sync_runs`

Guarda cada ejecucion del sync.

Sirve para saber:

- Cuando corrio.
- Que plataforma sincronizo.
- Si fallo.
- Cuantos items proceso.

### 8.7 `platform_connection_briefs`

Guarda el contexto estrategico de la cuenta.

El agente IA usa esto para no responder generico.

### 8.8 `spark_threads`

Guarda conversaciones del agente.

### 8.9 `spark_messages`

Guarda mensajes del usuario y de la IA.

### 8.10 `platform_daily_insights`

Guarda metricas diarias de cuenta.

Ejemplo:

- Views del dia.
- Reach del dia.
- Profile visits.
- Link clicks.
- Followers gained.
- Followers lost.

Nota importante:

En el proyecto analizado, esta tabla aparece usada y alterada, pero no se encontro su creacion en migraciones versionadas. Si replicas el sistema, crea esta tabla explicitamente.

## 9. Flujo completo de datos

### 9.1 Conexion de cuenta

Flujo:

1. Usuario hace click en conectar Instagram o TikTok.
2. El sistema genera un `state` firmado.
3. El usuario va a la pantalla OAuth de la plataforma.
4. La plataforma devuelve un `code`.
5. El sistema intercambia el `code` por tokens.
6. Los tokens se cifran.
7. Se guarda la conexion en `platform_connections`.

### 9.2 Sync de contenido

Flujo:

1. Usuario presiona sincronizar o corre un cron.
2. El sistema busca conexiones activas.
3. Refresca tokens si hace falta.
4. Llama APIs de Instagram/TikTok.
5. Normaliza los datos.
6. Guarda contenido en `content_items`.
7. Guarda metricas en `content_metric_snapshots`.
8. Guarda captions en `content_text_assets`.
9. Intenta transcribir videos.
10. Intenta analizar piezas con IA.
11. Guarda comentarios si estan disponibles.
12. Marca el sync como completado o fallido.

### 9.3 Dashboard

Flujo:

1. Usuario entra a `/dashboard`.
2. La UI llama `/api/dashboard/overview`.
3. La API lee datos desde Supabase.
4. Calcula metricas agregadas.
5. Devuelve JSON.
6. La UI renderiza cards y graficos.

### 9.4 Ask AI

Flujo:

1. Usuario escribe mensaje.
2. Si no hay chat, se crea un thread.
3. Se guarda mensaje del usuario.
4. Se construye contexto real.
5. Se arma prompt final.
6. Se llama al modelo IA.
7. Se guarda respuesta.
8. Se devuelve la conversacion actualizada.

## 10. Seguridad minima necesaria

Un Content OS maneja datos sensibles. Debe protegerse bien.

Medidas necesarias:

- Login obligatorio.
- Allowlist de usuario autorizado.
- Rutas API protegidas.
- Origin check en POST, PATCH y DELETE.
- Rate limit.
- Tokens OAuth cifrados.
- Service role solo en backend.
- RLS activado.
- Acceso publico revocado.
- Logs sin secretos.
- CRON protegido con secreto.
- Timeouts para llamadas IA.

## 11. Variables de entorno recomendadas

```env
APP_URL=
ALLOWED_USER_EMAIL=
ALLOWED_USER_ID=

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

CONNECTION_ENCRYPTION_SECRET=
CRON_SECRET=

INSTAGRAM_CLIENT_ID=
INSTAGRAM_CLIENT_SECRET=
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=

OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
CONTENT_ASSISTANT_ANTHROPIC_API_KEY=
CONTENT_ASSISTANT_CLAUDE_MODEL=anthropic/claude-sonnet-4.6

OPENROUTER_API_KEY_ANALYSIS=
OPENROUTER_ANALYSIS_MODEL=google/gemini-2.5-flash

OPENROUTER_API_KEY_TRANSCRIPTION=
OPENROUTER_TRANSCRIPTION_MODEL=google/gemini-2.5-flash-lite

UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=
LANGFUSE_BASE_URL=https://cloud.langfuse.com
LANGFUSE_ENABLED=false
```

Regla recomendada:

- Usar keys separadas por dominio.
- Una key para chatbot.
- Una key para analisis.
- Una key para transcripcion.
- Una key para competencia si existe.
- Evitar fallbacks cruzados si se quiere control de costos.

## 12. Guia paso a paso para crear el sistema

### Paso 1: Crear la app base

Prompt para IA:

```md
Actua como ingeniero full-stack senior.

Crea una app Next.js con App Router, React, TypeScript y Tailwind.

Rutas necesarias:
- /login
- /dashboard
- /content
- /content/[id]
- /calendar
- /audience
- /account
- /ask-ai

Crea un layout global con:
- Sidebar desktop.
- Bottom nav mobile.
- Header superior.
- Area principal con scroll.

No implementes logica de negocio todavia. Solo estructura visual y navegacion.
```

### Paso 2: Crear Supabase y autenticacion

Prompt para IA:

```md
Implementa Supabase Auth en esta app.

Requisitos:
- Login con email/password.
- Middleware o proxy que proteja rutas privadas.
- Allowlist por ALLOWED_USER_EMAIL o ALLOWED_USER_ID.
- /login debe ser publica.
- Todas las demas paginas deben requerir sesion.
- Crear logout.
- Usar cliente SSR de Supabase.
```

### Paso 3: Crear migraciones de base de datos

Prompt para IA:

```md
Crea migraciones Supabase para un Sistema Operativo de Contenido privado.

Tablas:
- platform_connections
- content_items
- content_metric_snapshots
- content_text_assets
- ai_insights
- embeddings opcional
- sync_runs
- platform_comments
- platform_daily_insights
- platform_connection_briefs
- spark_threads
- spark_messages

Requisitos:
- Usar uuid primary keys.
- Usar timestamps.
- Crear updated_at trigger.
- Crear indices por platform, connection_id y published_at.
- Crear unique constraints para evitar duplicados.
- Activar RLS.
- Revocar acceso a anon/authenticated.
- Documentar que el backend usara service role.
```

### Paso 4: Crear capa de repositorio

Prompt para IA:

```md
Crea una capa de repositorio para Supabase.

Archivos sugeridos:
- src/lib/supabase/admin.ts
- src/lib/supabase/server.ts
- src/lib/supabase/queries.ts
- src/lib/supabase/read-repository.ts
- src/lib/supabase/write-repository.ts
- src/lib/supabase/mappers.ts

El objetivo es que las paginas y APIs no escriban queries crudas repetidas.

Implementa funciones para:
- Listar conexiones.
- Crear/actualizar conexiones.
- Listar contenido.
- Obtener detalle de contenido.
- Guardar snapshots.
- Guardar text assets.
- Guardar insights.
- Crear threads.
- Crear messages.
```

### Paso 5: Crear seguridad de API

Prompt para IA:

```md
Crea una utilidad enforceApiRouteSecurity.

Debe:
- Validar sesion.
- Validar allowlist.
- Validar Origin en mutaciones.
- Aplicar rate limit si Upstash esta configurado.
- Permitir desactivar Origin en GET si se especifica.
- Devolver errores seguros.
- Loguear errores sin secretos.

Usa esta utilidad en todas las rutas API.
```

### Paso 6: Crear OAuth

Prompt para IA:

```md
Implementa OAuth para Instagram y TikTok.

Rutas:
- GET /api/oauth/[platform]/start
- GET /api/oauth/[platform]/callback

Requisitos:
- Generar state firmado con HMAC.
- Guardar state en cookie httpOnly secure.
- Validar expiracion del state.
- Comparar firma con timingSafeEqual.
- Usar PKCE para TikTok.
- Intercambiar code por tokens.
- Cifrar tokens antes de guardarlos.
- Guardar conexion en platform_connections.
- Manejar errores con mensajes seguros.
```

### Paso 7: Crear clientes de plataformas

Prompt para IA:

```md
Crea clientes para Instagram y TikTok.

Necesito funciones para:
- Refrescar token.
- Obtener perfil de cuenta.
- Obtener lista de contenido.
- Obtener metricas por contenido.
- Obtener comentarios si la plataforma lo permite.
- Obtener metricas diarias de cuenta si la plataforma lo permite.

Normaliza la salida para que la app no dependa directamente del formato externo.
```

### Paso 8: Crear sync

Prompt para IA:

```md
Crea un pipeline runFullSync.

Debe:
- Crear sync_run en estado running.
- Buscar conexiones activas.
- Refrescar tokens vencidos.
- Obtener contenido externo.
- Upsert content_items.
- Insertar content_metric_snapshots.
- Guardar captions en content_text_assets.
- Guardar comentarios.
- Guardar platform_daily_insights si existen.
- Intentar transcripcion sin bloquear el sync.
- Intentar analisis IA sin bloquear el sync.
- Marcar sync_run completed o failed.
- Registrar cantidad de items procesados y errores.
```

### Paso 9: Crear dashboard

Prompt para IA:

```md
Crea /api/dashboard/overview y /dashboard.

La API debe devolver:
- availableConnections
- selectedConnectionId
- performanceTotals
- performanceAvailability
- topContent
- recentComments
- chartData
- platformSplit
- audienceSummary si existe

La pagina debe mostrar:
- Cards de metricas.
- Grafico temporal.
- Split por plataforma.
- Tabla de contenido reciente.
- Filtros por plataforma, cuenta y rango.
- Boton sincronizar.
- Empty states utiles.
```

### Paso 10: Crear biblioteca

Prompt para IA:

```md
Crea /api/content y /content.

Filtros:
- platform
- connectionId
- q
- type
- sort
- limit
- offset

La UI debe mostrar:
- Grid responsive.
- Thumbnail.
- Plataforma.
- Fecha.
- Caption resumido.
- Views, likes, comments, shares, saves.
- Badge de analisis IA.
- Boton o link para ver detalle.
- Paginacion o Ver mas.
```

### Paso 11: Crear detalle

Prompt para IA:

```md
Crea /api/content/[id] y /content/[id].

La API debe devolver:
- item
- latestMetrics
- metricSnapshots
- textAssets
- aiInsight

La UI debe mostrar:
- Header.
- Link para volver.
- Preview.
- Caption.
- Metric cards.
- Analisis IA.
- Transcripcion.
- Link externo.
```

### Paso 12: Crear analisis IA de contenido

Prompt para IA:

```md
Crea un modulo de analisis IA para piezas de contenido.

Entrada:
- caption
- transcript
- metrics
- platform
- content type
- published_at

Salida JSON:
- summary
- strengths
- weaknesses
- topics
- hooks
- hook_type
- hook_assessment
- improvements
- confidence
- evidence_mode

Reglas:
- No inventar datos.
- Si no hay transcript, usar caption.
- Si no hay caption, usar metadata fallback.
- Guardar en ai_insights.
- Actualizar analysis_status en content_items.
```

### Paso 13: Crear transcripcion

Prompt para IA:

```md
Crea modulo de transcripcion para videos/reels.

Debe:
- Detectar si el contenido necesita transcripcion.
- Marcar transcription_status pending, processing, ready o failed.
- Llamar modelo/proveedor de transcripcion.
- Guardar transcript en content_text_assets.
- Guardar modelo usado.
- Guardar error si falla.
- No bloquear el sync completo.
```

### Paso 14: Crear agente IA

Prompt para IA:

```md
Crea un agente llamado content_assistant.

Ruta UI:
- /ask-ai

Endpoints:
- GET /api/agents/threads
- POST /api/agents/threads
- GET /api/agents/threads/[id]/messages
- POST /api/agents/threads/[id]/messages
- DELETE /api/agents/threads/[id]

Tablas:
- spark_threads
- spark_messages

El agente debe:
- Crear threads.
- Guardar mensajes.
- Construir contexto real.
- Llamar OpenRouter.
- Responder en Markdown.
- Usar ultimos 30 dias de contenido.
- Usar brief estrategico.
- Usar captions, transcripts e insights.
- No inventar metricas.
```

### Paso 15: Crear prompt del agente

Prompt base:

```md
Sos el Asistente de Contenido de un Sistema Operativo de Contenido.

Tu trabajo es ayudar al usuario a:
- Generar ideas.
- Crear guiones.
- Crear copy.
- Analizar metricas.
- Detectar patrones de contenido.
- Recomendar que publicar despues.

Reglas:
- Responde siempre en Markdown.
- Usa primero los datos reales del contexto.
- No inventes metricas.
- Si falta informacion, dilo claramente.
- Si el usuario pide ideas, usa los contenidos que mejor rindieron.
- Si el usuario pide guion, entrega texto listo para grabar.
- Si el usuario pide analisis, cita las metricas disponibles.

Comandos:
- /ideas: genera 5 angulos.
- /guion: genera un guion completo.
- /analisis: analiza rendimiento.
- /feedback: mejora una idea o guion.
```

### Paso 16: Crear calendario editorial

Prompt para IA:

```md
Crea /calendar.

Debe:
- Mostrar contenido publicado por fecha.
- Permitir crear borradores.
- Permitir agendar contenido.
- Usar Supabase Storage para archivos si se implementa upload.
- Guardar status draft o scheduled.
- En desktop mostrar mes.
- En mobile mostrar agenda.
- No simular publicacion real sin aclararlo.
```

### Paso 17: Crear pagina de cuenta y brief

Prompt para IA:

```md
Crea /account.

Debe mostrar:
- Conexiones activas.
- Boton conectar Instagram.
- Boton conectar TikTok.
- Boton desconectar.
- Estado active, disconnected o error.
- Formulario de brief por conexion.

El brief debe guardarse en platform_connection_briefs.

El agente debe recibir el brief en su contexto.
```

### Paso 18: Crear responsive y accesibilidad

Prompt para IA:

```md
Audita responsive y accesibilidad.

Requisitos:
- Bottom nav no debe tapar contenido.
- Main debe tener padding bottom en mobile.
- Tablas deben tener overflow-x o version card mobile.
- Calendario mobile debe ser agenda, no grid comprimida.
- Botones icon-only deben tener aria-label.
- Evitar alert() nativo, usar feedback inline o toast.
- Evitar main anidados.
- Mantener contraste suficiente.
```

### Paso 19: Crear tests

Prompt para IA:

```md
Agrega tests para este Content OS.

Prioridad:
- Calculo de metricas.
- Normalizacion de datos externos.
- Mappers Supabase.
- Seguridad de rutas API.
- Construccion de contexto del agente.
- Analisis de contenido.
- Sync idempotente.
- OAuth state firmado.
```

### Paso 20: Preparar produccion

Prompt para IA:

```md
Prepara la app para produccion.

Checklist:
- Verificar variables de entorno.
- Verificar OAuth redirect URLs.
- Verificar RLS y revokes.
- Verificar service role solo en servidor.
- Agregar rate limit obligatorio en produccion.
- Agregar timeouts a llamadas externas.
- Agregar logs seguros.
- Agregar CRON_SECRET.
- Probar build.
- Probar typecheck.
- Probar lint.
- Probar sync manual.
- Probar chat con contexto real.
```

## 13. Prompt maestro para darle a OpenCode, Codex o Claude Code

```md
Actua como arquitecto senior full-stack y constructor de producto.

Quiero crear un Sistema Operativo de Contenido similar a ContentOS.

Objetivo:
Centralizar contenido publicado, metricas, analisis IA, transcripciones, calendario editorial y un agente IA que genere ideas y guiones usando datos reales.

Stack deseado:
- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Supabase Postgres
- Supabase Auth
- OpenRouter para IA
- Instagram Graph API
- TikTok API
- Upstash Redis opcional
- Langfuse opcional

Rutas web:
- /login
- /dashboard
- /content
- /content/[id]
- /calendar
- /audience
- /account
- /ask-ai

Rutas API:
- /api/dashboard/overview
- /api/content
- /api/content/[id]
- /api/sync/run
- /api/sync/cron
- /api/oauth/[platform]/start
- /api/oauth/[platform]/callback
- /api/agents/threads
- /api/agents/threads/[id]
- /api/agents/threads/[id]/messages
- /api/account/connections/[id]/brief
- /api/account/connections/[id]/disconnect

Tablas:
- platform_connections
- content_items
- content_metric_snapshots
- content_text_assets
- ai_insights
- sync_runs
- platform_comments
- platform_daily_insights
- platform_connection_briefs
- spark_threads
- spark_messages

Arquitectura:
- Backend-first.
- Frontend no accede directo a tablas sensibles.
- Service role solo en servidor.
- RLS activado y acceso publico cerrado.
- Auth con Supabase.
- Allowlist por usuario.
- Tokens OAuth cifrados.
- Rutas API protegidas.
- Agente IA con contexto real.

Construye por fases:
1. Estructura base y navegacion.
2. Auth privada.
3. Migraciones Supabase.
4. Repositorios y mappers.
5. Seguridad API.
6. OAuth.
7. Sync.
8. Dashboard.
9. Biblioteca.
10. Detalle de contenido.
11. Analisis IA.
12. Transcripcion.
13. Ask AI.
14. Calendario.
15. Responsive.
16. Tests.
17. Produccion.

Antes de escribir codigo:
- Lee la estructura existente si hay repo.
- Identifica patrones.
- Haz un plan breve.
- Implementa con cambios pequenos.
- Verifica con typecheck, lint y tests.

No inventes integraciones. Si una API real no esta implementada, deja claro que es placeholder o modulo pendiente.
```

## 14. Prompt para revisar un Content OS existente

```md
Analiza este proyecto completo en modo code review.

Quiero que identifiques:
- Arquitectura general.
- Rutas web.
- Rutas API.
- Modelo de datos.
- Seguridad.
- Flujo OAuth.
- Flujo sync.
- Flujo dashboard.
- Flujo biblioteca.
- Flujo agente IA.
- Partes reales vs simuladas.
- Riesgos de produccion.
- Riesgos de seguridad.
- Huecos para multiusuario.
- Mejoras prioritarias.

Devuelve:
1. Hallazgos criticos con archivo y linea.
2. Explicacion del sistema para no programadores.
3. Guia paso a paso para replicarlo.
4. Prompts para que otra IA lo implemente.
5. Checklist de produccion.
```

## 15. Riesgos detectados en el proyecto analizado

Estos riesgos deben corregirse o tenerse en cuenta al replicar.

### 15.1 `platform_daily_insights` referenciada pero no creada

La tabla aparece usada y alterada, pero no se encontro su `create table` en migraciones.

Impacto:

- Puede romper instalaciones nuevas.
- Puede afectar dashboard.
- Puede afectar contexto del agente.

Recomendacion:

- Crear migracion formal para `platform_daily_insights`.

### 15.2 Calendario simulado

La ruta de publicacion del calendario simula procesamiento.

Impacto:

- El usuario puede creer que agenda/publica cuando no lo hace.

Recomendacion:

- Mostrarlo como borrador/calendario editorial hasta implementar publicacion real.

### 15.3 Contexto del agente incompleto

El prompt menciona `dailyMetrics`, pero en el Content Assistant se manda vacio.

Impacto:

- El agente puede no responder bien preguntas diarias.

Recomendacion:

- Inyectar `dailyMetrics` reales o quitar esa instruccion.

### 15.4 Metadata del agente demasiado grande

Se guarda contexto completo en cada mensaje assistant.

Impacto:

- Crecimiento de storage.
- Datos sensibles duplicados.

Recomendacion:

- Guardar solo version, IDs usados y resumen.

### 15.5 Guardado no transaccional del chat

Si falla el proveedor IA despues de guardar el mensaje del usuario, queda mensaje sin respuesta.

Recomendacion:

- Crear assistant message pending y luego actualizarlo.
- O usar transaccion/RPC.
- O detectar ultimo user sin respuesta.

### 15.6 Sin timeout en llamadas IA

Impacto:

- Requests colgados.
- Mala UX.

Recomendacion:

- Usar `AbortController`.
- Definir timeout por proveedor.

### 15.7 OAuth state sin comparacion timing-safe

Impacto:

- Riesgo teorico en validacion HMAC.

Recomendacion:

- Usar `timingSafeEqual`.
- Validar expiracion dentro del payload firmado.

### 15.8 Responsive mejorable

Impacto:

- Bottom nav puede tapar contenido.
- Tablas o grids pueden romper mobile.

Recomendacion:

- Agregar padding bottom mobile.
- Crear versiones mobile de tablas y calendario.

### 15.9 No es SaaS multiusuario todavia

Impacto:

- No se puede vender a multiples clientes sin cambios importantes.

Recomendacion:

- Agregar `workspace_id` o `user_id`.
- Crear policies RLS reales.
- Filtrar todas las queries por tenant.

## 16. Como convertirlo en SaaS multiusuario

El proyecto actual es privado. Para SaaS, hay que cambiar arquitectura de datos.

Agregar tablas:

- `workspaces`
- `workspace_members`
- `subscriptions`

Agregar columnas:

- `workspace_id` en `platform_connections`.
- `workspace_id` en `content_items`.
- `workspace_id` en `spark_threads`.
- `workspace_id` en `automation_runs` si existen.

Cambiar seguridad:

- RLS por workspace.
- Policies que permitan solo miembros.
- Service role solo para tareas internas.
- Todas las APIs deben resolver workspace actual.

Prompt:

```md
Convierte este Content OS privado en SaaS multiusuario.

Requisitos:
- Crear workspaces.
- Crear workspace_members.
- Agregar workspace_id a tablas principales.
- Migrar datos existentes a un workspace default.
- Crear RLS policies por workspace.
- Filtrar todas las queries por workspace_id.
- Actualizar UI para selector de workspace.
- Asegurar que un usuario no pueda ver datos de otro workspace.
```

## 17. Checklist de MVP

MVP minimo funcional:

- Login.
- Una cuenta Instagram conectada.
- Sync manual.
- Content library.
- Dashboard basico.
- Detalle de contenido.
- Analisis IA basico.
- Ask AI con brief y ultimos contenidos.

No es necesario para MVP:

- TikTok.
- Competencia.
- Automatizaciones.
- Publicacion real.
- Multiusuario.
- Billing.

## 18. Checklist de produccion

Antes de usar en serio:

- `next build` pasa.
- `typecheck` pasa.
- `lint` pasa.
- Migraciones aplicadas.
- `platform_daily_insights` existe si se usa.
- OAuth probado.
- Sync probado.
- Tokens cifrados.
- RLS activado.
- Acceso anon/authenticated revocado si backend-first.
- Rate limit activo.
- Origin checks activos.
- CRON_SECRET configurado.
- Backups Supabase activos.
- Logs no filtran tokens.
- IA tiene timeout.
- Agente no inventa datos.
- Calendario no promete publicacion si no existe.
- Mobile probado.

## 19. Orden recomendado para pedirle trabajo a una IA

No pidas todo de una vez. Pedilo por fases.

Orden ideal:

1. Crear estructura base.
2. Crear auth.
3. Crear base de datos.
4. Crear repositorios.
5. Crear dashboard dummy con datos mock.
6. Crear OAuth.
7. Crear sync real.
8. Conectar dashboard a datos reales.
9. Crear biblioteca.
10. Crear detalle.
11. Crear IA de analisis.
12. Crear Ask AI.
13. Crear calendario.
14. Pulir UI.
15. Tests.
16. Produccion.

## 20. Prompt corto para empezar desde cero

```md
Quiero construir un Content OS privado.

Primero crea solo la estructura base con Next.js, TypeScript y Tailwind.

Rutas:
- /login
- /dashboard
- /content
- /content/[id]
- /calendar
- /audience
- /account
- /ask-ai

Layout:
- Sidebar desktop.
- Bottom nav mobile.
- Header.
- Estilo dark profesional.

No implementes Supabase todavia. Solo estructura, navegacion y placeholders bien diseñados.
```

## 21. Prompt corto para continuar con Supabase

```md
Ahora implementa Supabase Auth y el modelo de datos inicial.

Necesito:
- Login con email/password.
- Middleware que proteja rutas.
- Allowlist por ALLOWED_USER_EMAIL.
- Migraciones para conexiones, contenido, metricas, textos, insights, sync runs y chat.
- Repositorios basicos de lectura/escritura.

Mantener arquitectura backend-first.
```

## 22. Prompt corto para crear el agente

```md
Ahora crea el agente /ask-ai.

Debe:
- Crear threads.
- Guardar mensajes.
- Construir contexto con brief y ultimos 30 dias de contenido.
- Llamar OpenRouter.
- Responder en Markdown.
- No inventar metricas.
- Usar comandos /ideas, /guion, /analisis y /feedback.
```

## 23. Definicion final del producto

Un Content OS bien construido debe responder estas preguntas:

- Que publique.
- Cuando lo publique.
- Donde lo publique.
- Como rindio.
- Por que pudo haber rendido asi.
- Que patrones se repiten.
- Que deberia publicar despues.
- Que guion puedo grabar hoy.
- Que contenido conviene mejorar.
- Que cuenta necesita atencion.

Si el sistema responde eso con datos reales, no es solo una app. Es una capa operativa para crear mejor contenido.
