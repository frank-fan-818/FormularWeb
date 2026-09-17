# PR 61 performance gate repair

The CI build produced valid assets but failed the 85 KiB initial JavaScript budget (162804 gzip bytes on GitHub). The new root auth provider statically imported Supabase and, through private-cache cleanup, FastF1 API validation. Home prediction imports also pulled authenticated transport into the public page.

## Changes

- Keep FastF1 cache maps and generation invalidation in a dependency-free module. Cleanup remains synchronous and invalidates in-flight responses without loading the analytics API.
- Separate browser configuration from the Supabase client; initialize the SDK asynchronously with existing error, timeout and unsubscribe handling.
- Load prediction transport only for an active member request and load the dashboard layout when its routes are entered.
- Defer login API/schema loading until an action. Use native labeled form controls with required/email/length validation, password visibility, submit locking and the existing auth error messages.
- Wait for the search control before interacting in browser QA. Supply public mock credentials consistently to the CI browser build and tests; no production credentials are needed.
- Replace the remaining two browser cases that depended on removed public race files with deterministic authenticated Storage fixtures, asserting the member token and full classification output.
- Keep every performance threshold unchanged. Version: 0.20.2.

## Verification

- Unit tests: 368 passed, including synchronous private-cache invalidation.
- Production build with empty Supabase environment (CI Build equivalent): initial JS 77.2 KiB, Home 91.7 KiB, Race Info 311.6 KiB, Race Analysis 434.3 KiB gzip; all existing budgets pass.
- Lighthouse: five runs passed; median performance 0.93, accessibility 0.96, best practices 1.00 and SEO 1.00. Nonblocking warnings remain for FCP (2009.9 ms vs the 2000 ms warning threshold), dependency depth and unused JavaScript; the installed Lighthouse version does not emit the legacy render-blocking-resources audit.
- Strict lint, encoding, security, workflow and service-worker checks passed.
- Browser evidence is under `artifacts/browser-qa/test-results`, including desktop/mobile/tablet login screenshots. The tests use mocked auth and data endpoints.
- Full browser run: 100 passed, 23 skipped and 4 failures from the two obsolete public-file cases. After repairing those fixtures, their entire suite passed (11 passed, 4 viewport skips), covering all four failures. Login validation, password visibility, login/logout, guest access, prediction, search and all required route smoke checks passed. Desktop and mobile login screenshots were visually inspected; no overlap was found.
