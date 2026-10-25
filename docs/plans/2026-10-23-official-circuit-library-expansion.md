# Official Circuit Library Expansion Implementation Plan

**Goal:** Ingest every discoverable, verified official F1 circuit diagram for the repository's circuit catalogue, retaining the white map presentation and auditable provenance.

**Architecture:** Extend the existing local asset library and source manifest. Record both covered and unresolved catalogue entries, and add a repeatable verification/import script. Prefer Formula 1, then FIA or the circuit/promoter's official technical map; verify track identity, layout year and legible annotations before inclusion.

**Tech Stack:** Node.js, TypeScript, React/Vite, existing image/PDF inspection tools and Vitest/Playwright.

## Tasks

1. Inventory the union of repository circuit IDs and existing aliases. Save an audit with names, official source candidates and coverage decisions. Preserve all current uncommitted work.
2. Search missing tracks using official sources. Cache research under ignored artifacts; retain direct source URLs and reject unrelated venues, unlabelled silhouettes, inaccessible files and third-party redraws. A current layout of the same venue can be included with its actual year and an explicit historical-layout caveat in the source record; never relabel it as the old F1 layout.
3. Ingest verified original images or rendered official PDF map pages. Record source publisher, layout year, dimensions, hashes and source-page/document links. Keep existing assets stable and never invent annotations.
4. Add an idempotent importer/checker with path, format, identity and integrity validation. Test unknown aliases, rejected inputs, duplicate IDs and metadata mismatches before using it to update the library.
5. Extend runtime lookup/zoom only as needed for newly verified dimensions and image formats. Keep list thumbnails lazy, single-route image loading, white surfaces and explicit missing/error states.
6. Run focused tests, encoding/font checks, production build/performance budgets and relevant desktop/mobile browser QA. Review representative new maps and publish a coverage/gap report in docs.

No commit, push, merge or deployment is authorized for this local batch. The current checkout already contains the requested in-progress image changes; reuse it rather than creating a separate checkout that would omit them.

## Outcome

- All 78 catalogue identities have a coverage decision; 50 have verified official assets (18 added to the existing 32). The remaining 28 have recorded gaps/rejected candidates. Final verification continued on 2026-10-24.
- Per-asset provenance includes publisher, layout/year, original URL, image dimensions and SHA-256. PDF-derived assets additionally record the original PDF hash/size, page and rendering parameters.
- PDF pages preserve original labels and page content. Archival Porto paper colour is retained inside the white viewer; current-layout limitations are recorded for Bugatti, Kyalami, Estoril, Jerez, Sebring, Watkins Glen, Fuji, Dijon and Anderstorp.
- Local importer/checker, coverage report, alias/integrity tests and desktop/tablet/mobile browser evidence added. No submission or deployment performed.
- Final checks: 678 Vitest cases, four importer tests, 12 circuit browser cases, six route smoke cases, strict lint, TypeScript, encoding/font verification, build and performance budgets passed. The screenshot review caught and fixed a mobile zoom-label overlap before completion.
