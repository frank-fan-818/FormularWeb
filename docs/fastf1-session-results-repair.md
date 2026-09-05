# Practice and sprint qualifying results repair

Date: 2026-09-05. Version: 0.18.2.

## Causes and changes

The scheduled export used `--analysis-only`, excluding practice. The database import also excluded FP1/FP2/FP3. Both now include practice and run against `main`.

FastF1 3.8.3 returns a driver roster for practice without calculating classification. The exporter now ranks each driver's best non-deleted timed lap, excludes pit entry/exit and generated laps, preserves completed lap counts, and leaves drivers without valid times unranked. Practice times are absolute lap times, not race gaps. Unknown deleted-lap status fails validation instead of silently accepting invalid laps.

The lightweight exporter disabled race-control messages. FastF1 needs those messages to determine deleted laps and calculate qualifying results. Timed sessions now retain laps and messages even with `--results-only` or `--laps-only`. SQ/SS phase times are checked before accepting a snapshot.

Completeness checks previously accepted a roster as complete. Practice now requires timed classification and `classificationVersion: 1`; sprint qualifying requires phase times. Old files are eligible for refresh. The UI prioritizes FastF1 classifications, retains database fallback, and does not let an old static roster hide timed database results.

## Real data coverage

All selected, completed scheduled sessions passed the updated completeness checks:

| Season | Practice and sprint qualifying sessions |
| --- | ---: |
| 2022 | 63 |
| 2023 | 60 |
| 2024 | 66 |
| 2025 | 66 |
| 2026 | 34 |
| Total | 289 |

2026 coverage includes Italian FP3 as eligible at collection time. Future sessions are not fabricated. Sprint weekends use the sessions actually present in FastF1's schedule; 2023 sprint shootout is `SS`, later sprint qualifying is `SQ`. Historical 2021 “Sprint Qualifying” refers to the sprint race and is outside this qualifying repair.

Transient schedule and race-control-message fetch failures were retried successfully. Per-season `public/fastf1/<year>/export-report.json` and `manifest.json` record the final collection state. These are FastF1-derived classifications, not a claim that every historical row has been independently compared with an official classification document.

## Upstream verification

Jolpica's legacy Ergast-compatible practice URL returned 404, but its newer alpha API does provide practice and sprint qualifying results. It was used for cross-checking; the application obtains these sessions from FastF1 snapshots, avoiding a new dependency on alpha API stability.

- [FastF1 3.8.3 implementation](https://github.com/theOehrly/Fast-F1/blob/v3.8.3/fastf1/core.py)
- [FastF1 upstream implementation](https://github.com/theOehrly/Fast-F1/blob/master/fastf1/core.py)
- [Jolpica Australian FP1](https://api.jolpi.ca/f1/alpha/results/round_46HucC4K/FP1/)
- [Jolpica Australian FP2](https://api.jolpi.ca/f1/alpha/results/round_46HucC4K/FP2/)
- [Jolpica Chinese SQ](https://api.jolpi.ca/f1/alpha/results/round_JqmngOvt/SQ/)

Verified 2026 Australian fastest times: FP1 Leclerc 1:20.267, FP2 Piastri 1:19.729, FP3 Russell 1:19.053. Chinese SQ Russell phase times: 1:33.030 / 1:32.241 / 1:31.520. Perez's Australian FP2 outlap is excluded: two laps, no valid best time; all 22 drivers remain visible.

## Reproduction

Install `requirements-fastf1.txt`, then run:

```sh
python scripts/export-fastf1-season-data.py --season 2026 --session FP1 --session FP2 --session FP3 --session SQ --session SS --completed-only --refresh-incomplete
python -m unittest scripts.fastf1_classification_test scripts.fastf1_snapshot_validation_test scripts.fastf1_automation_test
npm test
npm run build
node scripts/run-browser-qa.mjs e2e/race-sprint-resilience.qa.spec.ts --project desktop-chromium --project mobile-chromium --project tablet-chromium
```

## Browser QA

- Date: 2026-09-05
- Branch: `codex/fix-fastf1-session-results`
- Build URL: `http://127.0.0.1:4173`
- Changed routes: `/races/1/results?season=2026`, `/races/2/results?season=2026`, race information and analysis routes covered by the resilience suite.
- Viewports: desktop 1440 x 900, mobile 375 x 812, tablet 768 x 1024.
- Findings: the real snapshot test passed on all three viewports. FP1/FP2/FP3 display 22 rows and verified winning times; SQ displays all three verified phase times. No page errors or unexpected failed requests in that test. Unrelated metadata APIs are fixture-controlled; FastF1 files are not mocked.
- Blocking: none in the changed flow. Git push does not itself establish production deployment.
- Screenshots: `artifacts/browser-qa/screenshots/real-practice-<project>.png` and `real-sprint-qualifying-<project>.png` (local ignored QA evidence).
- Validation: 328 Vitest tests, 13 Python tests; strict lint, UTF-8 check, workflow validation, production build and secret scan passed. Resilience suite: 11 passed, 4 intentional skips across three viewports.
