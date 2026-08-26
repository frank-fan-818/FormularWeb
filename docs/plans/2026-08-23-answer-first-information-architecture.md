# Answer-First Information Architecture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the current F1 state readable within five seconds, expose deeper data through short summaries, and remove decorative Chinese microcopy that adds no factual or operational value.

**Architecture:** Add pure season/weekend summary utilities, then consume them from the application shell, home, standings, and race information pages. Preserve existing cached-data boundaries and route-level lazy loading; do not introduce a new dependency or news/content subsystem.

**Tech Stack:** React 18, TypeScript, Vite, React Router, Ant Design, Vitest, Playwright.

---

### Task 1: Summary utilities

**Files:**
- Create: `src/utils/seasonSummary.ts`
- Create: `src/utils/seasonSummary.test.ts`
- Modify: `src/utils/raceSchedule.ts`
- Create: `src/utils/raceSchedule.test.ts`

1. Write tests for leader gaps, season progress, latest completed race, and next weekend session.
2. Run targeted tests and confirm they fail.
3. Implement pure, locale-safe summary functions without network calls.
4. Run targeted tests and confirm they pass.

### Task 2: Compact home command surface

**Files:**
- Modify: `src/pages/Home.tsx`
- Modify: `src/pages/Home.css`

1. Replace the oversized marketing masthead and duplicated season pulse/stat cards with a compact race command surface.
2. Show current/next race, local start time, circuit, four core facts, and up to five weekend sessions.
3. Preserve partial loading, stale, offline, empty, error, keyboard, and intent-preload behavior.
4. Run Home-related unit tests and type-check.

### Task 3: Global race signal

**Files:**
- Create: `src/components/RaceWeekendSignal.tsx`
- Create: `src/components/RaceWeekendSignal.css`
- Modify: `src/components/Layout.tsx`
- Modify: `src/components/Layout.css`

1. Reuse cached current-season races in the application shell.
2. Show the next unfinished session outside the home route and link to the race information page.
3. Hide the strip when no race data exists and avoid duplicating the home surface.
4. Verify desktop and mobile header layouts.

### Task 4: Race information hierarchy

**Files:**
- Modify: `src/pages/Race/RaceInfo.tsx`
- Modify: `src/pages/Race/RaceLayout.tsx`
- Modify: `src/pages/Race/shared/components/RaceWeekendOverview.tsx`
- Modify: `src/pages/Race/styles/editorial-info.css`
- Modify: `src/pages/Race/styles/editorial-shell.css`

1. Add previous race, full calendar, and next race navigation from existing season context.
2. Mark sessions as completed, live/current, result available, or upcoming using time and loaded-session evidence.
3. Replace promotional headings with direct labels and retain useful unavailable/error text.
4. Verify sprint and standard weekend schedules.

### Task 5: Championship facts

**Files:**
- Modify: `src/pages/Seasons.tsx`
- Modify: `src/pages/Seasons.css`

1. Add a compact factual championship summary before the tables.
2. Show rounds complete/remaining, leader gaps, wins, and field size without claiming unverified theoretical points.
3. Keep driver and constructor resource states independent.
4. Verify mobile table readability.

### Task 6: Visible microcopy cleanup

**Files:**
- Modify: route-level pages and shared page-intro call sites under `src/pages/`.

1. Search visible Chinese descriptions, subtitles, and slogans.
2. Remove sentences that do not add a fact, state, source, unit, error, or action.
3. Replace flowery titles with direct domain labels.
4. Preserve SEO metadata, accessibility labels, error recovery, and data provenance copy.
5. Run encoding and source searches to verify the rejected patterns are gone.

### Task 7: Verification and adversarial audit

**Files:**
- Create: `docs/browser-qa-report-2026-08-23-answer-first.md`
- Create: `docs/adversarial-review-2026-08-23-answer-first.md`

1. Run targeted tests, full tests, type-check, lint, encoding check, production build, and performance budget.
2. Run browser QA at 1440×900, 768×1024, and 375×812.
3. Inspect required routes, console logs, and failed requests; capture screenshots.
4. Challenge duplicate information, stale/partial data, missing sessions, sprint weekends, long names, weak network, reduced motion, and horizontal overflow.
5. Fix every release-blocking finding and rerun the affected checks.
