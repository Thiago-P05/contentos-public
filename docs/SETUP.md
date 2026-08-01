# Setup guide

Complete walkthrough from an empty clone to a working deployment with connected
accounts.

**Written for both humans and AI agents.** Every step states the exact value to
use, and every phase ends with a verification you can actually run. If a
verification fails, stop there — later steps assume it passed.

## Read this first

Three things decide whether this project is worth your time:

1. **It is single-user.** One deployment serves one person. There is no
   multi-tenancy and no data isolation between users.
2. **Platform approval is the long pole.** Meta, TikTok and Google each run their
   own review before giving you production access. This can take days to weeks
   and none of it is under this project's control. Everything else here takes
   about an hour.
3. **The AI features cost money per item.** Read
   [A note on AI cost](../README.md#a-note-on-ai-cost) before your first sync.

### For AI agents

You can do phases 1, 2, 3 and 7 unattended. You **cannot** complete phases 4–6:
creating developer apps requires a human in a browser, accepting legal terms, and
in most cases submitting an app review. Do the parts you can, then hand the user
a precise list of values you need back.

Never invent a credential. Never commit `.env.local`. If a platform's console
does not match what is written here, trust the console and tell the user the docs
have drifted — these vendors redesign their dashboards frequently.

## What you need before starting

| Thing | Required | Notes |
|---|---|---|
| Node.js 24+ and pnpm 11 | Yes | `.nvmrc` pins the major version |
| A Supabase project | Yes | Free tier is fine to start |
| An OpenRouter API key | For AI features | Metrics sync without it |
| An Instagram **professional** account | For Instagram | Business or Creator, not personal |
| A TikTok developer app | For TikTok | Requires review |
| A Google Cloud project | For YouTube | Requires verification for these scopes |
| A domain with HTTPS | For production | OAuth callbacks must be HTTPS |

---

## Phase 1 — Local install

```bash
corepack enable
pnpm install --frozen-lockfile
```

**Verify:**

```bash
pnpm typecheck
```

Silence means success. If this fails, stop — nothing downstream will work.

---

## Phase 2 — Supabase

### 2.1 Create the project

Go to [supabase.com/dashboard](https://supabase.com/dashboard) and create a
project. Choose a region close to you; everything else can stay default.

Wait until provisioning finishes before continuing.

### 2.2 Run the migrations

Open **SQL Editor → New query**, paste the entire contents of
`supabase/run_all_migrations.sql`, and run it.

That single file contains all 21 migrations in order: 17 tables, indexes,
extensions (`pgcrypto`, `vector`, `pg_trgm`) and — critically — the row-level
security lockdown. [DATABASE.md](DATABASE.md) explains what each table is for.

> **Fresh projects only.** The history is not purely additive:
> `20260409_remove_youtube_support.sql` deletes every row where
> `platform = 'youtube'` (YouTube was dropped in April and added back in July).
> On an empty database that does nothing. **On a populated database it destroys
> your YouTube data.** To upgrade an existing database, apply only the individual
> files from `supabase/migrations/` that you have not run yet.

> **Do not cherry-pick migrations.** The file
> `supabase/migrations/20260504_lock_down_public_access.sql` is what enables RLS
> and revokes access from the `anon` and `authenticated` roles. Your
> `NEXT_PUBLIC_SUPABASE_ANON_KEY` ships to every browser that loads the app. If
> you skip that migration, anyone who opens devtools can read your entire
> database.

**Verify:** run this in the SQL Editor.

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
```

Every row must show `rowsecurity = true`. If any says `false`, re-run the
migration file.

### 2.3 Turn off public signup

**Authentication → Sign In / Providers → Email**, and disable **Enable sign ups**.

This app is for one person. Leaving signup open means strangers can create
accounts against your project — the allowlist blocks them from the UI, but they
still exist in your auth table.

### 2.4 Create your user

**Authentication → Users → Add user**. Use email + password, and tick
"Auto Confirm User" so you don't need to wire up email delivery.

Copy the resulting **User UID**. You need it in the next phase.

### 2.5 Collect your keys

**Project Settings → API**:

| Value in Supabase | Environment variable |
|---|---|
| Project URL | `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` `public` key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` `secret` key | `SUPABASE_SERVICE_ROLE_KEY` |

> The `service_role` key **bypasses RLS entirely**. It belongs in server-side
> environment variables only. Never prefix it with `NEXT_PUBLIC_`, never paste it
> into an issue, never send it to a browser.

---

## Phase 3 — Environment and first boot

```bash
cp .env.example .env.local
```

Fill in the minimum:

```bash
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>

AUTH_SECRET=<random 32+ chars>
CONNECTION_ENCRYPTION_SECRET=<random 32+ chars, minimum 16>

ALLOWED_USER_EMAIL=you@example.com
ALLOWED_USER_ID=<the User UID from 2.4>

APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=Your Name
```

Generate the secrets:

```bash
openssl rand -base64 32    # run twice, once per secret
```

> `CONNECTION_ENCRYPTION_SECRET` encrypts your platform OAuth tokens at rest.
> **Changing it later makes every stored token unreadable** and you will have to
> reconnect all accounts. Set it once and back it up.

> **`NEXT_PUBLIC_*` variables are read at build time, not at runtime.** Next.js
> inlines them into the client bundle, so `NEXT_PUBLIC_APP_NAME` and
> `NEXT_PUBLIC_DEFAULT_CONNECTION_USERNAME` must be set *before* `pnpm build` —
> exporting them only for `pnpm start` changes nothing, and you will see the
> default "Acme" instead of your name. Rebuild after changing either. On Vercel
> this is automatic, since it builds after your environment is configured.

`src/lib/env.ts` is the authoritative schema for everything else. Almost all of
it is optional, and features degrade gracefully when their keys are absent.

**Verify:**

```bash
pnpm dev
```

Open `http://localhost:3000`. You should be redirected to `/login`. Sign in with
the user from 2.4. You should land on an empty dashboard — no accounts connected
yet, which is correct.

If you are redirected back to `/login` after a correct password, your
`ALLOWED_USER_ID` does not match the Supabase user. Check for a stray space.

---

## Phase 4 — Instagram

The most involved of the three. Read the whole phase before starting.

### What this app actually uses

ContentOS uses **Instagram API with Instagram Login** — the direct Instagram
flow. It does **not** use Facebook Login.

This distinction is the single most common reason setup fails. Concretely, from
`src/lib/oauth.ts`:

| | Value |
|---|---|
| Authorization URL | `https://www.instagram.com/oauth/authorize` |
| Token exchange | `https://api.instagram.com/oauth/access_token` |
| Long-lived token | `https://graph.instagram.com/access_token` |
| Refresh | `https://graph.instagram.com/refresh_access_token` |
| Scopes | `instagram_business_basic`, `instagram_business_manage_insights` |

So you need the **Instagram App ID**, not the Facebook App ID. They are different
numbers, both visible in the same dashboard, and using the wrong one produces an
unhelpful error.

### 4.1 Prepare the Instagram account

The account you connect must be **professional** (Business or Creator). A
personal account cannot grant these scopes.

In the Instagram mobile app: **Settings → Account type and tools → Switch to
professional account**.

### 4.2 Create the Meta app

1. Go to [developers.facebook.com/apps](https://developers.facebook.com/apps) and
   create an app.
2. When asked what you want to do, choose the option for **Instagram** /
   accessing Instagram API data.
3. In the app, add the **Instagram** product.
4. Open **Instagram → API setup with Instagram login**.

> Meta reorganises this dashboard often. What you are looking for is the section
> that gives you an **Instagram App ID** and **Instagram App Secret**, plus a
> field for OAuth redirect URIs. If the wording differs, follow the meaning.

### 4.3 Configure the redirect URI

In the Instagram login settings, add the callback exactly:

```
http://localhost:3000/api/oauth/instagram/callback     # local development
https://<your-domain>/api/oauth/instagram/callback     # production
```

The path is `/api/oauth/instagram/callback` — built by `getOAuthCallbackUrl()`
from your `APP_URL`. It must match character for character, including protocol
and any trailing path. No trailing slash.

### 4.4 Add the credentials

```bash
INSTAGRAM_CLIENT_ID=<Instagram App ID>
INSTAGRAM_CLIENT_SECRET=<Instagram App Secret>
```

Leave `INSTAGRAM_ACCESS_TOKEN` and `INSTAGRAM_USER_ID` empty — those exist only
for a legacy single-account path and are not used by the OAuth flow.

### 4.5 Add yourself as a tester

While your app is in development mode, only roles you explicitly add can
authorise it. Add your Instagram account under the app's roles/testers section,
then **accept the invitation from the Instagram account itself** (in Instagram:
Settings → Apps and websites → Tester invites). It is easy to miss this second
half.

### 4.6 Connect

Restart `pnpm dev`, go to `/account`, and connect Instagram.

**Verify:** the account appears in `/account` with a username, and:

```bash
pnpm sync:dashboard
```

completes without an auth error.

### Instagram troubleshooting

| Symptom | Cause |
|---|---|
| "Invalid platform app" | You used the Facebook App ID instead of the Instagram App ID |
| "redirect_uri does not match" | Mismatch with 4.3 — check protocol, port, trailing slash |
| Consent screen loads, callback fails | Tester invitation not accepted (4.5) |
| Connects, but no insights | Account is personal, not professional (4.1) |
| Audience insights return 400 | See note below |

> **Audience insights host.** `INSTAGRAM_API_BASE_URL` defaults to
> `https://graph.facebook.com`, and `src/lib/instagram-audience.ts` uses it
> directly. Tokens issued by Instagram Login are generally served by
> `graph.instagram.com`. If audience data fails while regular content sync works,
> set `INSTAGRAM_API_BASE_URL=https://graph.instagram.com` and retry. This is a
> known rough edge in the current code, not something you configured wrong.

---

## Phase 5 — TikTok

### What this app actually uses

From `src/lib/oauth.ts` and `src/lib/tiktok-webhook.ts`:

| | Value |
|---|---|
| Authorization URL | `https://www.tiktok.com/v2/auth/authorize/` |
| Token exchange and refresh | `https://open.tiktokapis.com/v2/oauth/token/` |
| Revoke | `https://open.tiktokapis.com/v2/oauth/revoke/` |
| Profile | `https://open.tiktokapis.com/v2/user/info/` |
| Scopes | `user.info.basic`, `user.info.profile`, `user.info.stats`, `video.list` |
| PKCE | Required, `S256` |
| Account identity | `open_id` |

Two naming traps: TikTok uses **`client_key`**, not `client_id` — and so does
this app's environment variable. And unlike Instagram and Google, TikTok
**refresh tokens expire** (the app stores `refresh_expires_in`). A connection
left untouched past that window has to be reconnected by hand.

### 5.1 Create the app

Register at [developers.tiktok.com](https://developers.tiktok.com), create an
app, and add **Login Kit**.

Request all four scopes. They are not interchangeable, and the profile call this
app makes asks for fields covered by three of them:

| Scope | Grants | Needed for |
|---|---|---|
| `user.info.basic` | `open_id`, `display_name`, `avatar_url` | Identifying the account at all |
| `user.info.profile` | `username`, `bio_description`, `is_verified` | The username shown in the UI |
| `user.info.stats` | `follower_count`, `likes_count`, `video_count` | Audience metrics |
| `video.list` | The video catalogue | Everything in the content library |

If a scope is missing, the connection either fails outright or lands with no
content. `video.list` is the one that usually triggers manual review — budget for
it.

### 5.2 Redirect URI

```
https://<your-domain>/api/oauth/tiktok/callback
```

TikTok is stricter than Meta about HTTPS and generally will not accept a plain
`http://localhost` callback. For local development use `pnpm dev:https` plus a
tunnel (ngrok, Cloudflare Tunnel) and register the tunnel URL, remembering to set
`APP_URL` to match.

### 5.3 Credentials

```bash
TIKTOK_CLIENT_KEY=<client key>
TIKTOK_CLIENT_SECRET=<client secret>
```

### 5.4 Webhook (optional but recommended)

This app exposes `POST /api/webhooks/tiktok`. It handles the
`authorization.removed` event: when a user revokes access from TikTok's side, the
matching connection is disconnected automatically instead of failing silently on
the next sync.

Register the webhook URL in your TikTok app settings:

```
https://<your-domain>/api/webhooks/tiktok
```

It needs no extra secret. Signatures arrive in the `TikTok-Signature` header and
are verified as HMAC-SHA256 over `{timestamp}.{rawBody}`, keyed with your
**`TIKTOK_CLIENT_SECRET`**. Requests older than five minutes are rejected, so the
server clock has to be roughly correct.

### 5.5 Connect

Restart the dev server, go to `/account`, connect TikTok.

**Verify:** the account appears with a username, then

```bash
pnpm sync:dashboard
```

returns videos. An account that connects but shows zero videos almost always
means `video.list` was not approved.

### TikTok troubleshooting

| Symptom | Cause |
|---|---|
| `invalid_client` at token exchange | `TIKTOK_CLIENT_KEY` holds a client *ID* from another platform, or the secret is stale |
| Callback rejected before consent | Redirect URI not registered, or you used `http://localhost` where TikTok requires HTTPS |
| "TikTok OAuth requiere code_verifier" | PKCE state was lost — usually cookies blocked or a mismatched `APP_URL` between start and callback |
| Connects, zero videos | `video.list` not approved |
| Connects, no username or follower counts | `user.info.profile` / `user.info.stats` not approved |
| Connection dies after months | Refresh token expired — reconnect from `/account` |
| Webhook returns 401 | Signature keyed with the wrong secret, or server clock drifted beyond five minutes |

---

## Phase 6 — YouTube

### What this app actually uses

From `src/lib/oauth.ts`:

| | Value |
|---|---|
| Authorization URL | `https://accounts.google.com/o/oauth2/v2/auth` |
| Token exchange and refresh | `https://oauth2.googleapis.com/token` |
| Revoke | `https://oauth2.googleapis.com/revoke` |
| Channel lookup | `https://www.googleapis.com/youtube/v3/channels?mine=true` |
| Scopes | `https://www.googleapis.com/auth/youtube.readonly`, `https://www.googleapis.com/auth/yt-analytics.readonly` |
| Extra params | `access_type=offline`, `include_granted_scopes=true`, `prompt=select_account consent` |

This platform has **two hard failure modes** that are enforced in code, not
warnings. Read them before you connect.

> **1. No refresh token means the connection is rejected.**
> `exchangeYouTubeCode` throws if Google does not return a `refresh_token`.
> Google only issues one on the *first* authorisation of a given
> client/account pair. If you have authorised this app before — even a broken
> attempt — the second attempt returns no refresh token and the connection fails.
>
> **Fix:** revoke the app at
> [myaccount.google.com/permissions](https://myaccount.google.com/permissions),
> then connect again.

> **2. The Google account must own exactly one YouTube channel.**
> The code requires `channels.length === 1` from `channels?mine=true` and throws
> "Google no devolvio un unico canal de YouTube seleccionable" otherwise.
>
> Zero channels is the common case: a plain Google account that never created a
> channel returns none. Multiple channels happens with Brand Accounts.
>
> **Fix:** at the `select_account` screen, pick the identity that owns the
> channel you want — for a Brand Account, that is the brand identity, not your
> personal Google account.

### 6.1 Google Cloud project

1. Create a project in the
   [Google Cloud Console](https://console.cloud.google.com).
2. **APIs & Services → Library**: enable **YouTube Data API v3** *and*
   **YouTube Analytics API**. Both are required — `yt-analytics.readonly` is
   useless without the second, and the failure appears only later during sync.
3. **OAuth consent screen**: configure it, and add your own Google account under
   **Test users**.
4. **Credentials → Create credentials → OAuth client ID → Web application**.

### 6.2 Publishing status — this one bites

Both scopes are "sensitive" in Google's classification, so the honest trade-off
is:

| Publishing status | Verification | Consequence |
|---|---|---|
| **Testing** | Not required | **Refresh tokens expire after 7 days.** Your sync breaks weekly and you must reconnect |
| **In production** | Required for sensitive scopes | Refresh tokens persist |

For a deployment you actually rely on, push the app to production and go through
Google's verification. Testing mode is fine only while you are still setting
things up.

### 6.3 Redirect URI

```
https://<your-domain>/api/oauth/youtube/callback
```

### 6.4 Credentials

```bash
YOUTUBE_CLIENT_ID=<client id>
YOUTUBE_CLIENT_SECRET=<client secret>
```

### 6.5 Connect

**Verify:** the channel appears in `/account` with its title, then
`pnpm sync:dashboard` returns videos.

The username shown comes from the channel's `customUrl`, so a channel without a
handle displays no username. That is cosmetic, not a failure.

### YouTube troubleshooting

| Symptom | Cause |
|---|---|
| "YouTube no devolvio refresh_token" | Previously authorised — revoke at myaccount.google.com/permissions and retry |
| "Google no devolvio un unico canal" | The chosen Google identity owns zero channels, or several. Pick the right one at `select_account` |
| Works for a week, then breaks | OAuth app still in Testing — see 6.2 |
| `access_denied` at consent | Your account is not in the Test users list |
| Content syncs, analytics empty | YouTube Analytics API not enabled in the Cloud project |

---

## Phase 7 — AI features

Create a key at [openrouter.ai/keys](https://openrouter.ai/keys).

```bash
OPENROUTER_API_KEY_ANALYSIS=sk-or-v1-...
OPENROUTER_API_KEY_TRANSCRIPTION=sk-or-v1-...
```

> **Use two separate keys.** This is deliberate, not redundancy. Each OpenRouter
> key can carry its own spending limit, so a transcription job that runs away
> cannot consume the budget your content analysis depends on. Do not point both
> variables at one key.

Set a credit limit on each key in the OpenRouter dashboard before your first run.

Then bound how much history the sync walks:

```bash
BACKFILL_START_ISO=2026-01-01T00:00:00Z
```

Every run walks forward from this instant. Leave it too far in the past and your
first sync pays to analyse years of content you do not care about. Set it to
roughly when the account started producing content worth analysing.

**Verify — this is the important one:**

```bash
pnpm sync:run     # first pass: processes content, costs money
pnpm sync:run     # second pass: must be nearly free
```

The second run must report `analysis.attempted: 0` and
`transcription.attempted: 0`. If it does not, the cost guards are not working and
every future sync will re-bill you for content you already paid to process. Stop
and investigate before scheduling any cron.

---

## Phase 8 — Deploy

Built for Vercel; runs anywhere Node.js does.

- Framework: Next.js · Root directory: `/`
- Install: `pnpm install --frozen-lockfile` · Build: `pnpm build`

Copy every variable from `.env.local` into your host's environment, with two
changes:

1. `APP_URL` becomes your real HTTPS domain. Origin checks on mutations compare
   against it, so a wrong value breaks every write.
2. Add `CRON_SECRET` — a random string protecting `/api/sync/cron`.

Then go back to each platform's console and add the **production** redirect URI
alongside the localhost one.

`vercel.json` already declares a daily cron hitting `/api/sync/cron` at 02:00
UTC.

### Pre-flight checklist

- [ ] All 21 migrations applied; the RLS query in 2.2 returns `true` everywhere
- [ ] Public signup disabled in Supabase Auth
- [ ] `ALLOWED_USER_ID` matches your Supabase user
- [ ] `APP_URL` is the final HTTPS domain
- [ ] Production redirect URIs registered on every platform you use
- [ ] YouTube OAuth app moved out of Testing mode, or you accept reconnecting
      weekly (6.2)
- [ ] TikTok webhook registered, if you want automatic disconnects (5.4)
- [ ] `CRON_SECRET` set
- [ ] OpenRouter spend limits configured
- [ ] Two consecutive syncs; the second reports `attempted: 0`
- [ ] `service_role` key is server-side only

---

## Reference: what breaks and why

| Symptom | Likely cause |
|---|---|
| Redirected to `/login` in a loop | `ALLOWED_USER_ID` mismatch, or cookies blocked |
| `redirect_uri` errors on every platform | `APP_URL` differs from the registered callback |
| Writes fail in production, fine locally | `APP_URL` not set to the real domain — origin check |
| Stored tokens suddenly invalid | `CONNECTION_ENCRYPTION_SECRET` changed |
| Sync bills you every run | Cost guards broken — see phase 7 |
| `anon` key can read tables | RLS lockdown migration not applied |
| Build fails on a fresh clone | Node older than 24 — check `.nvmrc` |
| One YouTube connection dies every ~7 days | OAuth app still in Testing mode — see 6.2 |
| A connection dies after months, others fine | TikTok refresh token expired — reconnect from `/account` |

Per-platform tables live at the end of each phase:
[Instagram](#instagram-troubleshooting) ·
[TikTok](#tiktok-troubleshooting) ·
[YouTube](#youtube-troubleshooting)

## Where to go next

- [README](../README.md) — overview and daily commands
- [ARCHITECTURE.es.md](ARCHITECTURE.es.md) — data model, security layers and the
  reasoning behind each decision (Spanish)
- [MCP.md](../MCP.md) — exposing your data to external agents
- [CONTRIBUTING.md](../CONTRIBUTING.md) — conventions if you plan to change code
