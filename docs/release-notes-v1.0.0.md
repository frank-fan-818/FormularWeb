# FormularOneWeb 1.0.0 — release draft

Status: unreleased candidate. Do not publish this as a completed release while
the acceptance record in `docs/plans/2026-10-20-v1-release-p0.md` has open gates.

## Web product scope

- Season overview, race calendar, weekend sessions, published classifications
  and standings.
- Searchable driver, constructor and circuit profiles and historical records.
- Member access to available lap, telemetry, tyre-strategy and prediction data.
- Light/dark themes, responsive layouts and persistent display time-zone choices.
- Free guest browsing for public data, with account authentication for analysis.

## Release preparation fixes

- Password recovery now explains that a new password must differ from the old
  one, rather than presenting that input error as an authentication outage.
- Recovery requests now identify resend throttling correctly and explain that
  the latest email link must open in the browser that requested it.
- Updated Vite and the transitive redirect dependency to compatible security
  patches after the fresh release audit identified vulnerable versions.
- Connected `frankpitwall.com` to the existing deployment and configured project
  authentication mail through Resend; real signup and recovery were accepted.
- Production database permissions now match member-only analytics and prediction
  access. Guests and anonymous auth sessions cannot read those rows; browser
  clients cannot mutate business data or read diagnostics.
- Applied missing production diagnostics and prediction evaluation migrations;
  recovered the failed prediction data refresh.
- Stabilized the Firefox guest-reload regression by waiting for the original
  document load before reloading it.
- Verified a real retained-deployment rollback and restoration, monitoring of
  the exact current online version, and owner receipt of failure notifications.

## Limits and pending publication work

- Production rollout and online version verification remain required before
  publication. Code-candidate CI, custom SMTP and real new-domain signup/recovery
  acceptance passed on 2026-10-21; retain all required checks on the final PR head.
- The maintainer has chosen to retain current third-party images and marks for
  non-profit use. Source records exist; usage authorization has not been
  independently verified and is retained as a documented limitation.
- Data coverage and timing depend on the upstream sources. Unavailable sessions
  use explicit empty/error states; model predictions are not official results.
- Time zones are fixed UTC offsets and do not follow regional daylight-saving
  changes.
- Native Android store distribution and real-device iOS certification are not
  part of this Web release.

## Publication record to fill after acceptance

- Code candidate CI: `2e3d1668ca8427200fd2ae3e534f125339ced51e`,
  https://github.com/frank-fan-818/FormularWeb/actions/runs/39551388530
  (all six jobs passed; 551 unit tests, 304 browser checks, 35 designed skips,
  no retries or flaky tests).
- Final accepted commit and CI run:
- Production deployment and verified `/release.json` identity:
- Rollback deployment:
- Stable tag and GitHub Release:
