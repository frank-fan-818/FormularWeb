# Automatic FIA upgrade publications

`refresh-fia-upgrades.yml` checks every 30 minutes, from five days before each race
until two days afterwards. Outside those windows it skips dependency installation
and PDF processing. Round numbers come from the current Jolpica calendar. FIA
season and event selectors supply the document page; no per-race URL entry is needed.

Once a Car Presentation Submissions PDF appears, the publisher checks its season,
event, team coverage and component numbering before saving the complete race in
`fia_race_upgrade_snapshots`. A single upsert replaces the whole JSON artifact;
the `(season, round)` primary key and content hash prevent duplicate publications.
Revisions replace the prior artifact. Download or validation failures never overwrite
the last successful publication, and cause a failed Actions run. Missing documents
are normal pending publication. A complete all-zero declaration is valid.

The race information page checks for new data every minute while visible, and again
when the tab regains visibility. Background refreshes retain displayed data on errors.
Source priority is automatic publication, legacy database rows, then the bundled
race snapshot. An automatic all-zero declaration takes precedence over older data.
Actual end-to-end delay includes GitHub Actions scheduling delays and processing;
this is polling, not a guaranteed immediate push notification.

## One-time activation

1. Apply `scripts/sql/2026-09-08-fia-race-upgrade-snapshots.sql` in Supabase.
   The new table allows public reads and service-role writes; legacy tables are untouched.
2. Ensure Actions secrets `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` exist.
   These are the same names used by the project's FastF1/prediction workflows.
3. Merge this workflow into the default branch and deploy the frontend once.
4. Manually dispatch **Refresh pre-race FIA upgrades** with season `2026`, round `13`
   to verify the first database publication. Later eligible races need no redeploy.

Local validation without database writes:

```powershell
node --import tsx scripts/refresh-fia-upgrades.ts --season 2026 --round 13 --dry-run
```

Omit `--dry-run` only when publishing with service-role credentials. `--round`
allows a manual backfill outside the normal window. Without it, only eligible race
weekends are processed. Parsed evidence is retained as a seven-day Actions artifact.

The strict team check currently covers the 2025 and 2026 grids. Review its roster
when the grid changes; an unrecognized lineup fails instead of publishing partial data.

## Bundled backup data

The 2026 rounds 5–13 backfill contains 242 records after PDF table corrections.
Original FIA links remain in every record and in `data/fia-upgrades/sources-2026.json`.
These files are fallback release data; the automatic feed does not require changing them.
To regenerate them explicitly:

```powershell
node --import tsx scripts/sync-fia-upgrade-snapshots.ts data/fia-upgrades/sources-2026.json
```

An optional final argument supplies downloaded PDFs named `<round>.pdf`.

## Verification and activation status

- Version: 0.19.0. Final checks: 352 unit tests passed; production build, strict
  lint, UTF-8 and six-workflow policy checks passed. Browser regression: 43 passed,
  8 skipped by the existing compact-viewport smoke policy, including all 12 upgrade
  scenarios. Build URL: `http://127.0.0.1:4173`; branch: `codex/race-results-freshness`.
- Verified real FIA document discovery and parsing for Italian GP 2026 (26 records,
  10 teams), plus all nine downloaded race documents against the strict validator.
- Verified the upcoming Spanish GP (round 14) returns `awaiting_publication` when
  the FIA document has not appeared, without publishing empty replacement data.
- Browser scenarios cover database, bundled fallback, empty and automatic appearance
  without page reload at 1440×900, 768×1024 and 375×812.
- Local screenshots are in `artifacts/browser-qa/test-results/` (ignored).
- The migration and live database publication have not been executed. The local
  environment has no service-role credential, and GitHub CLI authentication is invalid;
  default-branch workflow activation and deployment remain outstanding.
