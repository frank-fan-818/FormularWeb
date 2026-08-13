# RaceDetail Data-Flow Observability Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task.

**Goal:** Build a privacy-safe, correlated diagnostic trail that identifies which RaceDetail data source, fallback, state transition, or render boundary caused a failure without changing successful page behavior.

**Architecture:** Extend the existing `logger.ts`/`errorReporter.ts` stack instead of introducing a second vendor. A per-RaceDetail `flowId` follows route identity through hooks and API/fallback boundaries; structured events record only allowlisted identities, outcomes, durations, reason codes, and data counts. Development logs remain readable JSON, a bounded `sessionStorage` ring buffer preserves the latest trace for anonymous reproduction, and authenticated production errors continue to use Supabase with additive diagnostic columns.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, React Router v6, Supabase Postgres, existing structured logger.

---

## 1. First-principles decomposition

### 1.1 What must be true for RaceDetail to be viewable?

The page succeeds only when this chain remains valid:

`route identity -> request decision -> source request -> validation/fallback -> hook state -> context aggregation -> route render`

The observable unit is therefore not “an error message”; it is one attempted transition of a specific race identity through this chain. The minimum diagnostic record must answer:

1. Which race and route section was requested (`season`, `round`, `section`, optional `session`)?
2. Which logical page visit produced the event (`flowId`)?
3. Which operation and source handled it (`operation`, `source`, optional `fallbackFrom`/`fallbackTo`)?
4. What happened (`started`, `succeeded`, `empty`, `degraded`, `failed`, `aborted`, `stale_ignored`)?
5. Why (`reasonCode`, HTTP/status category, validation category), without persisting raw secrets or payloads?
6. What reached the next boundary (`itemCount`/small shape summary) and how long it took?

If any one of these is missing, diagnosis becomes guesswork. Existing request-duration logs answer only part of questions 3 and 6.

### 1.2 Current failure-observation gaps

- `useRacePrimaryResults` uses `Promise.allSettled()` and replaces rejected causes with a generic partial/unavailable error. The failed branch and original category are lost.
- `loadRaceSessionWithFallback` intentionally swallows the primary failure. It does not record whether fallback was chosen because of an exception, an empty result, or a missing table fuse.
- `raceSessionResultsApi` and `fastF1AnalyticsApi` return `null`/`[]` for several materially different states: invalid identity, legitimate absence, schema fuse, 404, and empty validated data.
- `RaceContext` merges many asynchronous branches but exposes only a small set of errors. There is no single “blocked/partial/ready” snapshot explaining which branch determined the UI state.
- `measureRequest` records duration but has no RaceDetail correlation ID and logs failures only at `debug`, which is suppressed in production.
- `ErrorBoundary` captures render exceptions, but global non-chunk `error`/`unhandledrejection` paths are not reported.
- Remote reporting skips anonymous sessions by design, so reproduction needs a safe local trace independent of Supabase.
- The remote record fingerprints the raw message safely, but lacks flow, race identity, source, phase, and reason-code columns; multiple events cannot be reconstructed as one data flow.

### 1.3 What logging cannot solve

- Syntax/type/build errors happen before runtime telemetry. Keep `npm run type-check`, `npm run encoding:check`, and `npm run build` as separate gates.
- A log does not correct wrong business data. Validation and count summaries can locate the corrupt boundary, but the later bug fix still needs a targeted test.
- Client-only logging cannot prove the state of upstream systems. It can record request/result facts and correlate them with browser network evidence.

## 2. Options considered

### Option A — Add ad-hoc `logger.error()` calls

Fastest, but events still cannot be joined across hooks and fallbacks, and logs will drift in naming. Reject.

### Option B — Correlated RaceDetail flow on the existing logger (recommended)

Adds a small typed contract, a per-page `flowId`, explicit fallback/outcome events, a bounded local trace, and additive Supabase fields. This solves the stated localization problem with no new runtime dependency and preserves current security policy.

### Option C — Introduce Sentry/OpenTelemetry immediately

Useful later for fleet-wide tracing, release/source-map correlation, and alerts, but it adds vendor configuration, consent/privacy work, and migration complexity before the local data-flow vocabulary is stable. Defer until Option B produces known event names and volume.

## 3. Event contract and invariants

Create a finite vocabulary, not arbitrary message strings:

```ts
type DiagnosticOutcome =
  | 'started' | 'succeeded' | 'empty' | 'degraded'
  | 'failed' | 'aborted' | 'stale_ignored';

type DiagnosticReasonCode =
  | 'network' | 'timeout' | 'http_4xx' | 'http_5xx'
  | 'validation' | 'identity_mismatch' | 'not_found'
  | 'schema_unavailable' | 'source_empty' | 'render'
  | 'unknown';

interface DiagnosticContext {
  flowId: string;
  feature: 'race_detail';
  season: string;
  round: string;
  section?: string;
  session?: string;
  operation: string;
  source?: 'jolpica' | 'supabase' | 'fastf1_static' | 'fia' | 'react';
}
```

Invariants:

- Never log result payloads, query strings, tokens, headers, raw Supabase errors, or stacks remotely.
- Log numeric counts and allowlisted labels only.
- Treat abort/navigation and stale-response suppression as normal outcomes, not errors.
- A fallback is one `degraded` event followed by the fallback result; it is not automatically a page failure.
- One logical RaceDetail visit has one `flowId`; changing `season` or `round` starts a new flow. Changing a sub-route keeps the same flow and updates `section`.
- Repeated equivalent aggregate states are deduplicated to prevent React render/effect noise.
- Production persistence remains authenticated-only; anonymous traces stay in the bounded browser session buffer.

## 4. Implementation tasks

### Task 0: Preserve the baseline and reproduce the present failure

**Files:**
- Read: `src/pages/Race/RaceContext.tsx`
- Read: `src/pages/Race/RaceLayout.tsx`
- Read: `docs/browser-qa-checklist.md`
- Create during implementation: `docs/qa/racedetail-observability-baseline.md`

**Step 1:** Run `git status --short` and record overlapping user changes. In particular, do not overwrite current changes in `src/main.tsx`, `src/utils/errorReporter.ts`, `src/utils/errorReporter.test.ts`, `src/pages/Race/RaceContext.tsx`, or `src/pages/Race/RaceLayout.tsx`.

**Step 2:** Run `npm.cmd run type-check` and `npm.cmd run encoding:check`.

**Step 3:** Run the app and reproduce at least one failing `/races/:round/<section>?season=<year>` route. Record exact route, viewport, visible UI state, console error, and first failed/empty network request. Do not infer a data-flow failure if the build itself fails.

**Step 4:** Save the baseline evidence and expected successful behavior. No behavior changes in this task.

### Task 1: Define and test the safe diagnostic contract

**Files:**
- Create: `src/types/diagnostics.ts`
- Modify: `src/types/index.ts`
- Create: `src/utils/diagnostics.ts`
- Create: `src/utils/diagnostics.test.ts`

**Step 1:** Write failing tests for `createFlowId`, error classification, allowlisted metadata sanitization, stable serialization, and a maximum 100-entry `sessionStorage` ring buffer.

**Step 2:** Run `npx.cmd vitest run src/utils/diagnostics.test.ts`; expect failure because the module does not exist.

**Step 3:** Implement the types and pure helpers. Use `crypto.randomUUID()` when present and a non-sensitive timestamp/random fallback otherwise. Provide a storage adapter so tests do not require jsdom.

**Step 4:** Verify the buffer drops oldest records, removes unknown keys, caps label lengths, and never stores an `Error` object or raw payload.

**Step 5:** Run the targeted test; expect pass.

**Step 6:** Commit as `feat: add safe diagnostic event contract` after confirming the worktree contains only intentional staged files.

### Task 2: Extend the existing logger with scoped correlation

**Files:**
- Modify: `src/utils/logger.ts`
- Modify: `src/utils/logger.test.ts`
- Use: `src/utils/diagnostics.ts`

**Step 1:** Add failing tests showing `createLoggerScope(baseContext)` merges immutable context into events, emits `flowId`, writes the local ring buffer, and preserves the original thrown error.

**Step 2:** Add a scoped API such as:

```ts
const log = createLoggerScope({ flowId, feature: 'race_detail', season, round });
log.step({ operation: 'primary_results', outcome: 'started' });
log.error({ operation: 'race_results', outcome: 'failed', reasonCode: 'network', error });
```

The logger must classify and sanitize `unknown` errors centrally; call sites must not copy raw messages into metadata.

**Step 3:** Keep the current `logger.info/warn/error/debug` and `withLogging` API compatible for unrelated modules.

**Step 4:** Run `npx.cmd vitest run src/utils/logger.test.ts src/utils/diagnostics.test.ts`; expect pass.

**Step 5:** Commit as `feat: add correlated logger scopes`.

### Task 3: Persist useful production context without weakening security

**Files:**
- Create: `scripts/sql/2026-08-11-error-log-diagnostics.sql`
- Modify carefully: `src/utils/errorReporter.ts`
- Modify carefully: `src/utils/errorReporter.test.ts`

**Step 1:** Add failing tests that remote inserts include only sanitized `flow_id`, `feature`, `operation`, `source`, `phase`, `outcome`, `reason_code`, `season`, `round`, `session`, and `duration_ms` fields.

**Step 2:** Add nullable columns and indexes using a new idempotent migration. Do not rewrite the historical migrations. Keep RLS authenticated-only and grant only the exact insert columns.

**Step 3:** Keep raw error text out of Postgres; retain category + fingerprint behavior. Do not persist query strings or URL fragments.

**Step 4:** Preserve deduplication, but include `flowId + operation + outcome + fingerprint` in the key so separate page flows remain distinguishable.

**Step 5:** Run `npx.cmd vitest run src/utils/errorReporter.test.ts`; expect pass.

**Step 6:** Commit as `feat: enrich production error diagnostics`.

### Task 4: Add global runtime failure capture

**Files:**
- Create: `src/utils/globalErrorHandlers.ts`
- Create: `src/utils/globalErrorHandlers.test.ts`
- Modify carefully: `src/main.tsx`
- Modify: `src/components/ErrorBoundary.tsx`

**Step 1:** Write tests for `window.error`, non-chunk `unhandledrejection`, chunk-recovery exclusions, listener cleanup/idempotency, and safe render-error classification.

**Step 2:** Initialize the handlers once from `main.tsx`. Preserve the existing stale-chunk recovery path and prevent duplicate reporting when it handles the event.

**Step 3:** Update `ErrorBoundary` to accept optional diagnostic context and log `source=react`, `reasonCode=render`, and a safe component-stack fingerprint/length rather than raw stack content remotely.

**Step 4:** Run `npx.cmd vitest run src/utils/globalErrorHandlers.test.ts src/utils/logger.test.ts`; expect pass.

**Step 5:** Commit as `feat: capture uncaught client failures`.

### Task 5: Trace primary and deferred RaceDetail result flows

**Files:**
- Create: `src/hooks/race/useRaceDiagnostics.ts`
- Create: `src/hooks/race/useRaceDiagnostics.test.ts`
- Modify carefully: `src/pages/Race/RaceContext.tsx`
- Modify: `src/hooks/race/useRacePrimaryResults.ts`
- Create: `src/hooks/race/useRacePrimaryResults.test.ts`
- Modify: `src/hooks/race/useRaceDeferredSessions.ts`
- Modify: `src/hooks/race/useRaceDeferredSessions.test.ts`

**Step 1:** Extract/test pure event-building and aggregate-state helpers before changing React effects. The aggregate state must be exactly one of `loading`, `ready`, `partial`, `blocked`, or `not_found`.

**Step 2:** Generate one flow scope per `season:round` in `RaceDataProvider` and pass it to race hooks as optional internal diagnostic context.

**Step 3:** In `useRacePrimaryResults`, log the qualifying and race branches independently with counts and classified rejection reasons before generating the existing user-facing combined error. Log stale/cancelled results as `stale_ignored`/`aborted`.

**Step 4:** Change `loadRaceSessionWithFallback` to accept source labels and a diagnostic scope. Emit why fallback started (`primary_failed` or `source_empty`) and whether the fallback succeeded, was empty, or failed. Preserve return values and thrown-error behavior.

**Step 5:** Log session discovery, requested tabs, retry actions, session result counts, and state-identity suppression. Do not log on every render.

**Step 6:** Run `npx.cmd vitest run src/hooks/race/useRacePrimaryResults.test.ts src/hooks/race/useRaceDeferredSessions.test.ts src/hooks/race/useRaceDiagnostics.test.ts`; expect pass.

**Step 7:** Commit as `feat: trace race result data flow`.

### Task 6: Trace source selection, validation, and analytics fallbacks

**Files:**
- Modify: `src/api/raceSessionResults.ts`
- Create: `src/api/raceSessionResults.test.ts`
- Modify: `src/api/fastf1Analytics.ts`
- Create: `src/api/fastf1Analytics.test.ts`
- Modify: `src/hooks/useFastF1RaceAnalytics.ts`
- Modify: `src/hooks/useRaceWeekendAnalytics.ts`
- Modify: `src/hooks/useFiaCarUpgrades.ts`

**Step 1:** Add tests for each distinguishable outcome: invalid identity, schema fuse, database empty, validation rejection, database success, static 404, static success, timeout, abort, and source fallback.

**Step 2:** Accept optional diagnostic context at internal API boundaries. Keep public result types unchanged.

**Step 3:** Emit source-specific events around Supabase/Jolpica/FastF1 static/FIA calls. Validation failure must be distinct from transport failure; 404/legitimate absence must be `empty`, not `failed`.

**Step 4:** Attach retry callbacks to log attempt number and classified cause. Never turn `AbortError` into a remote error.

**Step 5:** In the three analytics hooks, record enabled/disabled decisions, returned counts/presence, retry, abort, stale suppression, and final state.

**Step 6:** Run targeted API and hook tests; expect pass.

**Step 7:** Commit as `feat: trace race analytics source fallbacks`.

### Task 7: Expose one safe diagnostic ID in RaceDetail failure states

**Files:**
- Modify carefully: `src/pages/Race/RaceLayout.tsx`
- Modify: `src/pages/Race/RaceContext.tsx`
- Modify: `src/locales/zh-CN.json`
- Modify: `src/locales/en.json`

**Step 1:** Add the current `flowId` to context and show only `诊断编号 / Diagnostic ID: <flowId>` in blocked and partial error states. Do not expose source errors or payload details in the UI.

**Step 2:** Add a development-only helper to copy/export the bounded trace for that ID; production UI should expose only the ID unless a later product decision explicitly enables trace export.

**Step 3:** Verify loading, empty, partial, blocked, and retry states remain visually distinct and no business logic moves into JSX.

**Step 4:** Run relevant component/build checks and apply `frontend-quality-review` because a route-level failure UI changed.

**Step 5:** Commit as `feat: surface RaceDetail diagnostic IDs`.

### Task 8: Add an operator runbook

**Files:**
- Create: `docs/racedetail-diagnostics.md`
- Modify: `docs/engineering-specification.md`

**Step 1:** Document how to filter browser JSON logs by `flowId`, export the local ring buffer, and distinguish `failed`, `empty`, `degraded`, `aborted`, and `stale_ignored`.

**Step 2:** Add safe Supabase queries that reconstruct a flow ordered by timestamp and aggregate failures by `operation/source/reason_code`. Do not include production credentials.

**Step 3:** Add a decision tree:

`blocked before request -> route/identity`  
`request failed -> transport/upstream`  
`request succeeded but validation failed -> schema/data contract`  
`validation succeeded but state stale -> race identity/concurrency`  
`state ready but render failed -> component/derived data`

**Step 4:** Commit as `docs: add RaceDetail diagnostics runbook`.

### Task 9: Verification and release evidence

**Files:**
- Modify/create report from: `docs/browser-qa-checklist.md`
- Update: `docs/qa/racedetail-observability-baseline.md`

**Step 1:** Run targeted tests first:

```powershell
npx.cmd vitest run src/utils/diagnostics.test.ts src/utils/logger.test.ts src/utils/errorReporter.test.ts src/utils/globalErrorHandlers.test.ts src/hooks/race/useRaceDiagnostics.test.ts src/hooks/race/useRacePrimaryResults.test.ts src/hooks/race/useRaceDeferredSessions.test.ts src/api/raceSessionResults.test.ts src/api/fastf1Analytics.test.ts
```

Expected: all pass, with no unhandled promise rejections.

**Step 2:** Run broader gates:

```powershell
npm.cmd run type-check
npm.cmd run encoding:check
npm.cmd test -- --run
npm.cmd run build
```

Expected: all exit 0.

**Step 3:** Apply `browser-qa-check`. Test `/races/:round` plus `results`, `qualifying`, `race`, `sprint` when available, and `info` at desktop 1440x900 and mobile 375x812. Inspect console and failed network requests.

**Step 4:** Exercise five controlled scenarios using mocks/devtools: success, one primary-source failure with successful fallback, 404/empty optional data, timeout after retries, and render exception. Confirm every scenario can be reconstructed by one `flowId` and no sensitive/raw payload is present.

**Step 5:** Compare against baseline: successful rendering and retry behavior must be unchanged; diagnostic code must not create additional network failures or infinite logging loops.

**Step 6:** Run the version-manager skill before any release commit. Because this is a user-facing `feat:`, the project rule implies a minor version bump when shipping.

## 5. Acceptance criteria

- Given a RaceDetail failure, one `flowId` identifies the exact last successful boundary and first failed/empty/degraded boundary.
- Primary and fallback sources are distinguishable without reading raw payloads.
- Race/qualifying/session/analytics result counts show whether data disappeared before or after validation.
- Navigation aborts and stale responses do not appear as production errors.
- Anonymous reproduction remains available locally; production Supabase permissions remain authenticated-only.
- No secrets, query strings, raw API responses, raw error stacks, or unbounded messages are persisted.
- Existing successful RaceDetail behavior and API return contracts are preserved.
- Targeted tests, full tests, type check, encoding check, production build, and required browser QA pass.

## 6. Scope guardrails

- Do not add Sentry/OpenTelemetry in this iteration.
- Do not redesign charts or RaceDetail content while adding observability.
- Do not turn every `null` into an exception; classify legitimate absence explicitly.
- Do not modify historical SQL migrations; add a new idempotent migration.
- Do not overwrite the current dirty-worktree changes. Reconcile overlapping files line by line before implementation.
