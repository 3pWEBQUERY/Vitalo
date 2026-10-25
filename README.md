# Vitalo Backend

Next.js 15 (route handlers and admin area), TypeScript, Postgres with Drizzle, Zod. The iOS app talks
only to this server. The server calls Open Food Facts, the logo provider, Claude, Apple and APNs and
keeps their keys.

## Run locally

```bash
createdb vitalo
cp .env.example .env.local
npm install
npm run migrate
npm run seed
npm run create-admin -- --email you@example.com --name "Your Name"
npm run dev
```

`create-admin` writes a generated password to `.admin-password` (git-ignored). Sign in at
`http://localhost:3000/admin/login`, set up two-factor sign-in under *Mein Konto*, then delete the file.
The iOS Debug build points at `http://localhost:3000/api` (`VITALO_API_BASE_URL` in `project.yml`).

```bash
npm test          # integration tests against the running dev server
npm run typecheck
```

## API (`/api/v1`)

Every request sends `X-App-Version`; versions below `min_app_version` get `426`. Authenticated routes
need `Authorization: Bearer <accessToken>`. Errors are `{ "error": "<code>", "message"? }`.

| Area | Endpoints |
| --- | --- |
| Sign-in | `POST auth/apple`, `POST auth/refresh` (rotating), `POST auth/logout`, `POST auth/dev` (not in production) |
| Config | `GET config`: feature flags, AI availability, safety floors, minimum version |
| Account | `GET/DELETE me`, `PATCH me/profile`, `GET/POST me/goals`, `GET/POST me/consents`, `GET me/export[?format=csv&table=meals]`, `GET/DELETE me/sessions`, `GET/POST me/appeals` |
| Sync | `POST sync/push`, `GET sync/pull?cursor=` (meals, water, weights, check-ins; last write wins, deletion wins) |
| Foods | `GET products/{barcode}`, `GET foods/search?q=`, `POST foods`, `GET foods/{id}`, `POST foods/{id}/confirm` |
| Brands | `GET brands?name=`, `GET brands/{id}/icon[?kind=logo]` |
| AI | `POST ai/text`, `POST ai/photo`, `GET ai/quota` |
| Coach | `GET coach/suggestions`, `POST coach/suggestions/{id}`, `GET/DELETE coach/log` |
| Platform | `POST/DELETE push-tokens`, `GET subscriptions`, `POST subscriptions/verify` |
| Community | `GET/PUT/DELETE community/profile`, `GET community/profiles/{handle}`, `GET community/feed`, `POST community/posts`, `GET/DELETE community/posts/{id}`, `PUT …/reactions`, `GET/POST …/comments`, `POST/DELETE community/follows/{userId}`, `GET community/follow-requests`, `POST community/follow-requests/{userId}`, `GET community/suggestions` |
| Groups | `GET/POST community/groups`, `GET/PATCH community/groups/{id}`, `POST/DELETE …/members`, `PUT/DELETE …/members/{userId}`, `GET/POST …/challenges`, `POST community/challenges/{id}/progress` |
| Safety | `POST reports`, `POST/DELETE blocks/{userId}` |
| Media | `POST media?purpose=post\|progress_photo\|label` (location data removed), `GET/DELETE media/{id}[?size=thumb]` |

Outside `v1`: `GET /api/health`, `POST /api/app-store/notifications` (App Store Server Notifications v2),
`POST /api/internal/jobs/coach` and `POST /api/internal/jobs/maintenance` (with `X-Job-Secret`).

## Admin (`/admin`)

Password (scrypt) plus authenticator code (TOTP), mandatory in production. Five failed attempts lock the
account for 15 minutes. Sessions end after 2 hours without activity or 12 hours in total. Every change is
written to the audit log.

| Role | Areas |
| --- | --- |
| Administration | everything, including team, settings and AI costs |
| Moderation | reports, held posts, sanctions, appeals |
| Redaktion | foods (values, quality, corrections, duplicates), brands, products |
| Support | accounts: plan, devices, consents, lock, deletion. No health or diary data. |

## Scheduled jobs (Railway cron)

| Schedule | Request |
| --- | --- |
| nightly 03:00 | `POST /api/internal/jobs/coach` (signals, suggestions; Sundays the weekly review push) |
| daily 04:00 | `POST /api/internal/jobs/maintenance` (held posts after 30 days, ended sessions, cost records after 13 months) |

## Brand logos

Logos come from Brandfetch and are cached per brand. Matching is strict: a brand only gets a logo when
the provider's name or domain matches; otherwise it shows none rather than a wrong one. Spellings are
merged as aliases. In `/admin/brands` brands are added, edited (website, spellings, own icon and
wordmark uploads), hidden or deleted.

## Deploy (Railway)

Project **Vitalo** (region Amsterdam) with:

| Service | Purpose |
| --- | --- |
| `backend` | This repository, built with Railpack. Before each deploy `npm run release` runs migrations, loads the reference foods and creates the first admin if `ADMIN_BOOTSTRAP_*` is set. Healthcheck: `/api/health`. |
| `Postgres` | Database; `DATABASE_URL` is referenced from it. |
| `vitalo-media` | Private bucket for photos and logos (`BUCKET`, `ENDPOINT`, `REGION`, `ACCESS_KEY_ID`, `SECRET_ACCESS_KEY` referenced). |
| `cron-coach` | 02:00 UTC: `POST /api/internal/jobs/coach` with `X-Job-Secret`. |
| `cron-maintenance` | 03:00 UTC: `POST /api/internal/jobs/maintenance`. |

Build, start (`npm start`), pre-deploy (`npm run release`) and healthcheck are set on the service in Railway. Every push to `main` deploys. After the first admin sign-in, remove `ADMIN_BOOTSTRAP_PASSWORD`
from the backend variables. Still to add when available: `ANTHROPIC_API_KEY`, `BRANDFETCH_CLIENT_ID`,
the Apple keys (`APPLE_*`, `APNS_*`).
