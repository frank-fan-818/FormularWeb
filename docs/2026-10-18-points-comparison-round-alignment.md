# Points comparison round alignment

Date: 2026-10-18 (Asia/Shanghai)

## Root cause

`standingsProgressApi` combined Jolpica championship snapshots with `seasonApi.getSeasonRaces`, which prefers the Supabase calendar. The code checked contiguous round numbers but never checked that those numbers identified the same event across providers.

Read-only production checks found:

| Round | Standings/results provider | Supabase calendar |
| --- | --- | --- |
| 15 | Azerbaijan, 2026-09-26 | Azerbaijan, 2026-09-26 |
| 16 | Bahrain Grand Prix in Malaysia, 2026-10-04 | Singapore, 2026-10-11 |
| 17 | Singapore, 2026-10-11, published results | United States, 2026-10-25, future event |
| 18 | United States, 2026-10-25 | Mexico City, 2026-11-01 |

The two calendars had 23 and 22 rounds respectively. Singapore's R17 points were therefore rendered under a United States label. Filtering the database calendar to `round <= standings.round` did not establish that a race was completed or that its identity matched the snapshot.

Public observations: [standings](https://formular-web.vercel.app/f1-api/2026/driverStandings.json?limit=100), [provider calendar](https://formular-web.vercel.app/f1-api/2026.json?limit=100), [R17 results](https://formular-web.vercel.app/f1-api/2026/17/results.json?limit=100).

## Correction

The comparison reads published race winners from the same provider as its standings snapshots. This supplies completed-race identities and canonical round numbers in one request, replacing the mixed-source calendar read. It validates season, published classifications, completeness, unique and contiguous rounds before joining snapshots.

The displayed endpoint is the intersection of published races and available standings. If standings reference a newer round without a published race classification, the chart uses the last completed round's own standings snapshot. If results cannot be verified, the comparison shows its existing retry state instead of using an unrelated calendar. Official snapshot points, bounded concurrency, loading progress, missing-round gaps and caching are preserved.

This is a comparison-query correction; no database rows or related race IDs are renumbered.

## Regression coverage

- Driver and constructor snapshots with a deliberately shifted database calendar.
- R17 Singapore as the final chart row and tooltip; future United States event excluded.
- Standings advancing before a published race classification.
- Missing, incomplete and wrong-season classifications.
- Desktop, tablet and mobile charts, including loading, retry and missing snapshots.
