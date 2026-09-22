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

## FIA publication lifecycle (0.20.4)

The five-day pre-race polling window can begin before the FIA adds the event to
its document selector. A missing event in a recognizable directory is now
`awaiting_event`; an event without a PDF is `awaiting_publication`. Public FIA
403/404 responses, maintenance pages and exhausted transient requests are
`source_deferred` before the race starts. These are polling outcomes, not
successful data publications. Existing snapshots remain untouched and the next
scheduled run retries. Each run writes `artifacts/fia-refresh/run-report.json`
and a GitHub summary, including runs with no published document.

The race start is the deadline: missing/unavailable documents at or after that
time fail. Explicit round repairs also fail immediately when unavailable, even
before the race. Unrecognized page structure, invalid PDFs and database failures
always remain errors. The policy applies only to public FIA sources; database
403/authentication errors are never treated as public-source deferrals.

Offline CLI tests reproduce the missing Azerbaijan option and public-source 403,
and verify deferred outcomes do not write to the database. They also verify the
deadline, malformed-page and explicit-repair failure paths. This fixes recurring
pre-publication failures without disabling the workflow or its notifications.
