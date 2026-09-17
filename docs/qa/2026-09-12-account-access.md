# Account access browser QA

- Date: 2026-09-12
- Branch: `codex/fia-upgrade-automation`
- Build URL: `http://127.0.0.1:4173`
- Viewports: desktop 1440×900, tablet 768×1024, mobile 375×812.
- Routes: `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/privacy`, `/races`, race result/analysis/info/sprint routes, driver/team/circuit detail pages, settings and unknown routes.

## Verification

- `npm test`: 64 files, 356 tests passed.
- `npm run lint:strict`: passed.
- `npm run build`: passed after final auth hook extraction.
- `npm run encoding:check`: passed.
- `git diff --check`: passed.
- Browser regression across three viewports: 91 passed, 23 skipped by existing viewport/service-worker selection rules.
- Final auth suite after hook extraction: 15 passed across three viewports, including failed credentials.

## Findings

- Fresh visits reach the standalone login without rendering dashboard navigation.
- Guest choice survives refresh and preserves a deep-linked race season.
- Guests see member prompts and issue no FastF1/prediction requests in tested analysis/info flows.
- Login returns to the intended analysis route; logout removes member access and resets guest consent.
- Existing sessions enter directly; invalid credentials leave access locked.
- Privacy is public without a session and includes navigation back to account entry.
- No horizontal overflow in captured login/locked states. Smoke tests found no unexpected browser exceptions or first-party asset failures.
- Expected missing-data responses in existing fixtures remain permitted; tests use mocked auth/data services, not production credentials or email delivery.

## Scope and remaining boundary

No blocking finding for the implemented application access flow. Public FastF1 files and existing public database endpoints have not been made private. Frontend gating must not be represented as server-side authorization. No real-account email verification, production migration, commit or deployment was performed.

## Screenshots

Final screenshots are under `artifacts/browser-qa/auth-final/`:

- `auth-access.qa-first-visit-0c08c-est-choice-survives-refresh-desktop-chromium/login-entry.png`
- `auth-access.qa-first-visit-0c08c-est-choice-survives-refresh-mobile-chromium/login-entry.png`
- `auth-access.qa-first-visit-0c08c-est-choice-survives-refresh-tablet-chromium/login-entry.png`
- `auth-access.qa-guest-deep--617b3-st-analytics-or-predictions-desktop-chromium/guest-locked.png`
- `auth-access.qa-guest-deep--617b3-st-analytics-or-predictions-mobile-chromium/guest-locked.png`
