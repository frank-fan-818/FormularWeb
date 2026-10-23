# Loading state QA

- Date: 2026-10-23
- Branch: codex/remove-race-analysis-summary (local uncommitted batch)
- Build: production bundle served temporarily at http://127.0.0.1:4173 during Playwright checks.
- Viewports: desktop 1440×900, tablet 768×1024, mobile 375×812; light/dark and reduced-motion states.
- Routes: home, standings, race list, race detail/results/info, driver and constructor profiles/archives, circuit detail.

## Findings and changes

- Replaced all application-authored grey skeleton bars with a small shared red ring and contextual loading text.
- Removed the old beacon's decorative scan, stage legend, progress segments and LIVE DATA LINK label.
- Updated prediction, recent winners, upgrades, weather, analysis panels, charts/tables, profiles, home/standings, race layout/sprint, route and circuit image placeholders.
- Matched Ant Design table spinners to the ring and disabled rotation for reduced motion.
- Preserved error, empty, retry, data availability and lazy-loading behavior. Submission buttons retain their existing pending feedback.
- Home uses the shared loader styles directly to keep its critical JavaScript within the existing 92 KiB budget.

## Validation

- 608 unit tests passed; strict lint, TypeScript/production build and UTF-8 encoding checks passed.
- Browser coverage passed: 48 loading/prediction/history/circuit cases, three chart keyboard/pagination/theme cases, and six required route smoke cases. The old prediction skeleton selector was updated and its three retry-flow cases rerun successfully.
- Delayed requests show contextual status, then leave the loading state on completion. Prediction empty, service failure and retry recovery paths pass.
- Performance budgets passed: initial JS 80.4 KiB gzip; Home path 91.9 KiB gzip; optional analysis APIs remain outside the race critical dependency path.
- No blocking findings. Browser screenshots are under ignored artifacts/browser-qa/screenshots/; the summary preview is loading-modules-preview.png.
- No commit, push, merge or deployment performed.

## Release validation follow-up (1.2.5)

- After explicit submission/deployment authorization, PR #87 exposed a first-paint regression: the Chinese route fallback requested the extended Hanzi subset before the account page appeared. This caused the account font-request assertion to fail in all five browser projects and Lighthouse LCP to exceed 2.5 seconds.
- Added route fallback copy to the core font subset and a glyph-discovery regression assertion. Font synchronization and verification passed without changing the quality gates.
- Local five-run Lighthouse gate passed after the fix: median LCP approximately 2.44 seconds, performance 0.96, accessibility 0.96, best practices 1.00 and SEO 1.00. No extended Hanzi request appeared in any report.
- All five account first-frame browser checks passed after the fix; production build, performance budgets, source security and UTF-8 checks passed again. Full CI and production verification remain release gates.
