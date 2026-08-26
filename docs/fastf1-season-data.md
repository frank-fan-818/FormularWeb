# FastF1 Season Data

This project serves FastF1 analytics from static JSON first, with Supabase as an optional import target. The static files live under:

```text
public/fastf1/<season>/<round>/<session>.json
```

For the 2025 season, the local export currently covers every available race weekend:

- 24 race weekends
- 60 session files
- Race and qualifying for every round: `R`, `Q`
- Sprint sessions for rounds 2, 6, 13, 19, 21, and 23: `S`, `SQ`
- Manifest: `public/fastf1/2025/manifest.json`
- Export report: `public/fastf1/2025/export-report.json`

## Export

Export or refresh an entire season:

```bash
npm run fastf1:export-season -- --season 2025 --force
```

Check what would run without writing session files:

```bash
npm run fastf1:export-season -- --season 2025 --dry-run
```

Refresh only missing files and rebuild the report/manifest:

```bash
npm run fastf1:export-season -- --season 2025
```

Export one session when a round needs repair:

```bash
npm run fastf1:export-race -- --season 2025 --round 12 --session R --telemetry-driver-count 0
```

## Automated Post-Race Chain

The scheduled GitHub workflow `refresh-fastf1-analytics.yml` runs every three hours:

1. Resolve the current UTC season, or use a manually requested season/round.
2. Read the FastF1 schedule and select only `R`, `Q`, and detected Sprint sessions whose scheduled start was at least four hours ago.
3. Keep complete files unchanged; overwrite missing or incomplete placeholder snapshots.
4. Import only snapshots that pass the same completeness policy into `fastf1_session_analytics` using the service-role secret.
5. Fail the run if any eligible session remains incomplete, and upload `manifest.json` plus `export-report.json` as diagnostics.
6. Create or update a PR against `develop` so the static JSON fallback is versioned and deployed after merge.

Required GitHub Actions secrets:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Manual repair for one round remains available through `workflow_dispatch`, or locally:

```bash
python scripts/export-fastf1-season-data.py --season 2026 --from-round 6 --to-round 6 --analysis-only --completed-only --refresh-incomplete
npm run fastf1:import-sessions -- --season 2026 --round 6 --complete-only
npm run fastf1:verify-manifest -- --season 2026 --round 6
```

## Coverage Check

Use `manifest.json` as the first source of truth. A complete season should show:

```json
{
  "rounds": 24,
  "sessions": 60,
  "completeRounds": 24,
  "completeSessions": 60,
  "missingSessions": 0
}
```

Race sessions are considered complete when they contain session results, lap pace, tyre strategy, weather points, and telemetry drivers. Qualifying sessions are considered complete when they contain session results, lap pace, tyre strategy, and qualifying best laps.

## Runtime Use

The web app reads static JSON through `src/api/fastf1Analytics.ts` when the Supabase lookup is unavailable or empty. This means local race detail pages can show post-race FastF1 data without requiring a database import.

## Optional Supabase Import

To import the static JSON payloads into `public.fastf1_session_analytics`, make sure the FastF1 SQL migrations and temporary import policy have been applied, then run:

```bash
npm run fastf1:import-sessions -- --season 2025
```

Use a dry run first when validating a new export:

```bash
npm run fastf1:import-sessions -- --season 2025 --dry-run
```

## Release 0.17.0

Version 0.17.0 adds resilient Sprint classification loading and the verified post-session FastF1 export/import pipeline.
The scheduled refresh checks completed Race, Qualifying, Sprint, Sprint Qualifying, and Sprint Shootout sessions before publishing snapshots.
