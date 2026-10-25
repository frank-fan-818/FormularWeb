# Release 1.3.0 — official circuit map library

Circuit profiles and atlas previews now use verified official diagrams instead of unannotated outlines. The local library covers 50 of the repository's 78 circuit identities, with publisher/source links, map year, layout limitations and SHA-256 integrity records. The other 28 identities retain an explicit unavailable state and an auditable gap decision.

Maps display on white in both application themes. Full-resolution zoom supports different image dimensions, portrait PDF pages, JPEG, PNG and WebP. The zoom control sits outside the image so it cannot cover map legends. List images remain lazy, and map errors do not silently substitute an outline.

Official historical scans retain their original colours. Modern venue maps are identified by their actual source year and layout; they are not historical reconstructions of every F1 season. Circuit specification/statistics cards were not recalculated in this release. See [library coverage](official-circuit-map-library.md) and the [map QA report](qa/2026-10-24-official-circuit-library.md).

The importer rejects unknown identities, unapproved sources, invalid paths, duplicate IDs and inconsistent asset format/size/hash metadata. `npm run circuits:check` now runs in CI and the complete local quality gate.

Guest-refresh browser QA waits for the initial home responses and rendered home content before refreshing. This keeps the session-persistence check separate from cancellation of an unfinished first visit, while retaining strict browser-error assertions.

Release checks also identified [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) in Zod and [GHSA-xp26-3454-mjgp](https://github.com/advisories/GHSA-xp26-3454-mjgp) in Vitest's test tooling. The Zod minimum is now 4.6.7, Vitest and coverage tooling are updated within version 4, and Lighthouse's Puppeteer dependency chain is updated within its existing compatible range. A fresh dependency audit after those updates reports no known vulnerabilities.

Release target: `formular-web` / `frankpitwall.com`, from the protected main-branch merge after required checks pass. Previous known-good production is version `1.2.5`, commit `dd366b70040dbca110f8a6df331a512386d204ca`, deployment `dpl_EaHBrHDpp9LrESrx2aEcAqdB68fW`. No database migrations or production configuration changes are required. Final commit/deployment identity and live verification are recorded in the GitHub release after publication; these source notes alone do not confirm deployment.
