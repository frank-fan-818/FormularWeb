# Extreme Page Load Performance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce cold first paint, route transition, warm data response, and below-fold rendering cost across every core route without weakening correctness, accessibility, security, or recovery.

**Architecture:** Keep the React 18/Vite SPA. Remove non-essential entry dependencies, centralize route import loaders for intent prefetch, add bounded public-data caching at edge and Service Worker layers, isolate below-fold rendering, and enforce tighter regression budgets.

**Tech Stack:** React 18, TypeScript, Vite 8, React Router 6, Vitest, Service Worker Cache API, Vercel routing, Lighthouse, Playwright.

---

### Task 1: Freeze baseline and product contract

**Files:**
- Create: `docs/product-requirements-document.md`
- Create: `docs/plans/2026-08-19-extreme-page-load-performance-design.md`
- Create: `docs/plans/2026-08-19-extreme-page-load-performance.md`

**Steps:**
1. Record current build gzip values and five Lighthouse runs.
2. Define user journeys, page contracts, loading states, SLOs and non-goals.
3. Document first-principles cost model and rejected approaches.
4. Confirm all later changes map to a measured cost.

### Task 2: Replace heavy document-head dependency

**Files:**
- Create: `src/components/DocumentHead.tsx`
- Create: `src/components/DocumentHead.test.tsx`
- Modify: `src/App.tsx`
- Modify: all pages importing `react-helmet-async`
- Modify: `package.json`
- Modify: `package-lock.json`

**Steps:**
1. Write failing tests for title and description updates.
2. Implement a small DOM-effect component.
3. Replace Helmet usage with explicit props.
4. Remove the dependency.
5. Run the targeted test and type check.

### Task 3: Remove date-library tax

**Files:**
- Create/Modify: `src/utils/dateTime.ts`
- Create/Modify: `src/utils/dateTime.test.ts`
- Modify: `src/hooks/useRaceStatus.ts`
- Modify: `src/hooks/useRaceStatus.test.ts`
- Modify: `src/utils/raceSchedule.ts`
- Modify: date-using pages and context
- Modify: `package.json`, `package-lock.json`

**Steps:**
1. Add failing UTC/local-day and format tests.
2. Implement native Date/Intl helpers with invalid-input handling.
3. Replace dayjs call sites.
4. Remove dayjs.
5. Run targeted tests and type check.

### Task 4: Defer non-critical runtime

**Files:**
- Create: `src/bootstrap/runtime.ts`
- Create/Modify: runtime unit tests where pure decisions are extracted
- Modify: `src/main.tsx`

**Steps:**
1. Keep React rendering as the only synchronous entry task after i18n.
2. Dynamically import Web Vitals and production recovery runtime after render/idle.
3. Preserve stale chunk, SW multi-tab and error-reporting semantics.
4. Run stale-chunk/SW browser tests later as a hard gate.

### Task 5: Centralize and prefetch route modules

**Files:**
- Modify: `src/router/index.tsx`
- Modify: `src/utils/routePreload.ts`
- Create/Modify: `src/utils/routePreload.test.ts`
- Modify: `src/components/Layout.tsx`
- Modify: `src/pages/Race/RaceLayout.tsx`

**Steps:**
1. Write tests for pathname-to-loader selection and constrained networks.
2. Export shared route loaders and prefetch functions.
3. Attach intent handlers to global navigation and race tabs.
4. Verify repeated intent is harmless and failed prefetch does not block navigation.

### Task 6: Add bounded API caching

**Files:**
- Modify: `vite.config.ts`
- Modify: `vercel.json`
- Modify: `scripts/verify-deployment-config.mjs`
- Modify: `scripts/verify-built-service-worker.mjs`
- Modify: associated policy tests

**Steps:**
1. Add failing policy assertions for `/f1-api` cache headers and SW strategy.
2. Add Vercel shared cache headers.
3. Add SW stale-while-revalidate for successful JSON GET responses only.
4. Bound entry count and preserve network/cache fallback semantics.
5. Build and verify generated `sw.js`.

### Task 7: Defer below-fold rendering

**Files:**
- Modify: `src/pages/Home.tsx`
- Modify: `src/pages/Home.css`

**Steps:**
1. Mark non-critical sections with a semantic performance class.
2. Add progressive `content-visibility` with intrinsic size.
3. Ensure masthead/LCP content is never deferred.
4. Verify desktop/mobile screenshots and no scroll jumps.

### Task 8: Tighten budgets and measure

**Files:**
- Modify: `scripts/check-performance-budget.mjs`
- Modify: `.lighthouserc.cjs` only where stable evidence supports it
- Create: `docs/performance-optimization-report-2026-08-19.md`

**Steps:**
1. Build production assets.
2. Compare manifest dependency graph and gzip sizes with baseline.
3. Tighten budgets below the new measured result with safe headroom.
4. Run five Lighthouse passes and record every run.
5. Reject any change that improves bundle size but worsens median LCP/TBT materially.

### Task 9: Full verification and adversarial review

**Files:**
- Modify: `docs/performance-optimization-report-2026-08-19.md`
- Create/update: browser QA report and screenshots only when layout evidence changes

**Steps:**
1. Run targeted tests.
2. Run strict lint, types, full coverage, build, SW verification and budgets.
3. Run Lighthouse five times.
4. Run browser QA on required routes and viewports.
5. Inspect console/network failures and offline/cache behavior.
6. Perform adversarial diff review for correctness, cache poisoning, stale data, request storms, accessibility and rollback.
7. Report residual physical limits separately from fixable debt.

