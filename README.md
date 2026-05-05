# HIIT Timer by NoDoubt Training Co.

Mobile-first, offline-capable HIIT timer PWA with coach-focused workflows.

## Overview
This app lets users create and run station-based HIIT workouts with warmup, work/rest rounds, station transitions, and cooldown. It also includes templates, run history, timer import/export, and optional coach content-generation workflows.

Core timer usage is local-first and stored in IndexedDB. Tenant profile and published templates are read from shared Turso data managed by `best-hiit-timer-portal`. Optional backend APIs (Vercel serverless) also support analytics and async image generation jobs.

## Key Features
- Timer CRUD with station/round model
- Run engine with:
  - warmup/work/rest/transition/cooldown timeline
  - coach-mode manual station start
  - optional countdown beeps and interval-end long beep
  - screen wake lock while running
- Templates:
  - built-in templates from `templates/*.json`
  - user templates created from timers
- Run history:
  - complete vs incomplete run tracking
  - editable run metadata
  - run JSON export
  - content-generation UI action is currently hidden from end users
- App settings:
  - coach mode, interval colors, audio toggles, card imagery toggles
- Timer/template workout type editing:
  - station workout type fields are editable
  - "Load random workouts" UI action is currently hidden from end users
- Timer transfer:
  - export/import timers as JSON
- Brand pages and navigation for NoDoubt Training Co.
- PWA support (manifest + service worker)
- Privacy-focused analytics pipeline

## Tech Stack
- React 19 + TypeScript + Vite
- React Router
- IndexedDB via `idb`
- Vitest + Testing Library
- Vercel Serverless Functions (`api/*`)
- Turso (`@libsql/client`) for analytics/job metadata
- Vercel Blob for generated image storage

## App Routes
- `/:tenantSlug` timers list
- `/:tenantSlug/timer/new` create default timer + redirect
- `/:tenantSlug/timer/:id` timer detail/editor
- `/:tenantSlug/timer/:id/run` running timer session
- `/:tenantSlug/templates` templates list
- `/:tenantSlug/template/:id` template detail/editor
- `/:tenantSlug/history` run history
- `/:tenantSlug/about` business/about page
- `/:tenantSlug/settings` settings + timer import/export

## Project Structure
```text
src/
  components/        layout and reusable UI
  pages/             route screens
  lib/               pure timer/rules/time logic
  services/          storage, settings context, analytics, audio, transfer
api/                 Vercel serverless functions
public/              static assets + service worker + manifest
templates/           built-in timer template JSON files
scripts/             maintenance scripts (analytics DB init)
```

## Getting Started
### Prerequisites
- Node.js 20+
- npm 10+

### Install
```bash
npm install
```

### Run frontend locally
```bash
npm run dev
```
Starts Vite dev server (client app only).

### Run tests
```bash
npm test
```

### Lint
```bash
npm run lint
```

### Production build
```bash
npm run build
npm run preview
```

## Local Development Modes
### 1) Frontend-only mode (most timer work)
Use `npm run dev`.
- Timer CRUD/run/settings/templates/history (local data) work in browser.
- API routes are not available in this mode.

### 2) Full-stack mode (frontend + `/api/*`)
Use Vercel dev runtime when testing serverless endpoints locally.
- Required for analytics endpoints and content generation job flow.
```bash
npx vercel dev --listen 3000
```

## Environment Variables
Set these in `.env.local` for local full-stack/serverless work and in Vercel Project Settings for deployments.

### Required for analytics APIs
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `CRON_SECRET` (or legacy `ANALYTICS_CRON_SECRET`)
- `VITE_DEFAULT_TENANT_SLUG` (recommended for slug fallback redirect)

### Required for content generation APIs
- `OPENAI_API_KEY`
- `BLOB_READ_WRITE_TOKEN`
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `CRON_SECRET` (or legacy `ANALYTICS_CRON_SECRET`)

### Shared portal data requirements
- `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` must target the same Turso database used by `best-hiit-timer-portal`.
- The HIIT app reads published tenant profile/templates only; it does not own tenant schema migrations.
- Tenant brand images (`logo_url`, `coach_photo_url`) are consumed as provided; when absent or broken, the app falls back to bundled defaults.

## Analytics Setup
Initialize analytics tables once:
```bash
npm run analytics:db:init
```

### Windows + WSL note (Turso local setup)
This project is developed on Windows, but some Turso local setup steps may be easier or required in WSL.

- If your Turso CLI/auth flow is configured in WSL, run Turso login/database/token commands there.
- Then mirror the resulting values into project `.env.local` on Windows:
  - `TURSO_DATABASE_URL`
  - `TURSO_AUTH_TOKEN`
- After env vars are set, run app commands from your normal project shell:
  - `npm run analytics:db:init`
  - `npx vercel dev --listen 3000`

If the API still cannot connect to Turso, confirm the same credentials are available in the shell session where `vercel dev` is running.

Vercel cron schedule is defined in `vercel.json` and calls:
- `GET /api/analytics-rollup`

See docs for details:
- `docs/analytics.md`
- `docs/DEPLOYMENT.md`

## Deployment
Primary target is Vercel.

Build settings:
- Build command: `npm run build`
- Output directory: `dist`

Serverless APIs under `api/` are deployed automatically with the project.

## Data & Privacy Notes
- Core timer data is local to the browser (IndexedDB).
- No user authentication required for core app usage.
- Analytics intentionally avoids direct personal identifiers.
- Timer import/export covers timer definitions only (run history excluded).

## Documentation
- Product requirements: `docs/hiit-timer-prd.md`
- Business rules: `docs/business-rules.md`
- Analytics setup: `docs/analytics.md`
- Deployment: `docs/DEPLOYMENT.md`
- Brand reference: `docs/BRAND.md`

## NPM Scripts
- `npm run dev` - start Vite dev server
- `npm run build` - type-check + production build
- `npm run preview` - preview production build
- `npm run lint` - run ESLint
- `npm test` - run test suite once
- `npm run test:watch` - run tests in watch mode
- `npm run analytics:db:init` - initialize analytics DB tables

## Troubleshooting
- `Timer not updating as expected after schema/rules changes`:
  - Clear site data for the app origin (IndexedDB + localStorage), then reload.
  - The app uses IndexedDB database `nodoubt-hiit`; stale local records can mask code changes.
- `Import/export appears broken`:
  - Ensure the file is valid JSON and matches export format `nodoubt-timers-export` version `1`.
  - Import replaces all existing timers in the current browser profile.
- `API route returns 401 Unauthorized`:
  - For cron-protected routes, send `Authorization: Bearer <CRON_SECRET>`.
  - Confirm `CRON_SECRET` (or legacy `ANALYTICS_CRON_SECRET`) is set in env.
- `Analytics endpoints fail locally`:
  - Verify `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.
  - Run `npm run analytics:db:init` once before hitting rollup/summary endpoints.
- `Content generation fails`:
  - Verify `OPENAI_API_KEY`, `BLOB_READ_WRITE_TOKEN`, `TURSO_DATABASE_URL`, and `TURSO_AUTH_TOKEN`.
  - Confirm required media/prompt files exist:
    - `docs/nodoubt_hiit_prompt_production.md`
    - `media/nodoubt-training-logo.png`
    - `media/coach-gabe-and-kobe-poster.png`
- `Service worker causes outdated UI`:
  - In local dev, service workers are unregistered automatically.
  - In production, hard refresh and clear site cache if an older bundle is still served.
