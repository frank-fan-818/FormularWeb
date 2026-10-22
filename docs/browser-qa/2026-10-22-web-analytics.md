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
