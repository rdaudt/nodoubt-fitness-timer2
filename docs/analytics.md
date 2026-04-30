# Analytics (No PII) - v1

## Step-by-Step Setup

1. Create a Turso database and token.
2. Set local env vars in `.env.local`:
   - `TURSO_DATABASE_URL=...`
   - `TURSO_AUTH_TOKEN=...`
3. Initialize Turso tables once from your machine:
   - `npm run analytics:db:init`
4. Set production env vars in Vercel Project Settings -> Environment Variables:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
   - `CRON_SECRET`
5. Deploy. Vercel Cron (configured in `vercel.json`) will call `/api/analytics-rollup` daily.

## API Endpoints

- `POST /api/analytics-ingest`
  - Accepts allowlisted event names and strict payload schemas only.
  - Stores anonymized events in `analytics_events`.
- `GET /api/analytics-health`
  - Verifies required analytics env vars are present.
  - Verifies Turso connectivity with a simple DB query.
  - Returns `ok: true` when healthy, otherwise returns failure reason.
- `GET|POST /api/analytics-rollup`
  - Vercel Cron uses `GET`.
  - Auth supports `Authorization: Bearer <CRON_SECRET>` (Vercel Cron standard).
  - Legacy fallback also accepts `x-analytics-cron-secret`.
  - Aggregates the previous UTC day into `analytics_rollup_daily`.
  - Deletes raw events older than 30 days.
- `GET /api/analytics-summary`
  - Returns aggregate counts, browser family usage, averages, and percentages.

## Privacy Guarantees

- No user account ID.
- No stable device/install ID.
- No timer names, location text, or raw user agent strings in analytics payloads.
- Browser captured as coarse family only (`chrome`, `safari`, `firefox`, `edge`, `other`).

## Notes

- `templatesCreatedFromScratch` is currently always `0` because the app has no "create template from scratch" flow yet.
- `mostUsedWorkoutTypes` is intentionally not collected in v1 to avoid free-text PII risk.
- Cron runs in Vercel infrastructure (not your desktop). Local machine only runs dev/test/init commands.

## Vercel UI Runbook

Use these exact click paths when diagnosing analytics issues in production.

1. Confirm the right deployment is live:
   - Vercel Project -> `Deployments` -> open newest production deployment from `main` -> ensure status is `Ready`.
2. Check health endpoint first:
   - Open `https://hiit-timer-green.vercel.app/api/analytics-health`.
   - Expect `ok: true` and `checks.dbConnection: true`.
3. Verify environment variables:
   - Vercel Project -> `Settings` -> `Environment Variables`.
   - Confirm `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and `CRON_SECRET` are set for `Production`.
   - If you changed any variable, redeploy: `Deployments` -> newest deployment -> `...` -> `Redeploy`.
4. Manually trigger rollup:
   - Run from terminal:
     - `curl.exe -i -X POST "https://hiit-timer-green.vercel.app/api/analytics-rollup" -H "Authorization: Bearer <CRON_SECRET>"`
   - Expect `HTTP/1.1 200` and `{ "ok": true, ... }`.
5. Validate summary output:
   - Open `https://hiit-timer-green.vercel.app/api/analytics-summary`.
   - If no events were ingested yet, zero values are expected.
6. View runtime logs for a specific deployment:
   - Vercel Project -> `Deployments` -> open deployment -> `Runtime Logs`.
   - Trigger endpoint again, then look for newest log lines at the same timestamp.
