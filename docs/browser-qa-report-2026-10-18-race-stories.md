# Race overview story cards

- Date: 2026-10-18
- Branch: `codex/points-completed-race-alignment`
- Build URL: `http://127.0.0.1:4173` (local production build; deterministic API fixtures)

## Design brief

- Audience / primary task: F1 fans scanning which driver gained or lost positions, set the fastest lap, or failed to finish.
- Layout: four equal columns on desktop, two columns on mobile/tablet; the story strip spans the summary width.
- Reading order: metric label → value → complete driver names → contextual detail.
- Typography: existing design tokens; labels 14px, grid/lap details 14px bold (700), names 16px semibold in the regular UI font. Keep metric values in the existing display font.
- Interaction: every displayed name links to the driver's profile, with underline, hover and keyboard focus feedback.
- Retirement policy: show every retired driver; wrap names instead of truncating the list. Zero retirements says 全员完赛. Track interruption counts no longer appear inside the retirement card.
- No API, loading, error or result-calculation changes; retain the existing awaiting-results state.

## Validation

- Unit tests: 84 files / 502 tests passed; targeted overview component and insight tests: 5 passed.
- Production build: passed. Existing logger static/dynamic import warning remains.
- Targeted ESLint: passed with zero warnings.
- UTF-8 check: passed (414 source files).
- Overview interaction QA: passed at 1440×900, 768×1024 and 375×812.
- Confirmed four retirements render four full names, 16px name text, contextual grid/lap labels, no overflowing cards or names, visible keyboard focus, and Enter navigation to the fourth driver's profile.
- Desktop route smoke checks: all 13 passed, including `/`, `/races`, `/races/1`, `/drivers/max_verstappen`, `/constructors/red_bull`, `/circuits/monaco`.
- Console/network: no application warnings/errors or failed requests in the changed flow. Excluded only Playwright's expected service worker blocking warning.
- Loading/empty/error: awaiting-results and zero-retirement states covered by unit tests; existing route smoke tests exercise empty upstream responses.
- Findings / Blocking: none.

## Files

- `src/pages/Race/shared/components/RaceOverviewPanel.tsx`
- `src/pages/Race/styles/editorial-overview.css`
- `src/pages/Race/shared/components/RaceOverviewPanel.test.tsx`
- `e2e/race-overview-stories.qa.spec.ts`

## Screenshots

Latest typography follow-up: grid/lap details use the existing `--font-bold` token. Targeted unit tests (5) and Vite production bundling passed. Full `npm run build` is currently blocked by unrelated fetch mock type errors in `src/api/preRacePredictionInputs.test.ts` (TS2322); that file was not modified for this styling request. Browser QA uses the freshly generated Vite bundle.

- `artifacts/browser-qa/screenshots/race-stories-desktop-chromium.png`
- `artifacts/browser-qa/screenshots/race-stories-tablet-chromium.png`
- `artifacts/browser-qa/screenshots/race-stories-mobile-chromium.png`
- `artifacts/browser-qa/screenshots/race-debrief-desktop-chromium.png`
- `artifacts/browser-qa/screenshots/race-debrief-tablet-chromium.png`
- `artifacts/browser-qa/screenshots/race-debrief-mobile-chromium.png`
