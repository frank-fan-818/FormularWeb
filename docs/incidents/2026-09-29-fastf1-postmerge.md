# FastF1 post-merge verification — 2026-09-29

## Confirmed failure

PR #70 merged as `54547408c457d1212f027d8dbcc96dfc56e08373`.
The first post-merge round-15 run, [36587785711](https://github.com/frank-fan-818/FormularWeb/actions/runs/36587785711), failed on both hosted runners. Official timing endpoints returned 403 and the mirror returned 404. Changing hosted operating systems did not restore source access.

Before recovery, private Storage contained a `2026/15/R.json` placeholder generated on May 28 with no classification or lap series; `R-telemetry.json` was absent. The other four round-15 sessions restored successfully.

The same exporter on the local network produced a complete race snapshot: one exported session, four restored sessions skipped, zero failures. Scoped manifest verification, database dry run and Storage dry run passed. These checks alone did not constitute production recovery.

## Collector configuration

The registered `FormularWeb-FastF1` Windows runner was online. The existing `FormularWeb-FastF1` scheduled supervisor task was running. Repository variable `FASTF1_RUNNER` was set to `fastf1-collector`, using the override already supported by the merged workflow.

Runs [36588806490](https://github.com/frank-fan-818/FormularWeb/actions/runs/36588806490) and [36589955962](https://github.com/frank-fan-818/FormularWeb/actions/runs/36589955962) failed during Python provisioning: the direct GitHub release download timed out. The official `actions/python-versions` 3.12.10 Windows archive was instead downloaded using `gh release download`. The embedded installer had a valid Python Software Foundation signature. Python was installed for the current user into the collector's dedicated tool cache, without adding it to the system PATH or installing the launcher. Python 3.12.10, ssl, venv and pip were verified before marking that cache complete.

The collector depends on this machine remaining powered on, connected and logged in. Its supervisor cannot guarantee availability during power loss or network outages. The current merged workflow still uses a hosted runner as recovery; that runner has not demonstrated timing-source access.

## Import preflight incident

A PowerShell invocation of `npm run fastf1:import-sessions -- ... --dry-run` did not forward the option flags. The importer silently ignored remaining positional values and selected its default scope. The process was stopped, but 170 historical rows had already been upserted. All 170 payloads were subsequently compared structurally against private Storage and matched exactly; import timestamps were updated. There is no pre-write database snapshot establishing the earlier timestamps or payloads, so this comparison is not described as a rollback.

The importer now rejects unknown and positional arguments before scanning files or writing rows. Three regression cases first failed, then passed after the fix. Use direct invocation from PowerShell to preserve flags:

```powershell
node --import tsx scripts/import-fastf1-session-analytics.ts --season 2026 --round 15 --session R --input <private-export-root> --complete-only --dry-run
```

Existing uncommitted collector and dotenv changes were preserved. The argument guard and its tests are included in PR #72.

## Local validation

- Build passed.
- Frontend unit suite: 67 files, 384 tests passed.
- Workflow verification: 44 tests passed; six workflow files validated.
- Database CLI integration suite including argument rejection: 10 tests passed.
- Private-snapshot race-analysis browser fixture: one passed, two intentionally skipped viewport cases. This is not a logged-in production browser check.

## Production acceptance

Collector run [36734942712](https://github.com/frank-fan-818/FormularWeb/actions/runs/36734942712) exported the missing race, imported five sessions and uploaded the complete race pair. Its first attempt rejected an immediate Storage read-back mismatch. The recovery attempt restored all five complete sessions, published and verified them, and finished with zero pipeline failures and zero consecutive failed runs.

Production read-back confirmed the race snapshot generated at `2026-09-30T15:15:21.423708+00:00` has 22 results, 22 lap series and 22 telemetry drivers. Its database payload exactly matched private Storage and passed the shared completeness checks. Production data recovery is established; a logged-in production browser session was not inspected.

The immediate mismatch followed a read of the old placeholder and disappeared on subsequent reads. This is consistent with a stale Storage response, but the transient response itself was not captured. PR #72 adds a fresh SDK `cacheNonce` and `cache: 'no-store'` to every private snapshot download, including each retry, while retaining byte-for-byte upload verification. A cache regression test failed before the change and passed afterward.

Windows acceptance also exposed inherited pip mirror configuration and Git Bash executable discovery under `mingw64/bin`. The workflow now installs pinned Python dependencies through isolated pip on the official index, disables user-site imports and locates Bash from supported Git installation roots. Targeted dependency updates restored the security gate; npm audit reported zero vulnerabilities.

Fresh round-15 run [36821437481](https://github.com/frank-fan-818/FormularWeb/actions/runs/36821437481), on cache-fix commit `66c53bd5`, passed on the first attempt. Production health showed all five steps successful, five complete sessions, five imported/published sessions and zero failures.

Full-season run [36821708324](https://github.com/frank-fan-818/FormularWeb/actions/runs/36821708324), on code commit `651606f3`, also passed on the first attempt. It restored 75 complete sessions, skipped re-exporting those sessions, imported/published all 75 and passed strict verification for all eligible rounds. Future incomplete placeholders were rejected during restore and excluded by the schedule. Independent read-back of `health/2026/all.json` confirmed this run ID, zero failed sessions, `pipelineFailed: false` and zero consecutive failed runs.

CI on `651606f3` passed security, lint, unit tests, types and Browser QA. The build job passed compilation, service-worker checks and bundle budgets but failed the Lighthouse LCP gate (five-run median 2.943 seconds versus 2.5 seconds). Local Lighthouse reproduced a 2.718-second median. The prior passing CI also had individual samples above the threshold; this suggests measurement variability but does not establish its cause. The threshold remains unchanged; final CI acceptance must be recorded separately.

PR #72 must be merged before its workflow changes become scheduled behavior on the default branch. Successful acceptance runs do not guarantee collector availability during host/network outages or prevent future upstream restrictions.
