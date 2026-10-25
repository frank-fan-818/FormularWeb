# Race page compact layout QA

- Date: 2026-10-25.
- Branch: `codex/season-fastest-pit-stop`; earlier uncommitted season-fastest work is preserved.
- Build / local URL: production build served at `http://127.0.0.1:4173`.
- Task: shorten race pages by hiding retirement names until requested and removing the qualifying fastest-lap ranking chart.

## Changes

- The retirement card keeps its label and count visible. A native `details` / `summary` disclosure starts closed; expanding it shows every driver's full name and profile link. With no retirements, the existing zero / 全员完赛 state remains and no disclosure is rendered.
- The qualifying page no longer renders the 圈速走势 ranking chart, including its shared sprint-qualifying view. Its unused ECharts lazy import, chart-option builder and memoized options were removed. Official results, sectors and teammate comparisons remain.
- Existing design tokens, typography and focus styles are reused. The summary has a visible chevron, keyboard focus indication and a touch target taller than 44px.

## Validation

- Relevant unit tests: 6 passed, including the collapsed disclosure, complete driver links, zero retirements and awaiting results.
- Production build, strict lint, UTF-8 encoding, font coverage and both performance-budget checks passed. Race static JS is 1,099,669 bytes under the existing 1,100,000-byte limit; no budget was relaxed.
- Desktop/tablet/mobile route and feature smoke: 37 passed, 8 existing platform/project skips. Routes include home, races, race details, driver, constructor, circuit, auth, privacy, settings and unknown route.
- Final feature verification after sharing the card markup: 6 Chromium cases passed across desktop 1440×900, tablet 768×1024 and mobile 375×812. Checks cover initially hidden links, expansion, reduced collapsed height, Space/Enter toggles, keyboard navigation to the fourth driver, working profile navigation, populated qualifying sector tables, chart removal and no page overflow.
- The disclosure is additionally checked in desktop Firefox and mobile WebKit. Desktop link navigation uses actual Tab presses rather than relying on browser-specific programmatic `:focus-visible` behavior; mobile checks use touch to follow the final driver's link. Both check keyboard Space/Enter on the disclosure itself. Mobile WebKit does not certify physical iOS keyboard or real-device support.
- Final disclosure run: all 5 browser/viewport projects passed (desktop Chromium, tablet Chromium, mobile Chromium, desktop Firefox and mobile WebKit).
- Browser checks assert no page errors, unexpected console errors/warnings or failed requests. WebKit's existing unused AuthShell/Login preload notices are narrowly identified in the member fixture; all other warnings remain failures. These are preload hints, not failed resource requests.
- Screenshots inspected: `artifacts/browser-qa/screenshots/race-stories-collapsed-mobile-chromium.png`, `race-stories-mobile-chromium.png`, `qualifying-compact-desktop-chromium.png` and their desktop/tablet/mobile counterparts.

Status: verified before the authorized 1.5.0 submission; production deployment is separate. No product-blocking findings remain in the completed checks.

## Follow-up: sprint qualifying chart

The user also requested removal of the matching ranking bar in the separate `/races/:round/sprint` page's sprint-qualifying tab. Removed that card, its chart-option memo and unused ranking-chart import. The existing sector-ranking table remains part of the populated-data check, so loading/empty handling does not depend on the removed chart.

- `sessionData.test.ts`: 7 tests passed.
- Strict lint, production build, UTF-8 and both performance budgets passed; race static JS is 1,099,671 bytes.
- The existing populated Sprint classification browser test now checks that the SQ sector table is visible while the 圈速走势 heading and chart panel are absent. All 3 desktop/tablet/mobile cases passed, including switching to the Sprint race results afterward; no console errors were recorded.
- New screenshots: `artifacts/browser-qa/screenshots/sprint-qualifying-compact-desktop-chromium.png`, `sprint-qualifying-compact-tablet-chromium.png` and `sprint-qualifying-compact-mobile-chromium.png`.
- This follow-up is included in the authorized 1.5.0 submission; production deployment is separate.
