# Release Readiness Report

Date: 2026-07-28
Candidate version: 0.12.1

## Outcome

The repository is now a release candidate rather than a development-only
dashboard. Automated gates cover source quality, dependency risk, secrets,
database policy regressions, unit coverage, production builds, bundle budgets,
Lighthouse, and multi-viewport browser smoke tests.

The production database and authentication configuration have now been
hardened and verified against the intended Supabase project. The final
repository gate and Vercel deployment verification are recorded below.

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
| Release process | No single reproducible gate | `npm run quality:check`, release checklist, security policy, SemVer 0.12.1 |

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

## Production rollout verification

1. `scripts/sql/2026-07-28-production-security-hardening.sql` was applied
   transactionally to project `zmihswdvixurhjjsazrl` and re-run to verify
   idempotency.
2. Anonymous and authenticated write grants were removed from all public
   application tables. The only retained browser write policy is the
   authenticated, user-bound diagnostic insert policy.
3. Supabase Auth production site and `/login` redirect URLs were written
   through the Management API and independently read back.
4. The Vercel production deployment, security/cache headers, critical routes,
   and `/f1-api` rewrite are verified after the `v0.12.1` release commit.
5. Post-release monitoring remains an ongoing operational responsibility.
