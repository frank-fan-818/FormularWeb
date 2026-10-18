# PR 79 font coverage and build-gate repair

- Version: `0.23.1`.
- Root cause: new profile and verified-participation copy introduced six characters absent from the committed Chinese font subset: 跨 (`U+8DE8`), 姿 (`U+59FF`), 核 (`U+6838`), ／ (`U+FF0F`), 储 (`U+50A8`), 锦 (`U+9526`). The local pre-PR checks had omitted `fonts:verify`.
- Regenerated using the existing `scripts/build-ui-fonts.py`, cached pinned IBM Plex packages and fontTools 4.51.0. Updated the extended WOFF2, CSS Unicode range and manifest together. Kept the seven unchanged font subsets after comparing their character maps and non-timestamp tables with the original files.
- Verified the actual font character maps cover all 696 declared UI codepoints, including the six additions. The extended subset grows from 62,480 to 63,204 bytes; account/core subsets and licenses remain unchanged.
- A subsequent production-budget check exposed a home path of 94,243 bytes gzip against the existing 94,208-byte limit. Request timing imported the same module as a static `web-vitals` dependency. Load that optional dependency inside `initWebVitals` instead; the existing startup promise handles loading failures. Request timing and all five metric registrations are preserved.
- The regression test fails against the former eager import and passes after deferral. No performance thresholds were increased.

## Verification

- `npm run fonts:verify`: 8 WOFF2 assets, 696 UI codepoints, OFL licenses and SHA-256 hashes passed.
- `npm run test:coverage`: 92 files / 536 tests passed; configured coverage thresholds passed.
- Production build, TypeScript, targeted strict ESLint, encoding, security and staged-diff checks passed.
- `npm run budget:performance`: home 90.0 KiB gzip, initial scripts 79.0 KiB; all route/chunk budgets passed.
- `npm run service-worker:verify`: built service-worker verification and 7 tests passed.
- Browser URL: `http://127.0.0.1:4173`, production build with existing controlled fixtures.
- Browser checks: 10 passed across desktop 1440×900 and mobile 375×812. Coverage includes home contrast in both themes, account first paint, deferred monitoring, unavailable-font fallback, and long driver/constructor profile names and metadata in both themes. Existing console/network assertions passed.
- Screenshots: `artifacts/browser-qa/screenshots/release-login-*`, `font-fallback-*`, `typography-driver-*`, `typography-constructor-*`, and `typography-schedule-*`.
- Blocking findings: none in the verified flows. Existing logger static/dynamic import warning remains.
