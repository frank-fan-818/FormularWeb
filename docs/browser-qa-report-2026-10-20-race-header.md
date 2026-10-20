# Race header simplification

- Date: 2026-10-20
- PR branch: codex/race-ui-time-zone
- Primary task: identify the event, circuit and race start time at a glance.
- Layout: event identity on the left and a prominent start time on the right; stack on mobile.
- Typography: existing design tokens, 32–56px event title, 18–20px circuit name, 24px start time, 16px supporting information.
- Keep: season and round, event name, circuit and location, Beijing start time, Chinese event state and sprint indicator.
- Remove: championship strapline, oversized background round, decorative grid, flag icon, technical connection footer and empty result placeholders.
- Results: show only available winner, pole and fastest-lap facts, using complete driver names and Chinese labels.
- Loading/error: keep existing skeletons, failure messages and retry actions.
- Viewports: 1440×900, 768×1024 and 375×812, light and dark themes.
- Build URL: http://127.0.0.1:4173 (local production build with deterministic fixtures).
- Validation: 92 unit test files / 536 tests passed; production build, targeted ESLint, UTF-8 check (438 files) and diff checks passed.
- Browser regression: 35 passed / 10 intentional skips. Theme and typography checks passed on desktop, tablet and mobile; available private analytics still render their actual analysis content.
- Routes checked: /, /races, /races/1, /drivers/max_verstappen, /constructors/red_bull, /circuits/monaco, plus account/settings and not-found smoke routes.
- Fixture previews: 12 combinations of upcoming/completed, light/dark and desktop/tablet/mobile. No console errors, failed requests or horizontal overflow. Upcoming fixture includes a complete 19-round calendar and correctly reports zero unpublished results.
- Findings: none. Existing logger static/dynamic import build warning remains.
- Blocking: none.
- Screenshots: artifacts/browser-qa/screenshots/race-header-*.png.

Changed files: src/pages/Race/RaceLayout.tsx, src/pages/Race/styles/editorial-shell.css, src/pages/Race/styles/editorial-responsive.css, e2e/race-sprint-resilience.qa.spec.ts.
