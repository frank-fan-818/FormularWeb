# Prediction automation reliability

Validated 2026-09-06, version 0.18.4.

The publisher reads every Jolpica page using the server's effective limit and merges races split across pages. Daily training-data refresh uses the same reader and now checks out `main`.

The scheduled publisher checks eligibility every 15 minutes on every UTC day, including Thursday/Friday qualifying and Saturday races. Publishing is limited to the 72 hours before the next race. It generates a preliminary forecast from the latest completed race field, then uses qualifying entrants when available. GitHub schedules can be delayed; the interval is a requested cadence, not a delivery-time guarantee.

Jolpica page requests retry transient failures. The workflow retries failed publication three times and has a 12-minute timeout. Both prediction workflows share a concurrency group with cancellation disabled, so a refresh cannot interrupt another publisher. A missing candidate field fails the run; it no longer reports a successful skip. Actions step summaries distinguish generated, published, unchanged, skipped and failed outcomes.

A run record without its expected driver candidate rows is repaired on retry. A complete publication with identical inputs remains unchanged. If qualifying temporarily disappears upstream, an already published post-qualifying forecast is preserved instead of being replaced with a preliminary forecast.

Validation:

- Real 2026 schedule audit: all 11 remaining rounds have a selectable future target and 22 candidate feature rows with the current available history. This checks readiness, not future driver changes or forecast accuracy.
- Current Italian GP dry run generates a post-qualifying forecast for 22 drivers.
- Publication tests cover incomplete-write recovery, idempotency and prevention of phase downgrade.
- 333 unit tests, TypeScript/production build, strict lint, workflow checks and secret scan passed.

Operational requirements: merge the changes to `main`, retain valid Supabase workflow secrets and enabled Actions schedules, and inspect failed Actions runs. A permanent upstream outage or unavailable credentials cannot be solved by retries. Changes to future entrants are incorporated when their qualifying results become available; the preliminary roster is an estimate based on the latest completed race.
