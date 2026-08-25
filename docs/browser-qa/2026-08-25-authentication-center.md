# Authentication Center Browser QA

- Date: 2026-08-25
- Branch: `feature/extreme-page-load-performance`
- Build or dev URL: `http://127.0.0.1:4173` (production build served by `scripts/serve-dist.mjs`)
- Routes checked: `/`, `/races`, `/races/1`, `/drivers/max_verstappen`, `/constructors/red_bull`, `/circuits/monaco`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/privacy`, `/settings`, and not-found.
- Viewports checked: 1440x900, 768x1024, 375x812.
- Findings: The authentication routes render in the standalone shell without the application sidebar or header. Desktop uses the split brand/form layout. Mobile puts the form first, has no horizontal overflow, and keeps all controls reachable with normal vertical scrolling. No console/page errors or failed first-party document, script, stylesheet, or font requests were detected.
- Blocking: None.
- Screenshot paths: `artifacts/browser-qa/test-results/smoke--login-renders-without-a-browser-error-desktop-chromium/login.png`, `artifacts/browser-qa/test-results/smoke--login-renders-without-a-browser-error-mobile-chromium/login.png`, and corresponding `register`, `forgot-password`, and `reset-password` test-result folders.

## Verification

- `npm test -- --run`: 49 files, 276 tests passed.
- `npm run type-check`: passed.
- `npm run lint -- --max-warnings 0`: passed.
- `npm run build`: passed.
- Authentication-route browser QA: 12 passed across desktop, tablet, and mobile.
- Full non-service-worker browser smoke: 38 passed, 19 expected project/viewport skips.
- `npm run encoding:check`: 267 UTF-8 source files passed.
- `git diff --check`: passed.
