# Compact home weekend schedule

- Date: 2026-10-22
- Branch: `codex/paddock-news-and-reddit`
- Build or dev URL: `http://127.0.0.1:4173`, production build.
- Routes checked: `/`, `/races`, `/races/1`, `/drivers/max_verstappen`, `/constructors/red_bull`, `/circuits/monaco`, account routes, privacy, settings and the unknown-route fallback using the existing smoke fixtures. Timezone navigation/reload regression also checks `/races/1/info?season=2026`.
- Viewports checked: Chromium desktop 1440 x 900, tablet 768 x 1024, mobile 375 x 812. Reviewed light/dark schedule screenshots.
- Findings: replaced separate tall cards with a shared five-column strip on desktop and five compact rows on mobile/tablet. Removed duplicate session codes and repeated upcoming labels. Dates are month/day only, without weekdays; next/live/completed states remain explicit. Timezone handling, date/time fallbacks and loading/error/empty flows are unchanged. No new chart or data-fetching logic.
- Validation: 101 unit-test files / 586 tests passed. Build, strict ESLint, UTF-8 and diff whitespace checks passed. Selected existing browser suites: 40 passed, 8 intentional viewport skips. No console/page errors in those routes; timezone checks reported no unexpected failed requests. Manual mobile dark-mode sprint fixture verified sprint qualifying, sprint, live/completed labels, absence of weekdays, zero page overflow and no console/network errors. Live status text uses the dark-theme red text token (`rgb(255, 138, 128)`).
- Blocking: no local blockers or unresolved layout issues found. Preview data is mocked for deterministic screenshots; no production deployment was performed.
- Screenshot paths: `artifacts/browser-qa/screenshots/typography-schedule-{light,dark}-{desktop,mobile,tablet}-chromium.png`; `artifacts/browser-qa/screenshots/home-schedule-sprint-dark-mobile.png`.
- Change scope: `src/pages/Home.tsx` and `src/pages/Home.css`, with design/QA notes. `style:` presentation cleanup; version remains `1.2.0`. Not committed or pushed.
