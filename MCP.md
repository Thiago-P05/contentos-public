# ContentOS MCP

El servidor MCP remoto se publica en `https://<tu-dominio>/mcp`. Es privado y de solo lectura: expone briefs, metricas, analisis y transcripciones para agentes autorizados, pero nunca payloads crudos, media privada ni credenciales de las redes sociales.

## Configuracion

1. Configura `APP_URL` y `MCP_SERVER_URL` con URLs HTTPS. `MCP_SERVER_URL` debe ser la URL exacta del endpoint, por ejemplo `https://app.example.com/mcp`.
2. En Supabase, habilita **Authentication > OAuth Server** y configura el authorization path como `/oauth/consent`.
3. Usa el endpoint de autorizacion de Supabase como authorization server: `https://<project-ref>.supabase.co/auth/v1`.
4. Configura una Custom Access Token Hook para los tokens OAuth. Debe conservar los claims existentes y cambiar `aud` a la URL exacta de `MCP_SERVER_URL` cuando la solicitud tenga `client_id`. El MCP rechaza cualquier token cuya audiencia no coincida.
5. Registra primero los clientes OAuth que vayas a usar, con sus redirect URIs exactas. Dynamic Client Registration solo debe activarse cuando necesites conectar clientes desconocidos.

El recurso protegido se anuncia en `/.well-known/oauth-protected-resource/mcp`. Los clientes MCP usan ese documento para descubrir Supabase OAuth y completar PKCE.

## Tools

- `list_connections`
- `get_business_brief`
- `search_content`
- `get_content_detail`
- `get_content_transcript`
- `get_content_thumbnail`
- `get_performance_overview`
- `get_script_context`

Todos son read-only. `get_content_transcript` pagina el texto y `get_script_context` limita las referencias y extractos para proteger el contexto del agente.

## Seguridad

- Solo puede autorizar el usuario configurado en `ALLOWED_USER_ID` o `ALLOWED_USER_EMAIL`.
- Se valida firma, emisor, vencimiento, `client_id` y audiencia del JWT de Supabase.
- Cada uso se registra en `mcp_audit_events` sin almacenar prompts ni transcripciones.
- Supabase usa los scopes estándar `openid`, `profile` y `email` para identificar al usuario. El control efectivo del acceso a contenido es el contrato read-only del servidor y la validacion de bearer token.
- La version actual sigue siendo monousuario. No conectar cuentas de terceros hasta migrar el modelo de datos a ownership por workspace y RLS por usuario.

Revoca accesos desde **Authentication > OAuth Apps** en Supabase.
