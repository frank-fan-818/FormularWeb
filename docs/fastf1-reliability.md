# FastF1 refresh reliability

The 2026-09-13 run loaded result rosters but failed every timing-source request for six sessions. The old wrapper called any incomplete snapshot `pending` and displayed only the first log line. All six sessions subsequently passed local completeness checks with the same FastF1 3.8.3 version. This proves current data availability, not hosted-runner reachability at the time of failure.

## Processing and publication

1. Restore complete snapshots from the private `fastf1-private` bucket into a unique run/attempt directory. Invalid snapshots are not restored. A restore failure remains a pipeline failure even if other work succeeds.
2. Skip already complete sessions; fetch only missing/incomplete eligible sessions. The eligibility window remains four hours after the scheduled start, not a claim that the session has actually finished.
3. Record the actual GET endpoint, final HTTP status or exception type, every attempt's status and retry count. No headers, response bodies, query strings, URL credentials or exception bodies are retained.
4. Retry timeouts, connection failures, HTTP 408/429/5xx up to **three total attempts** with exponential delay and jitter. Honor numeric/date `Retry-After`; if it exceeds 30 seconds, stop that request rather than retry early. Each request has connect/read timeouts, each session has a 900-second subprocess budget, and batch exports have a 2400-second budget to leave time for publication and diagnostics. Reports are checkpointed after each session. Request progress is flushed before/after each attempt so killing a timed-out child preserves endpoint evidence. Authentication/403/404 and certificate errors are not retried.
5. Stage exported files and check identity/completeness before replacing previous files. Missing fields with source errors are `fetch_error`; missing fields without observed request errors are `incomplete_snapshot`. A timeout is `session_timeout`; unexpected processing failures are `exporter_error`. None of these mean “not yet published”. Future sessions are excluded by the schedule.
6. Import and publish complete sessions independently. A failed database row or Storage session does not prevent later sessions from being attempted. Uploads are downloaded again and compared byte-for-byte. Invalid local snapshots never replace remote objects.
7. Run strict season/round completeness verification **after** healthy-session publication. Any unresolved restore/export/import/upload/health/verification failure makes the job fail.

The current Storage API uses separate main/telemetry objects, so the two-object update is not a database transaction. Only complete, identity-checked pairs are uploaded, telemetry first; an upload/verification failure is reported and repaired on a later run. A future requirement for atomic concurrent reads would require versioned objects and a reader-visible commit pointer; this change does not silently alter existing reader URLs.

## Health and diagnosis

The Actions summary and 14-day diagnostic artifact include the manifest, export report, publication report and health report. They contain no private lap/telemetry payloads. The private bucket keeps history at `health/<season>/<round-or-all>.json`: per-session consecutive failures, missing-since, last complete snapshot timestamp, last check and consecutive failed pipeline runs. Manual round repairs and full-season runs have separate scopes; a full-season run reconciles a successful manual repair on its next restore.

Check `export-report.json` for `diagnostic.requests` and `missingFields`:

- 403: investigate source restrictions and the trusted runner's route to that source. Repeated retries cannot repair access denial.
- 429: inspect `retryAfterSeconds`; allow the next scheduled run to retry if the delay exceeds the in-run budget.
- Timeout/connection errors/5xx: inspect attempt history and whether the next run recovers.
- 404: inspect the source path and schedule mapping; it is not automatically evidence of unpublished data.
- Successful requests plus missing fields: investigate upstream content and parsing. Do not disable completeness checks.
- Restore/health errors: check bucket existence and service-role access. Missing history is created only after a successful Storage listing; access errors do not reset failure counters.

GitHub's existing failed-workflow notification settings deliver failure notifications. This workflow adds durable evidence and summaries; it does not send new emails or messages or promise out-of-band alerts when GitHub itself does not schedule a run.

## Runner selection and acceptance

Default runner: `fastf1-collector`, the registered Windows collector on the user's network. Post-merge verification on September 29 confirmed that both hosted macOS and Ubuntu return 403 from official timing endpoints and 404 from the mirror, while the same exporter succeeds locally. Hosted-family failover has therefore been replaced with at most two sequential collector attempts. The manual `primary_runner=ubuntu-24.04` input remains available to exercise hosted-to-collector recovery.

Each attempt uses a separate export/cache directory, restores only complete private snapshots and retains the same strict publication and completeness checks. The final job succeeds only when one attempt reports every required step successful. Cancellation does not launch recovery. This is a retry on a supervised collector, not an independent-network failover.

The Windows runner needs Git for Windows Bash and provisioned Node/Python tool caches. All Bash script placeholders are quoted because the runner workspace may contain spaces. Register the runner first, then use `scripts/install-fastf1-runner-startup.ps1 -RunnerRoot <registered-runner-path>` to install the current-user supervisor. It restarts failed listeners and checks a stop marker; it does not guarantee service while the computer is off, disconnected or logged out. Inspect the scheduled task and GitHub runner status before relying on scheduled refreshes. An offline collector can leave jobs queued.

`FASTF1_RUNNER` can override the primary runner. Provision Python before acceptance: direct GitHub release downloads timed out on this collector; downloading the same signed official installer through `gh release download` succeeded. See `docs/incidents/2026-09-29-fastf1-postmerge.md` for evidence and limits.

Acceptance requires a real missing-session export, successful database and Storage publication, verified read-back, and a successful full-season reconciliation. Local unit tests alone do not establish this. Import CLI arguments are strict; use direct `node --import tsx scripts/import-fastf1-session-analytics.ts ...` from PowerShell to avoid npm flag forwarding ambiguity.

Local checks (no production writes):

```text
npm run fastf1:automation-test
npm run workflows:verify
node scripts/upload-private-fastf1.mjs --season 2026 --input <local-export-root> --dry-run
npm run fastf1:import-sessions -- --season 2026 --input <local-export-root> --complete-only --dry-run
npm test
npm run build
```

## Local verification for this change

- Reliability/automation tests: 20 Python tests and 8 Node tests pass, including fault injection for timeout, 403, 429, 503, staging preservation, batch budgets, independent imports/uploads and health recovery.
- Workflow validation passes for all six repository workflows; production build passes.
- The six recovered 2026 round 13/14 snapshots pass database import and private Storage dry runs. The updated batch exporter also exported both round 13/14 qualifying sessions with pinned FastF1 3.8.3 and passed scoped manifest/health checks.
- Full frontend unit suite: 361 passed, 1 failed. The existing `src/pages/Race/shared/charts/telemetry.test.ts` still scans `public/fastf1`, which is absent after the pre-existing private-data migration. This task does not change that test or restore private files to the public directory.
- No production imports, Storage writes, runner changes, commits or pushes were performed. A real CI run after deployment remains necessary for hosted-runner acceptance.
