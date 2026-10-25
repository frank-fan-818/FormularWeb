# Season Fastest Pit Stop Implementation Plan

**Goal:** Add a compact season-fastest pit-stop view beside DHL season points and event results.

**Architecture:** Read the existing dynamically discovered DHL season-overview payload, validate `season_fastest` against its published HTML table, and return a separate `seasonFastest` collection. Reuse the award request/cache and existing loading, empty and error states. No new endpoint, dependency or championship-points calculation.

**Tech Stack:** React, TypeScript, Vite, Zod, Node source adapter, Playwright.

**Status:** Implemented and verified locally. Evidence: [browser QA](../browser-qa-season-fastest-2026-10-25.md).

## Scope

- Third view: `view=fastest`, labelled 赛季最快换胎 / Season fastest stops.
- Columns: published position, driver/team, event, official stationary-stop time. On mobile, use the event abbreviation with its full circuit name available as the title.
- Keep the selected season in the URL; fastest records never depend on an event selection. Switches between season views reuse their season request.
- Rename the points tab to 赛季换胎积分 / Pit stop points for clarity.
- Preserve official positions, including different positions for equal displayed times, and published timing precision. Do not fabricate laps, points or race links absent from this source.
- Missing historical fastest data produces an empty state in that view; older cached API envelopes default to an empty collection.
- Reuse existing tokens and table styling. No count cards, explanatory paragraphs or duplicate winner card.

## Steps

1. Extend `scripts/pit-stops.test.mjs` with source-validation, official-position, timing-precision and empty/malformed-data cases; run them before implementation.
2. Add the source parser in `api/_lib/pit-stops.mjs` and include its data in the existing award response.
3. Add the shared type and backward-compatible Zod collection in `src/types/pitStops.ts` and `src/api/pitStops.ts`; cover malformed and cached envelopes in `src/api/pitStops.test.ts`.
4. Add the third view to `src/pages/PitStops.tsx`, feature translations, and only the responsive CSS needed by this table.
5. Extend feature browser QA for direct links, switching views/seasons, empty state, official precision and mobile layout. Run source/unit tests, lint/types/encoding, production build and performance budget before browser QA.
6. Check desktop 1440×900, tablet 768×1024 and mobile 375×812, capture screenshots, inspect console/network failures, and validate a live season sample separately from fixtures. Record evidence under `docs/`.

Submission was authorized on 2026-10-25 for this batch. Source version: 1.5.0. Production deployment remains a separate action; see the [submission checks](../2026-10-25-v1.5.0-submission.md).
