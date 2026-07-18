# Sitewide F1 Product Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn every primary route into a coherent F1 data product with task-specific control-center, index, dossier, archive, and utility page archetypes.

**Architecture:** Extract shared page mastheads, section headings, metric rails, and state surfaces into reusable product components. Preserve existing hooks and API contracts, then reshape each route around its primary user question while keeping page-specific identity in local CSS.

**Tech Stack:** React 18, TypeScript, Vite, Ant Design 5, Zustand, React Router v6, Vitest, Playwright.

---

## Design Brief

- Audience: ordinary F1 fans first, with clear future extension points for professional data subscribers.
- Primary task: answer each page's main question within five seconds, then reveal evidence and full data progressively.
- Information density: high on standings and analysis; medium on index and identity pages; low on login and settings.
- Desktop priority: comparison, chronology, and contextual metrics.
- Mobile priority: one dominant answer, short metric rail, touch-safe navigation, and internally scrolling data tables.
- Domain signal: race weekend state, season position, team identity, circuit geometry, or career era must be visible before generic metadata.
- Visual direction: editorial race control with graphite command surfaces, warm data canvas, stable team colors, technical grid lines, and Ferrari red reserved for primary actions and selected context.
- States: every route retains explicit loading, empty, stale, and error feedback.
- Viewports: 1440x900, 768x1024, 375x812.

## Task 1: Shared product primitives

**Files:**
- Create: `src/components/product/ProductMasthead.tsx`
- Create: `src/components/product/ProductSectionHeader.tsx`
- Create: `src/components/product/ProductPage.css`
- Modify: `src/styles/design-tokens.css`

**Steps:**
1. Add reusable masthead, metric rail, action slot, and numbered section heading components.
2. Add shared command-surface, grid, typography, focus, state, and responsive rules.
3. Run TypeScript checking.

## Task 2: Home and Seasons control centers

**Files:**
- Modify: `src/pages/Home.tsx`, `src/pages/Home.css`
- Modify: `src/pages/Seasons.tsx`, `src/pages/Seasons.css`

**Steps:**
1. Reframe Home as a current-season briefing with now/next, championship leaders, and season progress.
2. Reframe Seasons as a standings control center with leader gaps and indexed ranking tables.
3. Verify loading, stale, empty, and mobile states.

## Task 3: Entity dossiers

**Files:**
- Modify: `src/pages/DriverDetail.tsx`, `src/pages/DriverDetail.css`
- Modify: `src/pages/ConstructorDetail.tsx`, `src/pages/ConstructorDetail.css`
- Modify: `src/pages/CircuitDetail.tsx`, `src/pages/CircuitDetail.css`

**Steps:**
1. Strengthen driver identity and current-season command summary.
2. Strengthen constructor team-color ownership and two-driver performance context.
3. Rebuild circuit detail as a map-first engineering sheet.
4. Run targeted detail-route checks.

## Task 4: Paddock indexes

**Files:**
- Modify: `src/pages/Races.tsx`, `src/pages/Races.css`
- Modify: `src/pages/Drivers.tsx`, `src/pages/Drivers.css`
- Modify: `src/pages/Constructors.tsx`, `src/pages/Constructors.css`
- Modify: `src/pages/Circuits.tsx`, `src/pages/Circuits.css`

**Steps:**
1. Group race weekends by live, next, upcoming, and completed status.
2. Add compact roster and team-library summaries.
3. Convert circuits into map-led technical index cards.
4. Verify keyboard navigation and responsive layouts.

## Task 5: Archive and utility surfaces

**Files:**
- Modify: `src/pages/HistoryDetail.css`
- Modify: `src/pages/Login.tsx`, `src/pages/Login.css`
- Modify: `src/pages/Settings.tsx`, `src/pages/Settings.css`
- Modify: `src/components/Layout.tsx`, `src/components/Layout.css`

**Steps:**
1. Keep history pages visually archival and distinct from live control surfaces.
2. Make login and settings restrained, trustworthy, and subscription-ready without implementing billing.
3. Remove mojibake and shipped console logging in touched flows.

## Task 6: Verification

1. Run targeted tests and `npm test -- --run`.
2. Run `npm run build` and lint changed files.
3. Browser-check required routes at desktop, tablet, and mobile sizes.
4. Inspect console and failed network requests, fix blocking findings, and capture screenshots in `docs/qa-screenshots/2026-07-18-sitewide-redesign/`.
