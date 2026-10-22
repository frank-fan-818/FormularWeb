# Vercel Web Analytics integration

- Date: 2026-10-22
- Branch: `codex/paddock-news-and-reddit`
- Build or dev URL: production build served at `http://127.0.0.1:4173`
- Routes checked: `/`, `/races`, `/races/1`, `/drivers/max_verstappen`, `/constructors/red_bull`, `/circuits/monaco`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/privacy`, `/settings`, and the unknown-route fallback.
- Viewports checked: desktop Chromium, 1440 x 900. Layout was unchanged.
- Findings: mounted `@vercel/analytics/react` once beside `App`, gated by `import.meta.env.PROD`. Local QA serves a no-op script at the Vercel-managed analytics script path; it does not submit real visits. The 13 existing route smoke checks passed with no console/page errors or failed first-party assets under the existing API fixtures.
- Validation: 101 unit test files / 586 tests passed; production build, strict ESLint, UTF-8 encoding checks, deployment configuration checks and 8 deployment tests passed. Unit tests needed a workspace-local temporary directory because the sandbox temporary directory denied cache renames; browser QA needed localhost access outside the sandbox. Existing logger chunking and terminal color warnings remain.
- Blocking: no local blockers. Real page-view collection and SPA navigation tracking must be verified after deployment to the Analytics-enabled Vercel project; local no-op script coverage does not establish ingestion.
- Screenshot paths: existing smoke-test screenshots are under `artifacts/browser-qa/test-results/` (ignored). No new visual layout evidence was required.
- Change type: `chore:` analytics integration; version remains `1.2.0`. No commit, push or deployment was performed.

## PR #84 CI repair

- CI run `39740619655` failed the 92 KiB home critical-JS budget (94679 bytes on Linux). The same graph measured 94939 bytes in the local build. Analytics had been statically imported into the application entry.
- Replace the mounted React wrapper with a production-only dynamic SDK import and `inject`. The SDK starts automatic page-view tracking when available; an unavailable optional chunk is caught without breaking the application. The budget limit is unchanged.
- Browser QA's three deterministic failures expected `CharlesLeclerc`; update that old assertion to the intentionally spaced `Charles Leclerc` heading. The run also reported one Firefox first-visit retry; it was not a deterministic failed case.
- Added browser coverage for analytics initializing once across real client-side navigation and for navigation remaining usable when the analytics chunk fails. All 24 selected analytics/driver-profile cases passed across desktop, mobile and tablet Chromium.
- Fresh local validation: 101 unit files / 586 tests; build; unchanged performance budgets (initial JS 80.3 KiB, home 91.8 KiB, Race Info 312.4 KiB, Race Analysis 441.0 KiB, charts 191.5 KiB gzip); seven Service Worker checks; strict lint; encoding and security checks passed.
- Five-run Lighthouse gate passed: performance 0.96, accessibility 0.96, best practices 1.00, SEO 1.00. Advisory dependency-tree/unused-JavaScript warnings remain; one legacy audit is unavailable in the current Lighthouse version.
- Classified as `perf:`; prepare patch version `1.2.1` in package and lockfile. No budget threshold, CI retry policy or production analytics endpoint was relaxed.
