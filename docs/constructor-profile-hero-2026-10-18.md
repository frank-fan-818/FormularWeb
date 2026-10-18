# Constructor profile hero

## Direction and scope

- Audience / primary task: identify a constructor, its registered nationality, season and position before exploring points or career history.
- Visual direction: use the driver's new team-colour editorial style with a large official car side view as the subject. White transparent logos, outlined rank/season numerals, subtle texture and diagonal lines identify the team without competing with the name.
- Desktop: identity and facts on the left, car on the right. Mobile/tablet: facts above a full-width car, with no horizontal scrolling or hidden names.
- Typography, spacing, surfaces and radii reuse existing design tokens. Audi and Cadillac colours were checked against their official team's image background values; Racing Bulls retains the canonical `rb` identity.
- `ConstructorProfileHero` is shared by `/constructors/:constructorId` and `/history/constructors/:constructorId`. Existing points charts, current statistics, career calculations and season timelines are retained.
- History mode identifies the archive's actual latest season and participation span. Missing/failed/older-season car imagery falls back to the constructor logo or initials instead of displaying a different team's or season's car.
- Removed the incorrect media aliases that assigned Alfa Romeo to Mercedes. An unavailable historical badge now produces initials rather than an unrelated logo.

## Assets and provenance

- Eleven 2026 official car side views are stored unchanged in `public/images/constructors/cars/`.
- `src/data/constructor-cars.json` records the source team page, original image URL, season and local file for every car.
- Team pages: https://www.formula1.com/en/teams. Example: https://www.formula1.com/en/teams/mercedes.
- All eleven current constructors now have transparent official dark-surface logo variants declared in `src/data/f1-media-manifest.json`; source URLs remain in `scripts/f1-media-sources.json` and the existing media sync/audit supports them.
- Tiny simple marks use the official CDN's larger-height image rendition so they remain sharp on high-density displays and pass the existing media audit threshold.
- Car identity resolution accepts only current constructor aliases and the declared 2026 season. Legacy Alfa Romeo or Sauber identities cannot resolve to a modern Mercedes/Audi car through successor-team guesses.

## QA report

- Date: 2026-10-18.
- Branch: `codex/points-completed-race-alignment`.
- Build URL: `http://127.0.0.1:4173` (production build, deterministic fixtures).
- Routes checked: `/constructors/mercedes`, search → `/history/constructors/mercedes`, `/history/constructors/alfa_romeo`; the existing masthead suite also covers home-equivalent navigation surfaces, seasons, races, drivers, constructors, circuits and settings in both themes.
- Viewports: desktop 1440×900, tablet 768×1024, mobile 375×812.
- Browser checks: 12 constructor hero cases across three viewports; 3 profile typography cases including long team names and both themes; 1 desktop masthead regression covering 11 routes in both themes; 13 core/auth route smoke checks. All passed.
- Populated-flow console and network checks: no page errors, console errors or failed requests. A deliberate 404 verifies the car-image fallback separately.
- Unit tests: 91 files / 535 tests passed. Includes all local car WebP signatures/provenance, current aliases, season guards, legacy identities and stable Racing Bulls normalization.
- Production build, targeted ESLint, media audit and UTF-8 check passed. Existing logger static/dynamic import warning remains.
- No copy/car overlap or horizontal overflow in checked layouts. The long Aston Martin team name and original points-chart layout remain readable.
- Blocking findings: none.

## Screenshots

- `artifacts/browser-qa/screenshots/team-hero-desktop-chromium.png`
- `artifacts/browser-qa/screenshots/team-hero-mobile-chromium.png`
- `artifacts/browser-qa/screenshots/team-hero-tablet-chromium.png`
- Matching `team-hero-dark-*`, `team-archive-hero-*` and `historical-team-hero-*` captures.
- Long-name captures: `artifacts/browser-qa/screenshots/typography-constructor-aston_martin-{light,dark}-{desktop,mobile,tablet}-chromium.png`.

## Commit separation

- The preceding race and driver UI work was committed as `8a0d41be`, version `0.22.8`.
- That exact staged snapshot passed an independent production build and 461 tests before committing. Pre-existing prediction/search/verified-entry work was excluded and retained in the working tree, including unrelated hunks in the driver files.
- The constructor implementation is included in the subsequent combined feature submission, version `0.23.0`, together with the remaining historical-search and prediction work.
