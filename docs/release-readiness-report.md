# Release Readiness Report

Date: 2026-07-28
Candidate version: 0.12.0

## Outcome

The repository is now a release candidate rather than a development-only
dashboard. Automated gates cover source quality, dependency risk, secrets,
database policy regressions, unit coverage, production builds, bundle budgets,
Lighthouse, and multi-viewport browser smoke tests.

Production release is conditional only on the deployment-time items listed
below. Those actions depend on the target Supabase and hosting projects and
cannot be proven by repository checks alone.

## Gap closure

| Area | Before | Release-candidate state |
| --- | --- | --- |
| Authentication | Login UI did not create a real session | Supabase sign-in, sign-up, reset, recovery, session restore, and sign-out |
| Database writes | Temporary anonymous write policies and browser-capable admin scripts | Cleanup migrations, service-role-only admin scripts, RLS, public read-only data, caller-secured view, authenticated diagnostic inserts bound to `auth.uid()` |
| Dependency security | High and critical findings in runtime/tooling dependencies | Zero high or critical findings; two no-fix moderate React Router advisories are mitigated and recorded |
| Secret handling | Manual review only | Release-candidate scan covers tracked and untracked files, ignored env files, private keys, credential patterns, unsafe SQL grants, and dangerous browser sinks |
| CI | Tests/build with permissive lint | Strict lint, types, coverage, audit, CodeQL, Dependabot, build, bundle budgets, Lighthouse, and browser QA |
| Routing | No product 404 and untrusted cached search route reached `navigate` | Branded 404 plus a tested same-origin route boundary |
| Privacy | No user-facing account/diagnostic disclosure | Privacy page and recovery-safe URL redaction |
| Data delivery | Direct upstream browser requests could fail CORS | Same-origin development, preview, and Vercel proxy |
| Resilience | No production offline shell | Versioned service worker with bounded data caching and stale-cache cleanup |
| Performance | Search eagerly loaded Supabase; route waterfall | Intent-loaded search/i18n, eager home shell, 96.1 KiB gzip home path |
| Browser quality | No repeatable release evidence | Desktop 1440×900, tablet 768×1024, mobile 375×812; console, asset, route, and overflow assertions |
| Release process | No single reproducible gate | `npm run quality:check`, release checklist, security policy, SemVer 0.12.0 |

## Verified evidence

- 38 unit-test files and 228 tests passed.
- Coverage gate passed at 44.92% statements, 39.38% branches,
  46.16% functions, and 44.99% lines.
- Strict ESLint and TypeScript checks passed.
- Production build and service-worker generation passed.
- Initial/home JavaScript path: 96.1 KiB gzip.
- Race Info path: 317.3 KiB gzip.
- Race Analysis shell: 437.7 KiB gzip.
- Largest JavaScript chunk: 135.4 KiB gzip.
- Lighthouse: performance 0.98, accessibility 0.95,
  best practices 1.00, SEO 1.00.
- Browser QA: 23 applicable tests passed across desktop, tablet, and mobile;
  10 intentionally redundant compact-viewport data routes were skipped.
- Live Jolpica proxy check returned HTTP 200 and a valid `MRData` payload.
- Dependency gate found zero high or critical vulnerabilities.
- Secret/policy scan passed across tracked and untracked release-candidate files.

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

## Required deployment-time checks

1. Apply `scripts/sql/2026-07-28-production-security-hardening.sql` to the
   intended Supabase project after taking a schema backup.
2. Verify the production anonymous key, URL, and Auth `/login` redirect
   allow-list; keep the service-role key in protected server/CI secrets only.
3. Run read/write permission probes with anonymous, authenticated, and
   service-role identities.
4. Deploy the saved build, verify CSP/security/cache headers and the
   `/f1-api` rewrite on the production URL, then complete
   `docs/release-checklist.md`.
5. Confirm GitHub CodeQL/Dependabot checks and branch protection are enabled
   before tagging `v0.12.0`.
