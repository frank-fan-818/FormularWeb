# Loading Reliability Design

## Goal

Render the last trustworthy Formula 1 data immediately, refresh it without blocking the page, and keep independent page regions usable when one upstream source fails.

## Decision

Use a layered client reliability foundation now and preserve an API boundary for a future edge/BFF aggregator. A browser-only patch is insufficient for upstream consistency, while introducing an undeployed service would not improve the current production path.

## Data flow

1. Read fresh memory cache.
2. Read fresh or stale persistent cache.
3. Render cached data immediately with freshness metadata.
4. Refresh independent resources concurrently.
5. Validate successful responses before replacing the last known-good snapshot.
6. On failure, keep stale data visible and expose a local retry state.

## Reliability rules

- Network work must have a real abort signal, bounded timeout, retry classification, exponential backoff, and jitter.
- A failed cache write must never turn a successful network response into a UI failure.
- Expired data remains available during a stale-if-error window.
- Aggregated page resources use partial-success semantics.
- Late responses from an obsolete key or unmounted component cannot overwrite current state.
- Current-season and historical data use different freshness windows.

## Performance rules

- Cached content should be visible without waiting for refresh.
- Charts and heavy tables stay outside the initial route path.
- Service-worker caching must never cache authenticated or mutable API responses indiscriminately.
- CI enforces build, test, and bundle budgets.

## Success criteria

- One failed season resource does not blank the other resources.
- Offline or upstream failure displays the last valid snapshot when available.
- Corrupt/expired cache does not crash rendering.
- Cache quota errors do not discard successful responses.
- Fast season switching cannot display a late response from the previous season.
- Production build and targeted reliability tests pass.
