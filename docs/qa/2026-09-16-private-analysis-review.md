# Private analysis follow-up review

- Date: 2026-09-16
- Branch: `codex/fia-upgrade-automation`
- Reviewed batch: `f1b7a6bd`
- Build URL: `http://127.0.0.1:4173`
- Viewports: desktop 1440 x 900, tablet 768 x 1024, mobile 375 x 812.
- Routes: `/`, `/races`, `/races/1`, `/races/1/race?season=2026`, `/races/1/info?season=2026`, `/drivers/max_verstappen`, `/constructors/red_bull`, `/circuits/monaco`, account routes, settings and unknown routes.

## Findings fixed

1. Auth initialization could accept an anonymous session on the `getSession` path; auth events could erase guest consent for that same anonymous session. Both paths now use the same member-session validation as private transport.
2. Private transport checked identity at response headers, before the body download finished. It now completes the download and rechecks identity before returning data. A delayed-body logout regression fails before the fix and passes afterward.
3. Legacy cache cleanup could create a version-1 IndexedDB without `snapshots`, preventing the cache adapter from creating its store. Cleanup now aborts database creation. Unit and real-browser regressions cover first-visit initialization.
4. Telemetry tests required removed public/private race assets. Synthetic optimized telemetry now covers two drivers and 2/20/1000 sample inputs, without restoring private data or skipping the test.
5. Guest request monitoring missed the new `fastf1-private` URL. The browser assertion now includes it.
6. Strict lint scanned the disposable FastF1 runner under `.tmp`. ESLint now excludes that temporary directory.

## Verification

- Frontend unit tests: 367 passed across 66 files.
- Production build, strict lint, security scan, UTF-8 scan and diff whitespace checks passed.
- FastF1 automation: 20 Python tests and 8 Node tests passed.
- Workflow policy tests: 3 passed; all six workflows validated.
- Deployment configuration and built service worker checks passed; 7 service worker freshness tests passed.
- Browser regression: auth access, smoke, race analysis and prediction suites; 66 passed, 19 intentionally skipped by existing viewport/service-worker rules. Console/network assertions passed within fixture expectations.
- Screenshots: `artifacts/browser-qa/test-results/`, including `login-entry.png` and `guest-locked.png` for all three viewports.

## Remaining verification boundary

No local blocking finding remains in these checks. Browser auth and data use test fixtures. This review does not verify deployed SQL permissions, real-account email delivery, private Storage migration or GitHub runner access. No production writes or deployment were performed. Real workflow acceptance remains as described in `docs/fastf1-reliability.md`.
