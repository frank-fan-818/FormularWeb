# Historical results: consistent driver names

- Date: 2026-10-18
- Branch: `codex/points-completed-race-alignment`
- Build URL: `http://127.0.0.1:4173` (local production build, deterministic API fixtures)
- Primary task: identify the winner, pole sitter and every podium driver without decoding abbreviations.
- Root cause: `driverIdToCode` converted the final segment of `carlos_sainz_jr` into `JR`. Winner cells additionally mixed that generated code with the full name; mobile hid the full name.
- Design: use the supplied full driver names consistently in all three columns; remove code badges and ID-based abbreviation generation. Preserve `Jr.` and other name spelling from source data. Use existing 14px semibold text tokens. Stack P1/P2/P3 names and show a separate date row on mobile to keep names readable.
- Preserved: result data and sorting, sample sizes, risk calculations, dates, loading/error/retry handling, missing-result placeholders, component prop contract.

## Validation

- Unit tests: 89 files / 523 tests passed. The new component regression initially failed on `JR` and the missing-result badge; both cases now pass.
- Targeted tests: 7 passed (historical result component and weekend analytics).
- `npm run build`: passed; existing logger static/dynamic import warning remains.
- Targeted ESLint and diff whitespace checks: passed.
- Encoding: 427 UTF-8 source files passed.
- Routes: `/races/13/info?season=2026` (populated history, missing history, expandable samples); desktop smoke checks cover `/`, `/races`, `/races/1`, `/drivers/max_verstappen`, `/constructors/red_bull`, `/circuits/monaco` and seven other routes.
- Viewports: desktop 1440×900, tablet 768×1024, mobile 375×812.
- Browser tests: 6 history checks and 13 desktop route checks passed.
- Confirmed Carlos Sainz Jr. appears as a visible name in winner, pole and podium cells at all viewports, with no standalone JR badge. All names remain visible on mobile; no table/page horizontal overflow.
- Console/network: no unexpected console or page errors and no failed requests. Optional private FastF1 analytics is deliberately unavailable (404) in the existing fixture.
- Blocking findings / design debt: none for this change.

## Changed files

- `src/pages/Race/shared/components/RaceHistoricalContextPanel.tsx`
- `src/pages/Race/styles/history-brief.css`
- `src/pages/Race/shared/components/RaceHistoricalContextPanel.test.tsx`
- `e2e/race-history-brief.qa.spec.ts`

## Screenshot paths

- `artifacts/browser-qa/screenshots/history-names-desktop-chromium.png`
- `artifacts/browser-qa/screenshots/history-names-tablet-chromium.png`
- `artifacts/browser-qa/screenshots/history-names-mobile-chromium.png`

Screenshots use test fixtures to verify presentation and are not a historical race data audit.

## Temperature unit follow-up

- Date: 2026-10-18; same branch and local build URL.
- Replaced plain `C` with `℃` in the shared temperature formatter, analysis summary ranges, and weather chart temperature axis/ticks. Overview cards and chart tooltips inherit the shared formatter fix.
- Preserved numeric precision and unavailable-value placeholders; unit tests include zero and negative temperatures.
- Validation: 7 targeted tests, production build, targeted ESLint and UTF-8 check passed. Weather overview browser tests passed at desktop 1440×900, tablet 768×1024 and mobile 375×812; temperature text and absence of horizontal overflow checked.
- Screenshot paths: `artifacts/browser-qa/screenshots/weather-brief-desktop-chromium.png`, `artifacts/browser-qa/screenshots/weather-brief-tablet-chromium.png`, `artifacts/browser-qa/screenshots/weather-brief-mobile-chromium.png`.
- Files: `src/utils/raceDetailFormatters.ts`, `src/utils/race/raceAnalysisViewModel.ts`, `src/pages/Race/shared/charts/weather.ts`, their formatter tests, and the weather assertions in `e2e/race-history-brief.qa.spec.ts`.
- Blocking findings: none.
