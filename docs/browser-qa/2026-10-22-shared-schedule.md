# Shared compact weekend schedules

- Date: 2026-10-22
- Branch: `codex/paddock-news-and-reddit`
- Build or dev URL: production build at `http://127.0.0.1:4173`.
- Routes checked: `/`, `/races`, `/races/1`, `/races/13/info?season=2026`, `/races/1/info?season=2026`, `/drivers/max_verstappen`, `/constructors/red_bull`, `/circuits/monaco`, account routes, settings, privacy and the unknown-route fallback.
- Viewports checked: desktop 1440 x 900, tablet 768 x 1024, mobile 375 x 812 in Chromium; inspected home/detail schedule screenshots in light and dark themes.
- Findings: home and race details share one compact schedule stylesheet. Race details show the session label/status above date/time on desktop, with aligned compact rows on smaller viewports. Weekday groups, duplicate codes, source subtitle and repeated upcoming states are removed. Collected-result/live/completed/next labels, timezone formatting, empty state and circuit facts remain. No API contracts, fetching or scoring changed. The React review found no added state/effects, hook-order violations, unstable list keys or unnecessary memoization.
- Validation: targeted scheduling tests (7) and full unit suite (101 files / 586 tests) passed; production build, strict ESLint, UTF-8 and whitespace checks passed. Selected browser suites passed 43 tests with 8 existing viewport skips. A final repeat of the 3 detail-schedule cases passed with explicit console/page-error and failed-request assertions (known private-data 404 responses and aborted navigation requests are excluded). Timezone regression verifies session dates across midnight, navigation and reloads, including fractional and negative offsets.
- Blocking: no local blockers. Screenshots use deterministic fixture data. Existing build logger-chunking and terminal color warnings remain; no production verification is implied.
- Screenshot paths: `artifacts/browser-qa/screenshots/weekend-brief-{light,dark}-{desktop,mobile,tablet}-chromium.png` and the existing `typography-schedule-{light,dark}-{desktop,mobile,tablet}-chromium.png` files.
- Change scope: shared stylesheet, home markup/style, race overview markup/style, main stylesheet import and two existing browser regressions. `style:` presentation cleanup; version remains `1.2.0`. No commit, push or deployment performed.
