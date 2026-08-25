# F1 Media Resilience Design

## Problem

Driver and constructor cards currently assume that every API identifier has a matching PNG under `public/images`. Missing files fall back only after a browser 404, while several checked-in PNGs are themselves generic silhouettes. The old download scripts also target unused `src/assets` directories and contain a fixed, pre-2026 roster.

## Decision

Keep media local at runtime for stable, fast rendering. A checked-in manifest records canonical driver and constructor IDs, aliases, local filenames, and approved source URLs. A Node sync command refreshes files explicitly from OpenF1-discovered Formula 1 headshots and approved Formula 1 team-logo URLs. Runtime components never hotlink third-party images.

An offline audit command verifies that every manifest entry resolves to a non-empty local image, rejects known generic placeholder duplicates, and checks that aliases resolve to declared entries. The audit runs in normal verification and CI. A separate online discovery mode compares the current Jolpica/OpenF1 roster with the manifest so a new driver or constructor becomes a visible maintenance failure instead of a silent broken image.

## Runtime behavior

Media lookup is deterministic and shared by the React components. If a local image still fails, drivers render readable initials derived from supplied names or the driver ID; constructors render a readable monogram derived from the constructor ID. The UI therefore remains usable even before a newly discovered asset is curated.

## Verification

Pure lookup and fallback behavior receive unit tests. The media audit receives Node tests against temporary fixtures. Production build and browser QA cover the driver and constructor routes at desktop and mobile widths, including console and failed-request inspection.
