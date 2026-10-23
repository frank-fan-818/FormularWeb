# Remaining loading performance QA

- Date: 2026-10-23 (Asia/Shanghai).
- Branch: `codex/compact-schedules-and-headings`.
- Build: `npm run build`, version 1.2.2; local QA URL `http://127.0.0.1:4173`.
- Scope: both P2 items and P3, layered on the previously completed uncommitted P0/P1 patch. No push or deployment.
- Blocking findings: none in local verification.

## Changes

News now runs through `api/news-feed.mjs`, with the same three fixed upstreams. The handler accepts only GET/HEAD, rejects redirects, imposes a four-second upstream deadline and a 1 MB streamed-body limit, and drops all upstream cookies. Successful XML receives a dedicated five-minute Vercel CDN policy with background revalidation. Upstream errors, 429s, HTML and oversized responses get no-store. Browser requests retain the `/news-feed/{source}` contract. The local production server uses this same handler.

Jolpica's external rewrite explicitly opts into rewrite caching and sets `Vercel-CDN-Cache-Control`, rather than depending on the browser-facing Cache-Control alone. Private analytical data routes remain outside this cache policy.

Primary race classifications use a fetch-based API without the legacy axios/history module. Completeness, duplicate-driver and schema checks are retained. Analytics, FIA, weekend preview and deferred session APIs load only when requested. Optional database session discovery waits for primary classifications to settle; schedule-driven tabs and direct Sprint requests remain available meanwhile. Deferred telemetry summaries guard the analytics object identity to avoid displaying another race's summary.

Interactive calendar/classification requests have at most two four-second attempts and a ten-second total budget including backoff. A Retry-After beyond the remaining budget surfaces an error instead of prolonging the spinner. Classification requests abort on race change/unmount. News has a single six-second client attempt and retains the P1 cached fallback.

## Measurements and monitoring

Built RaceLayout + RaceResults static JS closure:

| Metric | Before | After |
| --- | ---: | ---: |
| Uncompressed JS bytes | 1,361,420 | 1,069,773 |
| Static chunks | 60 | 58 |

This is about 21.4% less static JavaScript. It is a bundle comparison, not a claim of equivalent percentage improvement in production latency. `scripts/check-race-critical-dependencies.mjs` now enforces a 1.1 MB cap and excludes optional API chunks; it is included in `npm run budget:performance`. The existing homepage gzip budget passes without raising its limit.

Production structured logs record source request outcome/duration, actual classification retries, and first usable news/classification data after its loader starts. The browser Performance timeline exposes the latest measurement under `f1:news_first_content`, `f1:classification_results`, `f1:classification_qualifying`, `f1:race_content_race_results`, `f1:race_content_qualifying_results`, and `f1:race_retry` (plus source request names). Existing Web Vitals continue to measure document loading. Content metrics measure loader-to-data readiness, not DOM paint or time spent downloading the route before the loader mounts.

If `VITE_PERFORMANCE_ENDPOINT` points to a same-origin collector, metrics are also sent with sendBeacon; otherwise they remain in structured browser logs and Performance entries. No new telemetry service/account is provisioned and no tokens or response bodies enter metrics. Configure a collector if centralized retention/alerts are required.

## Verification

- Unit suite: 105 files / 604 tests passed.
- Deployment verification: 11 Node tests passed, covering handler caching, cookies, invalid sources/methods, oversized/HTML/error responses and existing production boundaries.
- Production build, TypeScript, strict full-repository ESLint and UTF-8 encoding checks passed.
- Performance budgets passed, including the new RaceDetail static dependency guard.
- Browser suite: 94 passed / 23 existing project/viewport exclusions across news, progressive race loading, sprint resilience and smoke tests. A final desktop rerun of all six sprint/analysis resilience cases also passed after the summary identity guard.
- Routes: `/news`, Reddit category, race overview/qualifying tabs, Sprint, practice fallback, race intelligence and analysis; required smoke routes `/`, `/races`, `/races/1`, `/drivers/max_verstappen`, `/constructors/red_bull`, `/circuits/monaco`, account/settings/privacy and unknown-route flows.
- Viewports: desktop 1440×900, mobile 375×812, tablet 768×1024; existing detailed-route exclusions remain. Instrumented flows found no unexpected console/page errors or failed requests; mocked upstream outages and aborted requests are intentional.
- Screenshot evidence remains in `artifacts/browser-qa/screenshots/news-progressive-*.png`, `news-cached-*.png`, and `race-progressive-*.png`. No visual redesign was introduced in this follow-up.

## Post-deployment check

The proxy and headers are implemented and locally tested. Actual regional CDN HIT/STALE behavior, cold function latency, and live Reddit availability must be checked after deployment. Request the same public URL repeatedly without cache-busting, inspect `x-vercel-cache`/Age, and verify errors remain no-store. The existing build warning about the logger's mixed static/dynamic imports remains unchanged.
