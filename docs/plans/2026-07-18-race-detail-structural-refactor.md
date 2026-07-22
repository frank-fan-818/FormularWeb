# Race Detail Structural Refactor Implementation Plan

## Goal

Reduce the change radius of RaceDetail without altering its information architecture, data semantics, visual hierarchy, or interaction behavior. The refactor must leave route loading, session navigation, chart controls, responsive layouts, empty states, error states, and retry behavior intact.

## Non-goals

- No new subscription features or entitlement checks.
- No visual redesign beyond fixes required to preserve the current UI after extraction.
- No API response-shape changes.
- No changes to the user's local Lighthouse configuration work.

## Baseline invariants

- Routes under `/races/:round` keep the same tab keys and lazy-loading behavior.
- Race results, qualifying, sprint, information, and analysis retain their current loading, empty, partial-data, and error states.
- Driver selection, telemetry metrics, chart/table mode, and collapse controls keep their current defaults and limits.
- Desktop 1440x900, tablet 768x1024, and mobile 375x812 remain free of overlapping controls and clipped primary content.
- Dynamic chart tooltip text remains escaped.

## Step 1: Establish guardrails

- Output: current file-size inventory, explicit-any inventory, targeted test baseline, and this implementation plan.
- Tests: Race chart/session/formatter/overview tests, `npm run type-check`, and production build baseline.

## Step 2: Split RaceDetail styles by ownership

- Output: ordered style modules for shell, shared presentation, results, analysis, telemetry, information, sessions, preview, and responsive behavior.
- Method: preserve selector order first; only remove duplicate or dead rules after visual verification.
- Tests: `npm run type-check`, `npm run build`, and RaceDetail screenshots at all required viewports.

## Step 3: Extract page components and pure view-model logic

- Output: smaller RaceAnalysis and RaceInfo containers; analysis panels become independently readable components; derived data stays in pure helpers.
- Method: pure extraction before stateful extraction; props remain explicitly typed.
- Tests: targeted helper tests, type-check, build, and interaction smoke checks.

## Step 4: Separate RaceContext responsibilities

- Output: hooks for primary weekend data, deferred session loading, and analysis preferences; a smaller provider that composes stable values.
- Method: preserve public context shape until consumers have migrated, then remove compatibility fields only when unused.
- Tests: new tests for session scheduling/loading helpers, existing Race tests, type-check, build, and route switching QA.

## Step 5: Remove production explicit `any`

- Output: typed external-data rows, typed race/sprint history results, typed chart formatter inputs, generic async argument tuples, and typed circuit metadata.
- Method: type at API/data-mapping boundaries; use `unknown` plus narrowing where external shapes are not guaranteed.
- Tests: mapper/helper tests, full source scan for explicit `any`, full test suite, type-check, and build.

## Step 6: Adversarial review and browser QA

- Output: independent reviews covering code correctness, data/type boundaries, security/performance, and responsive UX; all confirmed findings fixed or documented.
- Tests: full unit suite, lint on changed source, production build, required-route browser QA, console/network inspection, and refreshed screenshots/report.

## Completion criteria

- `RaceDetail.css` is removed or reduced to a small ordered compatibility entry.
- Large Race page containers are decomposed by user-visible responsibility without duplicating business logic.
- RaceContext no longer owns unrelated UI and remote-data concerns in one implementation body.
- Production TypeScript source contains no explicit `any` introduced or retained by the scoped cleanup.
- Tests, type-check, build, browser QA, and adversarial review all pass with evidence.
