# Driver profile hero

## Product direction

- Audience: F1 fans opening a driver profile.
- Primary task: immediately identify the driver, nationality, team and car number; continue to season rank, points and wins.
- Direction: team-colour editorial profile, large standing photography, a restrained outlined car number, fine dot texture and diagonal track lines.
- Desktop: identity on the left and standing portrait on the right. Mobile/tablet: identity above the portrait so names and nationalities remain readable.
- Typography, spacing and colours reuse the existing design tokens. The hero uses a dark surface in both themes to keep white identity text legible.
- Existing loading, unavailable-profile and season-stat behaviour remains intact. Missing/failed portrait media falls back to the existing avatar/initials. Unknown nationalities retain their text without an invented flag.

## Media

- Official 2026 driver-page portraits are stored in `public/images/drivers/portraits/`. All 22 current drivers are included.
- `src/data/driver-portraits.json` records each original official page, image URL and local filename. Example source: https://www.formula1.com/en/drivers/kimi-antonelli.
- Images are downloaded unchanged as WebP assets. The UI frames the standing photo similarly to the supplied reference, retaining the head and racing suit while cropping the lower body at the panel edge.
- Nationality flags are local SVG assets in `public/images/flags/`, sourced from `https://flagcdn.com/{country-code}.svg`. They sit beside nationality text and use empty image alt text to avoid duplicate screen-reader output.
- Portraits resolve through existing driver aliases, including `andrea_kimi_antonelli` and `carlos_sainz_jr`. A 2026 portrait is not used when viewing another season; historical drivers use the existing fallback.
- Only the selected driver's portrait is requested; it has explicit dimensions and high loading priority. All media requests are same-origin.

## Implementation boundaries

- `src/components/drivers/DriverProfileHero.tsx`: presentation and image failure states.
- `src/utils/driverProfileMedia.ts`: nationality and driver-alias media resolution.
- `src/pages/DriverDetail.tsx`: replaces the original hero while preserving pre-existing participation/history work. If database metadata omits the car number or nationality, the standing's corresponding field remains available.
- `src/pages/DriverDetail.css`: hero composition, responsive layout and image fallback styling.

## Browser QA

- Date: 2026-10-18.
- Branch: `codex/points-completed-race-alignment`.
- Build URL: `http://127.0.0.1:4173` (local production build with deterministic API fixtures).
- Viewports: desktop 1440×900, tablet 768×1024, mobile 375×812.
- Routes: `/drivers/andrea_kimi_antonelli`, `/drivers/leclerc`, `/drivers/future_driver`; core route smoke suite also covers home, races, constructors and circuits.
- Checks: correct Italy/Monaco nationality flags independent of constructor nationality; correct portrait per driver; preserved P1/340 season stats; no copy/portrait overlap or page overflow; unknown-driver and forced-404 fallbacks; light/dark screenshots; no console errors or failed requests in the populated flow.
- Evidence: `artifacts/browser-qa/screenshots/driver-hero-{desktop,mobile,tablet}-chromium.png` and matching `driver-hero-dark-*` captures.
- Unit tests cover alias/season guard behaviour, unknown nationalities, all 22 local WebP files and SVG flag integrity.
- Verification results: 90 unit-test files / 528 tests passed; production build, targeted ESLint, encoding check (432 files) and media audit passed. Browser QA: 12 hero scenarios across three viewports plus 13 desktop route smoke checks and the driver points-chart performance check passed (26 browser checks total).
- Existing build warning: the logger is imported both statically and dynamically; no new build warning was introduced.
- Findings: no blocking issues in the checked layouts.

## Team logo follow-up

- Replaced the white-backed Mercedes badge in the dark hero with an official transparent white star, aligned at 20px with the team name. The optional `ConstructorLogo` `onDark` prop selects a declared `darkFile`; other call sites keep using the regular asset.
- Asset: `public/images/constructors/mercedes-white.webp` (64×64 WebP, alpha transparency). Source: the official Mercedes team page, `https://www.formula1.com/en/teams/mercedes`; original image URL is recorded in `scripts/f1-media-sources.json`.
- Media sync and audit include the new variant.
- Follow-up verification: 20 targeted unit tests, media audit, production build, TSX lint and script syntax checks passed. Desktop, mobile and tablet hero checks passed with the transparent logo loaded at 20px; screenshots above were refreshed.

## Search / historical archive follow-up

- Both `/drivers/:driverId` and `/history/drivers/:driverId` already use `DriverDetail` and now explicitly share the hero's archive mode. Search still navigates to the historical route and retains the career/history section.
- Archive headers use `DRIVER ARCHIVE / 车手历史` and label the latest season. Retired drivers use the archive's actual latest season; entries without a season history do not display an invented year.
- `resolveDriverProfileIdentity` fills blank identity fields from standings or the archive. Summary-only historical drivers can render the same hero even when there is no base driver metadata row. The information card uses that same resolved identity.
- Current-driver archive aliases resolve to the local 2026 portrait. Historical drivers without a suitable season portrait retain their existing avatar or initials, with the same nationality flag, team-colour surface and car-number treatment.
- Checks: 531 unit tests passed; production build, targeted ESLint and UTF-8 checks passed. Search-to-archive and archive-only retired-driver cases passed at 1440×900, 768×1024 and 375×812, including the flag, transparent Mercedes logo, portrait fallback and retained career section.
- Screenshot paths: `artifacts/browser-qa/screenshots/search-driver-hero-{desktop,mobile,tablet}-chromium.png` and `archive-driver-hero-{desktop,mobile,tablet}-chromium.png`.
