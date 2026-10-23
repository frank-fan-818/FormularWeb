# Progressive news and race loading QA

- Date: 2026-10-22 (Asia/Shanghai)
- Branch: `codex/compact-schedules-and-headings`
- Build URL: `http://127.0.0.1:4173` (production build served by `scripts/serve-dist.mjs`)
- Prepared version: `1.2.2` (`perf:` patch). No commit, push, or deployment performed.
- Blocking findings: none.

## Implemented scope

1. News sources publish independently through progressive API snapshots. A held FIA request does not hide Motorsport or Reddit stories. Filtering to a still-pending source shows loading rather than a false empty result.
2. All three sources restore their validated last successful payload immediately after reload and update in the background. Failed updates retain stories and their original retrieval timestamps. The existing Reddit cache key remains supported; caches older than 24 hours or with invalid/future timestamps are ignored. Storage failures do not block live requests.
3. Race and qualifying classifications publish separate data/loading/error states. Each table follows its own request, completed data remains visible during retries, and responses from a previous race are ignored. The summary distinguishes pending race results from unpublished results.

CDN configuration, route chunking, and API retry policy are unchanged (P2/P3).

## Verification

| Check | Result |
| --- | --- |
| `npm test` | 102 files, 597 tests passed |
| `npm run build` | Passed, including TypeScript compilation and font coverage sync |
| ESLint on changed TS/TSX files with `--max-warnings 0` | Passed |
| `npm run encoding:check` | Passed, 477 UTF-8 source files |
| `git diff --check` | Passed |
| News browser suite, three Chromium viewports | 36 passed |
| Progressive race browser suite, three Chromium viewports | 6 passed |
| Required-route smoke suite, three Chromium viewports | 31 passed, 8 existing compact-viewport exclusions |

Browser total: 73 passed. Response gates hold slow requests until fast content is asserted, proving independence without relying on arbitrary speed thresholds. The race suite checks both response orders and active-table loading states. News tests cover filtering, reload cache, failed updates, automatic refresh, source recovery, unsafe upstream markup, dark mode, and time zones. No unexpected console/page errors or failed network requests were observed by the instrumented flows. Intentionally unavailable upstream fixtures and cancelled requests are expected.

The first race test iteration incorrectly inspected spinners in hidden Ant Design tab panes. It was corrected to inspect the active pane, then all six race cases passed. Existing unit lifecycle coverage for visibility, timers, cancellation, and retries was retained.

## Routes and viewports

- Changed flows: `/news`, `/news?category=social`, `/races/1/results?season=2026` and the race/qualifying classification tabs.
- Smoke routes: `/`, `/races`, `/races/1`, `/drivers/max_verstappen`, `/constructors/red_bull`, `/circuits/monaco`, account routes, privacy, settings, and the unknown-route fallback.
- Desktop: 1440 × 900; mobile: 375 × 812; tablet: 768 × 1024.
- All required data routes were checked on desktop; the smoke suite retains its existing mobile/tablet exclusions for detailed data routes. Changed news and race flows ran in all three viewports.
- Desktop/mobile screenshots were visually inspected. Source timestamps wrap without overlapping controls; the race table retains its contained horizontal scrolling on mobile.

## Screenshot paths

- `artifacts/browser-qa/screenshots/news-progressive-desktop-chromium.png`
- `artifacts/browser-qa/screenshots/news-progressive-mobile-chromium.png`
- `artifacts/browser-qa/screenshots/news-cached-desktop-chromium.png`
- `artifacts/browser-qa/screenshots/news-cached-mobile-chromium.png`
- `artifacts/browser-qa/screenshots/race-progressive-qualifying-desktop-chromium.png`
- `artifacts/browser-qa/screenshots/race-progressive-results-mobile-chromium.png`

These are local, fixture-backed correctness checks. Production latency and upstream availability require verification after deployment. The production build retains the existing warning that the logger's dynamic import cannot create a separate chunk because other modules import it statically; this is outside the requested scope.
