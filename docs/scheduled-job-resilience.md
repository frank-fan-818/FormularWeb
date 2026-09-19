# Scheduled data job recovery

Prediction and FIA race-window checks request the season calendar with a 30-second
timeout and up to four attempts, waiting 5, 15 and 30 seconds between transient
failures. HTTP 408, 429, 5xx and network/timeouts are retryable; authentication,
schema and input failures remain errors.

Each workflow saves validated live calendars using a pinned GitHub cache action.
After exhausted transient failures, a same-season calendar fetched within the last
24 hours can be used. A cache fallback never refreshes its timestamp or saves a new
cache entry. Future timestamps, malformed data, incomplete responses and old caches
are rejected. Run summaries record the source, original fetch time and eligibility;
fallback also emits a warning. The first run has no fallback until a live fetch
succeeds. Cache eviction or sustained outages still produce a failed run.

This cache determines whether work is due, not what data to publish. Eligible
publishers still validate live source data and report failures. Manual prediction
dispatch and explicit FIA rounds retain their existing window bypass, after input
validation. Race dates may change within the fallback window; the next successful
live fetch replaces the calendar.

FastF1 private storage listing, downloads and explicitly upserting uploads retry
transient failures with the same bounded backoff. Permission errors are not retried.
Snapshot completeness and read-back verification are unchanged, and exhausted
failures still reach the existing health report and failing-job checks. This reduces
unnecessary upstream refetching after a temporary snapshot-store outage; it cannot
remove an upstream 403 or recover data that has never been successfully cached.

Run `npm run workflows:verify` for outage, cache, boundary, CLI and storage tests.
