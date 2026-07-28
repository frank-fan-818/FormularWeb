# Security Risk Register

Last reviewed: 2026-07-28

## React Router 6 advisories

The application currently uses `react-router-dom@6.30.4`. The npm advisory
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
