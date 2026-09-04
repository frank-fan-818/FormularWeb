# Race Winner Predictions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Automatically publish a fresh winner prediction for each upcoming F1 race and display it on Home and Race Info.

**Architecture:** A Node publisher reuses the existing pure TypeScript model, writes immutable prediction runs and candidates to Supabase, and is triggered frequently by the existing prediction workflow. The React app reads a stable public view through a typed API and hook.

**Tech Stack:** React 18, TypeScript, Vite, Supabase Postgres, GitHub Actions, Vitest

---

### Task 1: Define the prediction persistence contract

**Files:**
- Create: `scripts/sql/2026-09-03-race-winner-predictions.sql`
- Create: `src/types/racePrediction.ts`

1. Add model registry, run, and candidate tables with uniqueness and RLS.
2. Add a public current-predictions view with only display-safe fields.
3. Add matching TypeScript domain types.
4. Verify the SQL is idempotent and the types compile.

### Task 2: Add the frontend data boundary

**Files:**
- Create: `src/api/predictions.ts`
- Create: `src/api/predictions.test.ts`
- Create: `src/hooks/useRacePrediction.ts`
- Create: `src/utils/racePredictionPresentation.ts`
- Create: `src/utils/racePredictionPresentation.test.ts`

1. Write failing mapping and freshness tests.
2. Implement strict Zod validation and a read-only Supabase query.
3. Implement cached loading, error, empty, and stale states.
4. Run targeted tests.

### Task 3: Add prediction UI

**Files:**
- Create: `src/components/RacePredictionSummary.tsx`
- Create: `src/pages/Race/shared/components/RaceWinnerPredictionPanel.tsx`
- Modify: `src/pages/Home.tsx`
- Modify: `src/pages/Race/RaceInfo.tsx`
- Modify: `src/index.css`
- Modify: `src/pages/Race/styles/editorial-info.css`
- Modify: `src/pages/Race/styles/editorial-responsive.css`

1. Add the compact Home summary.
2. Add the detailed Race Info Top 3 panel.
3. Reuse design tokens and add responsive rules.
4. Verify loading, empty, stale, and error rendering.

### Task 4: Add automatic prediction publishing

**Files:**
- Create: `scripts/publish-race-winner-prediction.ts`
- Create: `src/utils/currentRacePrediction.ts`
- Create: `src/utils/currentRacePrediction.test.ts`
- Modify: `package.json`
- Modify: `.github/workflows/refresh-prediction-data.yml`

1. Write tests for target selection, phase choice, and feature preparation.
2. Fetch current schedule/results/qualifying and load the approved model.
3. Generate an input hash and skip duplicate publications.
4. Upsert a run and ranked candidates with the service role key.
5. Change the workflow to frequent, direct, idempotent publishing while retaining daily backtest artifacts.

### Task 5: Verify release behaviour

1. Run targeted prediction tests.
2. Run the full unit suite and production build.
3. Start the app and check `/` and a Race Info route at desktop, tablet, and mobile sizes.
4. Inspect console and network failures and save screenshots/report under `artifacts/browser-qa/`.
