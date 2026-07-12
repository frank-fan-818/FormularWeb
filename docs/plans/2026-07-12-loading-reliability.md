# Loading Reliability Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Formula 1 data loading fast, partially recoverable, stale-safe, observable, and guarded by performance tests.

**Architecture:** A shared request policy handles cancellation, timeout, retry, and error classification. Hooks keep versioned fresh/stale snapshots and expose resource-level freshness while page aggregates use partial-success semantics. Static assets receive conservative service-worker caching and CI receives explicit budgets.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Axios, Supabase, IndexedDB/localStorage adapters, Workbox.

---

### Task 1: Request policy

**Files:** Modify `src/utils/withRetry.ts`; test `src/utils/withRetry.test.ts`.

- Add abort-aware attempt factories, timeout errors, retry jitter, and network-error classification.
- Verify cancellation, timeout cleanup, retry limits, and non-retryable errors.

### Task 2: Last-known-good cache

**Files:** Modify `src/hooks/useCachedData.ts`; test `src/hooks/useCachedData.test.ts`.

- Add fresh/stale cache reads and freshness metadata.
- Make persistent writes best-effort.
- Prevent obsolete requests from committing hook state.

### Task 3: Partial season data

**Files:** Modify `src/hooks/useSeasonDataCached.ts`; add `src/hooks/useSeasonDataCached.test.ts`.

- Cache standings and races independently.
- Preserve successful resources when another resource fails.
- Expose aggregate loading/error/stale state without blanking available data.

### Task 4: Visible degraded state

**Files:** Modify `src/pages/Home.tsx`, `src/pages/Home.css`.

- Display stale/offline/update failure status without replacing valid content.
- Keep initial empty loading and empty/error explanations distinct.

### Task 5: Static delivery and budgets

**Files:** Modify `vite.config.ts`; add performance-budget configuration/tests as appropriate.

- Enable conservative precache/runtime caching for immutable assets only.
- Add measurable chunk and Lighthouse budgets.

### Task 6: Verification

- Run targeted reliability tests.
- Run the full test suite and production build.
- Run browser QA on required routes, desktop and mobile, including offline and failed-request cases.
- Submit the result to adversarial reliability, performance, and failure-mode review.
