# Professional Motion System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Replace inconsistent page animations with a cohesive, accessible, high-performance race-control motion system across the application.

**Architecture:** Extend the existing design tokens with semantic motion variables, add one global motion stylesheet, key only route content for page transitions, and make ECharts motion preference-aware. Existing page structure and business behavior remain unchanged.

**Tech Stack:** React 18, TypeScript, React Router 7, CSS, ECharts 6, Vitest, Playwright, Lighthouse.

---

### Task 1: Establish measurable motion contracts

**Files:**
- Modify: `src/styles/design-tokens.css`
- Create: `src/styles/motion-system.css`
- Modify: `scripts/check-performance-budget.mjs`

1. Add semantic duration, easing, distance, and stagger tokens.
2. Add a production-build check that requires the motion stylesheet marker and reduced-motion rules.
3. Run the budget check before implementation to prove the new contract fails.
4. Add the global stylesheet and rerun the build/budget check.

### Task 2: Implement route and shell continuity

**Files:**
- Modify: `src/components/Layout.tsx`
- Modify: `src/components/Layout.css`
- Modify: `src/router/index.tsx`

1. Key only route content by pathname, leaving sidebar/header persistent.
2. Replace abrupt route fallback styling with a race-control loading surface.
3. Animate sidebar active indicator, icon, collapse labels, mobile panel, and overlay with semantic tokens.
4. Verify direct routes, nested race routes, and keyboard navigation.

### Task 3: Apply interaction and content choreography

**Files:**
- Modify: `src/styles/motion-system.css`
- Modify: `src/components/product/ProductPage.css`
- Modify: `src/pages/Home.css`
- Modify: route/list styles only where a global selector cannot preserve layout.

1. Add route section sequencing and bounded list/card staggering.
2. Standardize hover, press, focus, selected, dropdown, tab, table-row, and status motion.
3. Replace broad `transition: all` in shared surfaces with explicit compositor-safe properties.
4. Ensure loading, empty, and error states remain immediately legible.

### Task 4: Make data visualization motion preference-aware

**Files:**
- Create: `src/hooks/useReducedMotion.ts`
- Modify: `src/components/charts/EChartsPanel.tsx`
- Test: `src/hooks/useReducedMotion.test.ts`

1. Add a reusable media-query subscription hook.
2. Apply bounded ECharts entrance/update durations and disable them for reduced motion.
3. Preserve lazy viewport initialization, ResizeObserver behavior, accessible description, and disposal.
4. Run targeted tests and production build.

### Task 5: Adversarial QA and documentation

**Files:**
- Modify: `docs/browser-qa-report-2026-08-19.md`
- Create: `docs/motion-system.md`

1. Run strict lint, typecheck, all unit tests, production build, budget, and audit.
2. Run Lighthouse five times and verify CLS/TBT do not regress.
3. Run desktop, tablet, mobile, and service-worker Playwright suites.
4. Inspect route changes, rapid repeated clicks, sidebar collapse, search dropdown, chart scroll-in, dark mode, and reduced motion.
5. Record results, screenshots, and any remaining design debt.

