# Plan 012: Tests de caracterización para las rutas críticas sin cobertura (auth proxy + OAuth callback)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 7ae93d2..HEAD -- src/proxy.ts "src/app/api/oauth/[platform]/callback/route.ts"`
> Ante un mismatch con los excerpts, STOP.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED (los tests no cambian comportamiento, pero montar el harness de NextRequest puede requerir iteración)
- **Depends on**: plans/001 (suite verde), idealmente plans/003 (CI que los corra)
- **Category**: tests
- **Planned at**: commit `7ae93d2`, 2026-06-11

## Why this matters

Los 23 archivos de test del repo viven todos en `src/lib/**` (lógica pura). Las dos superficies de mayor riesgo de seguridad tienen CERO tests: el **auth gate** (`src/proxy.ts` — decide quién entra a la app entera) y el **OAuth callback** (valida state firmado y PKCE, y persiste credenciales). Una regresión en cualquiera de los dos es catastrófica y hoy solo se detectaría en producción. Estos son tests de caracterización: fijan el comportamiento actual (que es correcto) contra regresiones futuras.

Nota de alcance: la auditoría también señaló `src/lib/sync/run-full-sync.ts` sin tests. Queda deliberadamente FUERA de este plan — los planes 004 y 008 lo modifican y agregan tests de sus helpers; testear la orquestación completa requiere mockear media docena de módulos y se decidirá cuando esos planes hayan landado.

## Current state

### `src/proxy.ts` (95 líneas — middleware de auth de Next 16)

Comportamiento a caracterizar (excerpt de las ramas, líneas 30–90):

```ts
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  // 1. Assets pasan directo:
  if (pathname.startsWith("/_next") || pathname === "/favicon.ico" || PUBLIC_FILE_PATTERN.test(pathname)) return NextResponse.next();
  // 2. Sin config de Supabase: /login y /auth/callback pasan; APIs → 503; resto → redirect /login?error=setup
  // 3. Con config: supabase.auth.getUser(); isAllowedSupabaseUser checa ALLOWED_USER_ID o ALLOWED_USER_EMAIL
  // 4. Usuario autenticado pero NO permitido → signOut() + (en páginas) redirect /login?error=unauthorized
  // 5. No autenticado: APIs → 401 JSON; páginas → redirect /login?next=<path normalizado>
  // 6. Autenticado y permitido → pasa
}
```

Dependencia a mockear: `createProxySupabaseClient` de `@/lib/supabase/server` (devuelve un client con `auth.getUser()` y `auth.signOut()`). Env vars que lee: `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ALLOWED_USER_ID`, `ALLOWED_USER_EMAIL` — directo de `process.env` (manipulables en el test con `vi.stubEnv`).

### `src/app/api/oauth/[platform]/callback/route.ts` (120 líneas)

Ramas a caracterizar (verificadas, líneas 35–120):

- plataforma inválida o no configurada → redirect `/account?error=oauth` (líneas 46–52)
- `?error=` del provider → redirect error + expira cookies de state y PKCE (63–69)
- `code`/`state` faltante o `state !== cookieState` → redirect error + expira cookies (71–77)
- TikTok sin cookie PKCE → redirect error (79–85)
- state firmado inválido o de otra plataforma (`verifySignedPayload`) → redirect error (87–95)
- happy path → `exchangeOAuthCode` + `upsertPlatformConnection` + redirect `/account?connected=<platform>` + expira cookies (97–107)
- excepción en exchange → redirect error (108–115)

Dependencias a mockear: `exchangeOAuthCode`, `isOAuthConfiguredForPlatform` (de `@/lib/oauth`), `upsertPlatformConnection` (de `@/lib/supabase/repository`), `enforceApiRouteSecurity` (de `@/lib/request-security` — mockearlo como no-op resuelto). `verifySignedPayload` (de `@/lib/secure`) puede usarse REAL firmando un state de prueba con un `AUTH_SECRET` de test — eso da cobertura real a la verificación de firma (mirar `src/lib/secure.ts` y su test existente `src/lib/secure.test.ts` para las funciones de firma).

### Convenciones de test del repo

- Vitest, `environment: "node"` (de `vitest.config.ts`), alias `@` → `src`.
- Patrón de mocking a seguir: revisar `src/lib/supabase/queries.test.ts` y `src/lib/clients/instagram.test.ts` (cómo mockean módulos con `vi.mock`).
- `NextRequest` se construye en node: `new NextRequest("http://localhost:3000/dashboard", { headers: { cookie: "..." } })` (import de `next/server`).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests nuevos | `npx vitest run src/proxy.test.ts "src/app/api/oauth/[platform]/callback/route.test.ts"` | all pass |
| Suite completa | `pnpm test` | exit 0 |
| Typecheck | `pnpm typecheck` | exit 0 |

## Scope

**In scope** (solo creación de tests):
- `src/proxy.test.ts` (crear)
- `src/app/api/oauth/[platform]/callback/route.test.ts` (crear)

**Out of scope** (NO tocar):
- `src/proxy.ts` y el route del callback — si un test revela un BUG real, NO arreglarlo: STOP y reportar (los fixes de auth se revisan a mano).
- `src/lib/sync/run-full-sync.ts` — ver nota de alcance arriba.
- `vitest.config.ts` — solo modificarlo si NextRequest exige un ajuste de environment (documentarlo en el reporte).

## Git workflow

- Branch: `advisor/012-critical-path-tests`
- Commit style: `test: caracterizar auth proxy y oauth callback`
- NO pushear salvo instrucción del operador.

## Steps

### Step 1: Tests del proxy — casos de no-auth

Crear `src/proxy.test.ts`. Mockear `@/lib/supabase/server` con `vi.mock`. Con `vi.stubEnv` setear config de Supabase presente. Casos:

1. asset (`/_next/static/x.js`, `/favicon.ico`, `/logo.png`) → `NextResponse.next()` (status 200, sin redirect)
2. sin env de Supabase (stubEnv vacías): página → redirect a `/login?error=setup`; `/api/x` → 503; `/login` → pasa
3. no autenticado (`getUser` → `{ data: { user: null }, error: null }`): `/dashboard` → redirect con `next=/dashboard`; `/api/x` → 401

**Verify**: `npx vitest run src/proxy.test.ts` → los casos de arriba en verde.

### Step 2: Tests del proxy — autorización

4. usuario permitido por `ALLOWED_USER_EMAIL` (case-insensitive, con trim) → pasa
5. usuario permitido por `ALLOWED_USER_ID` → pasa
6. usuario autenticado NO permitido → se llama `signOut()` y redirect a `/login?error=unauthorized`
7. usuario en `/login` ya autenticado → redirect a `/`

**Verify**: `npx vitest run src/proxy.test.ts` → all pass.

### Step 3: Tests del OAuth callback

Crear `src/app/api/oauth/[platform]/callback/route.test.ts`. Mockear `@/lib/oauth` (`exchangeOAuthCode`, `isOAuthConfiguredForPlatform` → true), `@/lib/supabase/repository`, `@/lib/request-security`. Usar `verifySignedPayload`/firma real de `@/lib/secure` con `AUTH_SECRET` stubbed para fabricar states válidos e inválidos. Casos (cada uno assertea el `Location` del redirect y, donde aplique, que las cookies de state/PKCE se expiran):

1. state de query ≠ state de cookie → `/account?error=oauth`
2. state bien copiado pero firma inválida → error
3. state firmado para OTRA plataforma → error
4. `?error=access_denied` del provider → error + cookies expiradas
5. TikTok sin cookie PKCE → error
6. happy path Instagram → `exchangeOAuthCode` llamado con el code, `upsertPlatformConnection` llamado, redirect `/account?connected=instagram`
7. `exchangeOAuthCode` lanza → error + `upsertPlatformConnection` NO llamado

**Verify**: `npx vitest run "src/app/api/oauth/[platform]/callback/route.test.ts"` → all pass.

### Step 4: Suite completa

**Verify**: `pnpm test` → exit 0; `pnpm typecheck` → exit 0.

## Test plan

Este plan ES el test plan (ver Steps 1–3: 14 casos en total, mínimo).

## Done criteria

- [ ] `src/proxy.test.ts` con ≥7 casos en verde
- [ ] test del callback con ≥7 casos en verde
- [ ] `pnpm test` exit 0 (suite completa)
- [ ] Ningún archivo de `src/` fuera de los 2 tests nuevos modificado (`git status`)
- [ ] Fila actualizada en `plans/README.md`

## STOP conditions

- Un test revela comportamiento distinto al descripto en "Current state" — puede ser un BUG real de auth: STOP, reportar el caso exacto, no "arreglar" ni el código ni el test para que pase.
- `NextRequest`/`NextResponse` no funcionan bajo vitest node env tras 2 intentos razonables de configuración (reportar el error; puede requerir `@edge-runtime/vm` o ajuste de environment — decisión del operador).
- Los módulos a mockear tienen una estructura distinta a la descripta (drift en imports).

## Maintenance notes

- Estos tests fijan el contrato de seguridad: cualquier PR futuro que los rompa merece sospecha máxima, no un update casual del test.
- Follow-up deferido: tests de orquestación de `run-full-sync.ts` (tras planes 004/008) y e2e con Playwright (hoy no hay infra e2e).
- Revisor: verificar que el happy path del callback assertea la EXPIRACIÓN de las cookies de state/PKCE (es parte del contrato anti-replay).
