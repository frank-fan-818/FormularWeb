# Progressive page loading implementation plan

**Goal:** Complete P0 and both P1 loading fixes: independent news sources, cached news on entry with background updates, and independent race/qualifying classifications.

**Architecture:** Keep network access and validated storage in `src/api/news.ts`; let `useNews` subscribe to progressive snapshots and ignore cancelled loads. Persist each source's last successful payload for at most 24 hours, retaining the existing Reddit cache key. Keep race identity guards while giving race and qualifying separate loading/data/error states. Preserve the existing page structure and API timeouts.

**Scope:** Use the current clean checkout. Do not change CDN configuration, route bundling, or retry policy (P2/P3). No commit, push, or deployment is requested. This is a `perf:` patch; prepare version 1.2.2 in the package manifests.

## 1. Regression tests first

- Extend `src/api/news.test.ts` for fast-source progress while another source stalls, independently restored sources, cache age and validation, and cancellation.
- Extend `src/hooks/useNews.test.tsx` for immediate cache, progressive updates, and cancelled responses, preserving existing lifecycle coverage.
- Add `src/hooks/race/useRacePrimaryResults.test.tsx` for both response orders, partial failures, retries, and race identity changes.
- Run the focused Vitest files and confirm the new tests fail before implementation.

## 2. News API and hook

- Add cached snapshots and a progress callback without changing the final `getNews` result contract.
- Validate all restored items with the existing source allowlists and normalizer. Bound persisted payload sizes and age; tolerate unavailable storage.
- Seed `useNews` from cache and publish each source as soon as it settles. Preserve old stories and retrieval timestamps when updates fail.
- Show source retrieval times and distinguish a pending source from an unavailable or empty source, including category filters.

## 3. Independent race results

- Publish race/qualifying responses separately and keep aggregate error/loading compatibility.
- Wire each result table and the qualifying route to its own loading flag. Preserve completed data during retry and ignore responses from a previous race/unmounted effect.

## 4. Verification

- Run focused tests, the complete unit suite, production build, lint/type/encoding checks appropriate to changed files.
- Add deterministic Playwright response gates proving news and classifications appear before held requests finish; prove reload cache and failed-refresh retention.
- Run news/race QA plus required-route smoke checks with desktop/mobile/tablet coverage. Inspect browser errors and unexpected failed requests, and capture desktop/mobile evidence.
- Record QA results and report any limitations. Do not publish automatically.

## Completion

Completed P0 and both P1 items. See `docs/2026-10-22-progressive-loading-qa.md` for test commands, results, routes, viewports, and screenshot evidence.
