# F1 Media Resilience Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Update the 2026 driver/team media and prevent future roster changes from silently producing broken or generic images.

**Architecture:** A checked-in media manifest is the source of truth for runtime paths and upstream sources. Offline validation is deterministic and CI-safe; online sync/discovery is an explicit maintenance command. React components use pure manifest lookup and readable local fallbacks.

**Tech Stack:** React 18, TypeScript, Vitest, Node.js 24, OpenF1/Jolpica discovery, local static assets.

---

### Task 1: Add deterministic media lookup

**Files:**
- Create: `src/data/f1MediaManifest.ts`
- Create: `src/utils/f1Media.ts`
- Test: `src/utils/f1Media.test.ts`
- Modify: `src/utils/driverImages.tsx`
- Modify: `src/utils/constructorLogos.tsx`
- Modify: `src/pages/Drivers.tsx`

**Steps:**
1. Write failing tests for canonical IDs, aliases, filenames, and name/ID-derived initials.
2. Run the targeted Vitest file and confirm it fails.
3. Implement pure lookup and fallback helpers.
4. Update both React image components and pass names from the driver grid.
5. Run the targeted tests and confirm they pass.

### Task 2: Replace stale media maintenance scripts

**Files:**
- Create: `scripts/f1-media-lib.mjs`
- Create: `scripts/sync-f1-media.mjs`
- Create: `scripts/check-f1-media.mjs`
- Test: `scripts/f1-media-lib.test.mjs`
- Delete: `scripts/download-images.ts`
- Delete: `scripts/download-images.ps1`
- Delete: `scripts/download-images-simple.ps1`

**Steps:**
1. Write failing Node tests for manifest validation, placeholder detection, and roster-gap reporting.
2. Implement reusable filesystem/network-independent validation helpers.
3. Implement offline `check` and explicit online `sync --discover` commands.
4. Remove obsolete scripts that write to unused directories.
5. Run the Node test and offline audit.

### Task 3: Refresh 2026 media

**Files:**
- Modify: `public/images/drivers/*`
- Create: `public/images/constructors/audi.*`
- Create: `public/images/constructors/cadillac.*`

**Steps:**
1. Run the approved-source sync command for the 2026 manifest.
2. Confirm all 22 current drivers and 11 constructors have valid local assets.
3. Run the offline audit and inspect representative images.

### Task 4: Add release gates and documentation

**Files:**
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`
- Create: `docs/f1-media-maintenance.md`

**Steps:**
1. Add `media:check`, `media:discover`, and `media:sync` scripts.
2. Include the offline check in `quality:check` and CI.
3. Document source, attribution, update workflow, and recovery procedure.
4. Run workflow-policy verification.

### Task 5: Verify behavior

**Files:**
- Modify only if a test exposes a defect.

**Steps:**
1. Run targeted unit and Node tests.
2. Run type-check and lint for changed code.
3. Run `npm run build`.
4. Browser-check `/drivers`, `/drivers/:driverId`, `/constructors`, and `/constructors/:constructorId` at 1440×900 and 375×812.
5. Inspect console and failed network requests and record screenshots/findings.
