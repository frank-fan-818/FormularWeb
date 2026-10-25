# Season fastest pit-stop QA

- Date: 2026-10-25.
- Branch: `codex/season-fastest-pit-stop`.
- Status: implementation verified before the authorized 1.5.0 submission; production deployment is separate.
- Build / preview: production build, Vite preview at `http://127.0.0.1:4173`.
- Primary task: view a selected season's fastest stationary pit stops and their drivers, teams and events.

## Routes and viewports

- Changed route: `/pit-stops?season=2025&view=fastest`; season points and event views also checked, including the race-record round trip.
- Route smoke coverage: `/`, `/races`, `/races/1`, `/drivers/max_verstappen`, `/constructors/red_bull`, `/circuits/monaco`, auth routes, settings, privacy and unknown route.
- Desktop 1440×900, tablet 768×1024, mobile 375×812.
- Mobile tabs occupy one row; driver/team, event abbreviation and official time fit without page overflow. Desktop/tablet show the full circuit name. Existing design tokens and tables are reused; no count cards or explanatory blocks added.

## Verification

- Source adapter: 11 tests passed. Covers dynamic discovery, official positions, different official positions for equal displayed times, event/time mismatches, malformed data, unavailable history, and timing precision such as `2.00`.
- Targeted client/hooks/utilities: 7 tests passed. Covers schema validation, older cached responses without `seasonFastest`, season cancellation and retaining successful fastest records on retry failure.
- Strict lint, TypeScript production build, UTF-8 encoding, fonts and performance budget passed. Existing build warning about logger static/dynamic imports remains unchanged.
- Feature + route smoke matrix: 47 passed, 19 existing project/platform skips. After tightening the mobile tab layout, all 9 feature cases passed again across desktop/tablet/mobile.
- Browser cases cover loading, empty data, errors/retry, direct fastest links with an irrelevant round parameter, season switching, independently empty fastest data while points exist, official time precision and keeping all three view controls on one row.
- Live adapter checks succeeded for every discovered season from 2018 through 2026, with 10 published fastest records each at verification time. Source: [DHL fastest pit-stop award](https://inmotion.dhl/en/formula-1/fastest-pit-stop-award).
- Live browser → local same-origin API → DHL source → rendered table verified separately from test fixtures. 2025: 10 records, first Oscar Piastri / McLaren / Monza / 1.91 s; switching to 2026 showed Arvid Lindblad / Racing Bulls / HUN / 1.99 s. No console/page errors or failed requests in the completed check.
- The dedicated live check uses Vite preview for the real F1 proxy. Only Vercel's hosted analytics script is stubbed locally to avoid sending QA visits; the pit-stop API and F1 data requests are real. The static smoke server intentionally does not proxy live F1 requests.

## Screenshots and evidence

Ignored local artifacts:

- `artifacts/browser-qa/screenshots/pit-fastest-live-desktop.png`
- `artifacts/browser-qa/screenshots/pit-fastest-live-tablet.png`
- `artifacts/browser-qa/screenshots/pit-fastest-live-mobile.png`
- `artifacts/season-fastest-live-verification.json`
- Fixture screenshots: `pit-fastest-desktop-chromium.png`, `pit-fastest-tablet-chromium.png`, `pit-fastest-mobile-chromium.png` in the same screenshots folder.

Blocking findings: none for the local feature. Production verification belongs to a separately authorized release; the public website remains the previous v1.4.0 release.
