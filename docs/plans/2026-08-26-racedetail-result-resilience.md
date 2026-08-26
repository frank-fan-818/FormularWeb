# RaceDetail Result Resilience Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make RaceDetail preserve official race and qualifying classifications when FastF1 analysis is cancelled, unavailable, or degraded, including React StrictMode development runs.

**Architecture:** Keep the shared FastF1 request independent from any one React subscriber, then race each caller against its own abort signal. Add a reusable official-classification component so route-level analysis pages can always render primary Jolpica results without duplicating table behavior.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Playwright, Ant Design.

---

### Task 1: Reproduce subscriber cancellation

**Files:**
- Modify: `src/api/fastf1Analytics.test.ts`

**Step 1:** Add a test with two callers sharing one FastF1 request, abort the first caller, and require the second caller to receive the snapshot.

**Step 2:** Run `npm test -- --run src/api/fastf1Analytics.test.ts` and verify the new test fails with an abort-related rejection.

### Task 2: Isolate shared work from caller cancellation

**Files:**
- Modify: `src/api/fastf1Analytics.ts`
- Test: `src/api/fastf1Analytics.test.ts`

**Step 1:** Add a caller-local promise wrapper that rejects only that caller on abort.

**Step 2:** Remove caller signals from the shared fetch/database request while retaining internal timeouts.

**Step 3:** Keep the existing one-request-per-session deduplication and cache behavior.

**Step 4:** Run the targeted API test and verify all source-selection and concurrency cases pass.

### Task 3: Preserve official classifications in degraded analysis views

**Files:**
- Create: `src/pages/Race/shared/components/OfficialClassificationTable.tsx`
- Modify: `src/pages/Race/RaceQualifying.tsx`
- Modify: `src/pages/Race/RaceAnalysis.tsx`
- Test: `e2e/race-analysis.qa.spec.ts`

**Step 1:** Add browser assertions requiring official qualifying and race rows when FastF1 returns 404.

**Step 2:** Run the focused browser test against the current code and verify it fails.

**Step 3:** Implement the shared responsive classification table using existing design tokens and `SessionDriverCell`.

**Step 4:** Render qualifying classification before optional FastF1 modules and race classification in the FastF1 unavailable state.

### Task 4: Verification and adversarial review

**Files:**
- Review all files changed by Tasks 1-3.

**Step 1:** Run targeted unit tests, type checking, and the production build.

**Step 2:** Run the focused browser test and manually inspect RaceDetail in development mode at desktop and mobile widths.

**Step 3:** Inspect console errors, failed requests, duplicate requests, rapid route switching, abort behavior, missing FastF1 files, and Supabase timeouts.

**Step 4:** Review the final diff for stale state, unhandled rejections, accessibility, horizontal overflow, and unrelated changes; fix any finding and repeat affected checks.
