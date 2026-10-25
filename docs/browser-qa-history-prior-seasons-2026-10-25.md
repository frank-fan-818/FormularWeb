# Prior-season circuit winners QA

- Date: 2026-10-25.
- Branch: `codex/season-fastest-pit-stop`; earlier local changes are preserved.
- Build / URL: production build at `http://127.0.0.1:4173`, `/races/13/info?season=2026`.
- Primary task: show the five most recent races with a classified winner before the selected season.

## Fix

The history query previously admitted earlier rounds within the selected season, and calendar rows without winners could occupy the five result slots. It also explicitly added the selected race's FastF1 payload to historical interruption statistics.

- History queries now require `season < selectedSeason`.
- Winner history is read in ordered pages until five valid winners are found or available races are exhausted. Empty/cancelled editions do not occupy winner slots; repeated pages cannot cause an infinite scan.
- The summary builder independently excludes current/future seasons, rows without a winner and entries beyond the five displayed results. Sample count and pole conversion use those displayed results.
- Historical interruption samples and probabilities also exclude the selected/future season. Their existing ten-season lookback and twelve-race query limit remain unchanged; this sample window is intentionally separate from the five winners.
- No historical winners, seasons or missing results are invented. A continuous annual event viewed from 2026 yields 2025–2021. Singapore skips the cancelled 2020 and 2021 editions and yields 2025, 2024, 2023, 2022 and 2019 when those results are available. [F1's account of the skipped editions](https://www.formula1.com/en/latest/article/watch-relive-the-fireworks-at-marina-bay-on-f1s-last-visit-to-singapore.3x9BtAvbeWk3ZV8EmLGNTq).

## Evidence

- API summary / history panel unit tests: 10 passed, covering prior-season bounds, missing results, maximum five winners, Singapore cancellations, selecting 2024 independently of the current year, statistics and unavailable data.
- Browser QA: all 9 history cases passed across desktop 1440×900, tablet 768×1024 and mobile 375×812.
- Regression fixture verifies the actual PostgREST `season=lt.2026` filter, candidate offsets 0 and 5, five populated winner rows despite a missing edition, and removal of current/future years from expanded status samples.
- Loading/empty history, unknown status frequencies, result names, expanded samples, mobile overflow and browser errors remain covered by the existing history checks.
- Production build, strict lint, UTF-8 and both performance budgets passed. No styles or UI copy changed.
- Screenshots: `artifacts/browser-qa/screenshots/history-prior-seasons-{desktop,tablet,mobile}-chromium.png` and `history-brief-{desktop,tablet,mobile}-chromium.png`.

Blocking findings: none. This report records checks before the authorized 1.5.0 submission; production deployment is separate.
