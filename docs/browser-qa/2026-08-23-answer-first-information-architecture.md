# Answer-first information architecture QA — 2026-08-23

## Scope

- Home answer surface, championship facts, and race-weekend timeline
- Persistent current/next race signal
- Race information session states and previous/next race navigation
- Championship summary and decorative Chinese microcopy removal

## Viewports and routes

- Desktop: 1440 × 900
- Tablet: 768 × 1024
- Mobile: 375 × 812
- Routes: `/`, `/races`, `/races/12/info?season=2026`, `/drivers/antonelli`, `/constructors/mercedes`, `/circuits/zandvoort`

No tested route had horizontal page overflow, uncaught console errors, warning logs, or literal `\\uXXXX` text. The persistent race signal appeared on every non-home route. Desktop, tablet, and mobile screenshots are stored in `artifacts/browser-qa/manual/`.

## Automated evidence

- Unit tests: 48 files, 268 tests passed before the adversarial additions
- Browser suite: 30 passed, 19 skipped by project configuration
- Production build, strict lint, type check, UTF-8 encoding check, service-worker verification, deployment verification, and performance budget passed
- Performance budget after CSS cleanup: initial JS 83.8 KiB gzip; home path 89.4 KiB gzip

## Adversarial review

| Attack | Result | Action |
| --- | --- | --- |
| Current race weekend counted as “waiting” | Found | Changed the label to “未完成” and added a current-weekend unit test. |
| Session has a date but no published time | Covered | Timeline keeps it visible as “时间待定”; added a scheduled-state test. |
| Standings API returns an empty or failed resource | Found | Home facts now distinguish loading, unavailable, and empty states. |
| Sprint and standard weekends use different session sets | Passed | Timeline derives only sessions present in the race payload. |
| Long race, driver, constructor, and circuit names | Passed | Fact cells truncate locally; mobile page width remains within the viewport. |
| Decorative Chinese phrases return elsewhere | Passed | Removed the targeted slogan patterns from rendered page copy; SEO descriptions and operational status text remain. |
| First-load CSS or shell JS exceeds the existing budget | Found and fixed | Deleted obsolete home CSS and lazy-loaded the persistent signal component. |
| Mobile actions are too small for touch | Found and fixed | Home primary and secondary actions now have a 44 px minimum height. |

## Screenshots

- `artifacts/browser-qa/manual/home-desktop.png`
- `artifacts/browser-qa/manual/home-tablet.png`
- `artifacts/browser-qa/manual/home-mobile.png`
- `artifacts/browser-qa/manual/home-mobile-full-bleed.png`
- `artifacts/browser-qa/manual/race-info-desktop.png`
- `artifacts/browser-qa/manual/race-info-mobile.png`
