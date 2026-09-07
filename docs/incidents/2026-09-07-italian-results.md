# Italian Grand Prix classification freshness investigation

- Date: 2026-09-07 (Asia/Shanghai)
- Reported page: https://formular-web.vercel.app/races/13/results?season=2026
- Fix branch: codex/race-results-freshness

## Evidence

1. The Jolpica endpoint `/ergast/f1/2026/13/results.json?limit=100` returned 22 results for the Italian Grand Prix dated 2026-09-06 during this investigation. This does not establish when upstream first published them.
2. `useRacePrimaryResults` reads the Jolpica proxy. Prediction generation and FastF1 analytics import are separate pipelines; their successful completion does not verify this classification page.
3. The generated service worker returned cached `/f1-api/` responses immediately, including pre-race empty classifications, while fetching updates in the background. The current React request never received that background response. The persistent `f1-data-v1` cache has no age check. Regression tests reproduced empty/older responses masking 22 fresh results.
4. FastF1 run [34084989146](https://github.com/frank-fan-818/FormularWeb/actions/runs/34084989146), at 2026-09-07 12:57 Beijing time, reported both round 13 R and Q pending. The export report says timing/telemetry data were unavailable and the full analytics payload failed completeness checks. Its manifest verification nevertheless passed because the scheduled run supplied `--allow-incomplete`.
5. Production deployment for main commit `bfcefbf3478a9f197db31dbf3dcc13fe98013f35` succeeded before this investigation. Direct production HTTP probes timed out from the investigation environment; browser inspection also timed out. The user's actual cached response, CDN headers, and current rendered classification have not been verified.

## Changes prepared locally

- Public API requests now await the network response, using stored data only on network/HTTP failure. Cache write errors cannot discard successful network responses.
- Seven runtime regression tests execute the built worker; they cover cached empty and outdated results, offline/HTTP fallback, unavailable cache storage, failed cache writes, and uncached HTTP failure. They are included in `service-worker:verify`.
- Scheduled FastF1 verification no longer opts into incomplete success. Complete snapshots still import before verification; missing eligible sessions mark the run failed and upload existing diagnostics. Static-backup PR creation is skipped on failure, as already specified by the dependency. GitHub notification delivery depends on the account's notification settings.
- Patch version: 0.18.5.

## Limits and follow-up

The cache defect is reproduced, but it cannot conclusively be attributed to this particular browser incident without inspecting that browser's response. FastF1 analytics incompleteness is independently verified and is not proof that Jolpica classification was missing. Do not treat current upstream availability as evidence of availability last night.

Deploy the prepared fix, then verify the reported production page with a pre-existing empty API cache. A page left open does not currently poll for new classifications. The CDN proxy still uses its existing cache policy. A reliable freshness target needs a separate end-to-end classification check after each race, including an explicit deadline and a notification destination; workflow status alone is insufficient. No automatic monitor or external notification was created in this investigation.

## QA

- Build: `npm run build` passed.
- Unit suite: 61 files / 333 tests passed.
- Built worker: seven freshness regression tests passed (three failed before the fix).
- Browser QA: production build at `http://127.0.0.1:4173`; 39 smoke checks passed, 19 intentionally skipped by viewport/project rules. Covered `/`, `/races`, `/races/1`, driver, constructor, circuit, account/settings routes, and worker upgrades. Desktop 1440x900, mobile 375x812, tablet 768x1024. The smoke suite uses mocked upstream API responses; it does not prove production classification availability.
- Layout: unchanged; no new visual screenshots required.
- Blocking: production connectivity prevents confirming recovery; changes are not deployed.
