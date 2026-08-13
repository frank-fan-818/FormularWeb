# Release Readiness Report

Date: 2026-07-28
Candidate version: 0.12.3

## Outcome

The repository is now a release candidate rather than a development-only
dashboard. Automated gates cover source quality, dependency risk, secrets,
database policy regressions, unit coverage, production builds, bundle budgets,
Lighthouse, and multi-viewport browser smoke tests.

The repository evidence below was re-run for the 0.12.3 candidate. Production
database and authentication verification from 0.12.1 remains the baseline;
the production rollout requirements at the end of this report must be checked
again for the exact 0.12.3 release commit.

## Gap closure

| Area | Before | Release-candidate state |
| --- | --- | --- |
| Authentication | Login UI did not create a real session | Supabase sign-in, sign-up, reset, recovery, session restore, and sign-out |
| Database writes | Temporary anonymous write policies and browser-capable admin scripts | Cleanup migrations, service-role-only admin scripts, RLS, public read-only data, caller-secured view, authenticated diagnostic inserts bound to `auth.uid()` |
| Dependency security | High and critical findings in runtime/tooling dependencies | Zero high or critical findings; two no-fix moderate React Router advisories are mitigated and recorded |
| Secret handling | Manual review only | Release-candidate scan covers tracked and untracked non-ignored files, rejects tracked env/private-key files, and checks credential patterns, unsafe SQL grants, and dangerous browser sinks |
| CI | Tests/build with permissive lint | Strict lint, types, coverage, audit, Semgrep OSS, workflow safety validation, Dependabot, build, bundle budgets, Lighthouse, and browser QA |
| Routing | No product 404 and untrusted cached search route reached `navigate` | Branded 404 plus a tested same-origin route boundary |
| Privacy | No user-facing account/diagnostic disclosure | Privacy page and recovery-safe URL redaction |
| Data delivery | Direct upstream browser requests could fail CORS | Same-origin development, preview, and Vercel proxy |
| Resilience | No production offline shell | Content-versioned service worker with multi-tab build coordination, bounded data caching, and client-confirmed stale-shell cleanup |
| Performance | Search eagerly loaded Supabase; route waterfall | Intent-loaded search/i18n, eager home shell, and enforced route budgets |
| Browser quality | No repeatable release evidence | Desktop 1440×900, tablet 768×1024, mobile 375×812; console, asset, route, and overflow assertions |
| Release process | No single reproducible gate | `npm run quality:check`, release checklist, security policy, SemVer 0.12.3 |

## Verified evidence

- 40 unit-test files and 240 tests passed.
- Coverage gate passed at 46.00% statements, 40.02% branches,
  46.86% functions, and 46.13% lines.
- Strict ESLint and TypeScript checks passed.
- Production build and service-worker generation passed.
- Initial/home JavaScript path: 119.6 KiB gzip.
- Race Info path: 338.1 KiB gzip.
- Race Analysis shell: 458.5 KiB gzip.
- Largest JavaScript chunk: 133.8 KiB gzip.
- Lighthouse median across five independent runs: performance 0.97, accessibility 1.00,
  best practices 1.00, SEO 1.00.
- Browser QA: 29 applicable tests passed across desktop, tablet, and mobile;
  16 intentionally redundant viewport-specific interaction checks were skipped.
- The browser suite exercises a real two-tab Service Worker upgrade, proves
  both in-memory builds reload, and verifies the previous shell is only pruned
  after every client reports the current build.
- Live Jolpica proxy check returned HTTP 200 and a valid `MRData` payload.
- Dependency gate found zero high or critical vulnerabilities.
- Secret/policy scan passed across tracked and untracked release-candidate files.
- Production Supabase verification found zero browser write grants, zero
  unexpected browser write policies, zero public-read tables missing RLS, and
  12 matching public-read policies.
- The Supabase security advisor returned no issues after the migration.
- Supabase Auth `site_url` is `https://formular-web.vercel.app` and its
  redirect allow-list contains `https://formular-web.vercel.app/login`.
- Both temporary Supabase management tokens used for deployment verification
  were deleted locally and revoked from the account.

## Accepted and bounded residuals

- React Router 6 has two no-fix moderate advisories. The SSR path is not used,
  and untrusted navigation is rejected by `isSafeInternalRoute`. See
  `docs/security-risk-register.md`.
- Aggregate coverage is an enforced baseline, not a final ceiling. Pure
  utilities are well covered; large database adapters and React hooks remain
  the priority for future test growth. The threshold must only move upward.
- Lighthouse still reports non-blocking render-chain diagnostics. Core Web
  Vitals and the blocking score thresholds pass; further CSS extraction is an
  optimization opportunity, not a release blocker.

## Production rollout requirements

1. Apply `scripts/sql/2026-07-28-production-security-hardening.sql`
   transactionally to the production project and re-run it to prove
   idempotency.
2. Read back grants and policies: anonymous users must remain read-only, while
   authenticated users may only insert their own redacted diagnostic rows.
3. Read back the Supabase Auth production site URL and `/login` redirect URL.
4. Deploy the exact `v0.12.3` release commit to Vercel, then verify security
   and cache headers, critical routes, missing-asset 404 behavior, the
   Service Worker build ID, and the `/f1-api` rewrite on the production URL.
5. Keep the previous production deployment as the rollback target and review
   post-release error-log volume.
