# Security Risk Register

Last reviewed: 2026-10-03

## Current candidate: 0.20.12

The project now declares `react-router-dom@^7.18.2`. The 2026-10-03 full
dependency audit reported zero vulnerabilities. The React Router 6 assessment
below is historical and is not a description of the current installed version.
Keep the internal-route validation and same-origin CSP in place, and re-run the
dependency audit for the exact release commit. Local Semgrep passed with zero
findings on 754 source targets using all four project rules. The Windows
certificate-store failure was resolved by running the installed scanner outside
the sandbox. Downloaded runner toolchains and generated Lighthouse files are
excluded alongside existing dependency/build exclusions; application rules and
failure thresholds remain unchanged. A successful Linux CI scan is still
required for the final release commit.

## Historical assessment (2026-07-28; superseded)

## React Router 6 advisories

The application then used `react-router-dom@6.30.4`. The npm advisory
database reports two moderate vulnerabilities for this line and does not offer
a non-breaking patched 6.x release.

### Open redirect advisories

- GHSA-wrjc-x8rr-h8h6
- GHSA-jjmj-jmhj-qwj2

Exposure is mitigated in this application:

- navigation destinations are root-relative application routes;
- entity identifiers are always appended after a fixed internal path prefix;
- the only persisted navigation target, global-search cache data, passes
  `isSafeInternalRoute` before reaching React Router;
- the route validator rejects absolute URLs, protocol-relative URLs,
  backslashes, encoded backslashes, and control characters;
- the production CSP limits scripts to the same origin.

Regression coverage lives in `src/utils/safeNavigation.test.ts`.

### SSR hydration constructor injection

- GHSA-337j-9hxr-rhxg

This is a Vite client-side SPA. It does not use React Router SSR, hydration
data, `createStaticRouter`, or `deserializeErrors`, so the vulnerable path is
not reachable.

## Upgrade decision

React Router 7 was evaluated but is not adopted as a security-only update
because it is a breaking major upgrade and its current dependency graph
introduced a separate high-severity, no-fix audit finding during evaluation.
Re-evaluate the upgrade before the next minor release or within 90 days,
whichever comes first. High and critical audit findings remain release
blockers.
