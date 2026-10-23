# Remaining loading performance work

Scope: finish both P2 items and P3 on top of the uncommitted P0/P1 changes. Keep prepared version 1.2.2 for this combined perf patch. Do not publish.

1. Test then implement a fixed-source news proxy: HTTPS allowlist, GET/HEAD only, bounded upstream time/body, no forwarded cookies, cache successful XML for five minutes; errors use no-store. Add explicit external rewrite caching headers for Jolpica. Exercise the production handler in local QA.
2. Remove optional analytics API modules from the synchronous RaceLayout dependency graph. Keep classification completeness/schema checks. Start primary queries without loading the legacy axios/history API. Preserve lazy session fallbacks and existing summary calculations.
3. Bound interactive classification requests to two four-second attempts and total ten-second budget, including Retry-After. Cancel requests when leaving a race. News has one six-second attempt. Record request outcome, duration, retries and first usable news/classification time through structured production logs and the browser Performance timeline; use the existing optional telemetry endpoint when configured.
4. Run targeted regression tests first, full tests, production build, deployment/config/encoding/lint checks and browser news/race plus required route smoke QA. Compare built static dependency closures before/after. Report local evidence separately from post-deployment CDN hit verification.

Completed. Evidence and monitoring definitions: `docs/2026-10-23-loading-performance-qa.md`.
