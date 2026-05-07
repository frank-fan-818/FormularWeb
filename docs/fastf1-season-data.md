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
