# Prediction reliability first round

Date: 2026-10-18 (Asia/Shanghai). Local verification; no production database mutation or forecast publication.

## Implementation

- Production training and publishing share `buildCurrentRaceFeatureInputs` and `buildWinnerCandidates`, including normalization, history order, missing values and qualifying pace formulas. Experimental backtests remain under `npm run prediction:experiment` and are not publication artifacts.
- Separate `pre_weekend` and `post_quali` models use only sessions available in their phase. No practice phase is claimed until practice inputs are integrated.
- Historical snapshots use Jolpica identifiers throughout, avoiding discontinuities between F1DB and Jolpica driver IDs. Current-season standings exclude previous seasons; recent form can cross a season boundary. All target/future race results are filtered out before calculating inputs.
- Every eligible completed race is retained once. The final model is fitted after the backtest loop and includes the latest completed race; it is not the last fold's model. Publication rejects incompatible schemas, a training cutoff reaching the target, and missing eligible training rounds. Model identifiers include the phase and a content hash.
- Pre-weekend rosters use the prior race's field, matching the existing real publisher. Unknown future entrants are not inferred from eventual results. The first 2022 race has no prior roster; 2024 round 3's preliminary roster lacks the eventual winner Carlos Sainz after his previous-round absence. That race remains a coverage miss in the backtest instead of disappearing or becoming an invalid training label.
- Driver retirement reliability uses the race distance rather than the retired driver's own lap count.
- Saved forecasts are scored separately and idempotently in `prediction_evaluations`. Only forecasts generated before race start, with a valid cutoff and complete probability field, are eligible. Original forecast/candidate rows are never changed. Missing eventual winners are misses, not excluded samples. Aggregate reports choose the latest valid publication per race and phase to avoid counting frequent refreshes as extra races.

## Data and results

Refreshed 109 completed races: 2022 = 22, 2023 = 22, 2024 = 24, 2025 = 24, 2026 = 17 (rounds 1–17). Unfinished/future races are not training examples. Both final models include all 17 completed 2026 rounds.

The production artifact is `docs/model-artifacts/race-prediction-models.json`, feature schema 2. Training keeps the existing rolling trainer's 24 iterations, 0.085 learning rate and 0.003 L2 penalty. Folds expand chronologically after 24 usable training races; the target outcome is a label only. No hyperparameter tuning or confidence calibration is claimed.

| Phase | Final training races | Varying features | Backtest races | Top 1 | Top 3 | Log loss | Brier |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Pre-weekend | 107 | 32 | 84 | 46.4% | 67.9% | 1.9432 | 0.6855 |
| Post-qualifying | 109 | 49 | 85 | 62.4% | 91.8% | 1.1174 | 0.5181 |

| 2026 folds only | Races | Top 1 | Top 3 |
| --- | ---: | ---: | ---: |
| Pre-weekend | 17 | 35.3% (6/17) | 58.8% (10/17) |
| Post-qualifying | 17 | 70.6% (12/17) | 100% (17/17) |

These are chronological offline results, not newly observed production accuracy. The complete-history model does not establish an accuracy improvement over the earlier experimental report. More data does not automatically justify more confident probabilities; preliminary forecasts remain considerably less accurate. Later rounds can compare recency weighting and probability calibration on held-out time periods without removing completed 2026 races.

Real publisher dry run: 2026 round 18, pre-weekend, 22 candidates; Antonelli 32.61%, Verstappen 17.18%, Russell 16.83%. Model `winner-v2-pre_weekend-72ad553a4ddf6e50`. Output: `artifacts/prediction-current.json` (ignored, no publication).

## Verification

- Prediction regression tests: 88 passed, covering shared features, chronological cutoffs, phase masking, complete 2026 inclusion, analytical training gradient, immutable scoring, pagination, dry-run reads and publication recovery.
- Full unit suite: 497 passed at verification time; concurrent unrelated search/history edits are preserved.
- `npm run prediction:type-check`, production `npm run build`, strict lint, encoding check and workflow verification passed.
- Browser route/prediction checks: 47 passed, 19 skipped by existing viewport/service-worker conditions. Tested `/`, `/races`, `/races/1`, driver, constructor and circuit routes plus prediction loading/empty/error/retry and details flows on Chromium at desktop 1440×900, tablet 768×1024 and mobile 375×812. Existing console/network assertions passed. Build URL: `http://127.0.0.1:4173`; no UI layout changes were introduced. Test output and screenshots are under `artifacts/browser-qa/test-results/`.

## Activation

1. Apply `supabase/migrations/20261018000100_prediction_evaluations.sql` using the normal database deployment process. The evaluation table is service-role-only with RLS; no anonymous/member grants are introduced.
2. Deploy/merge the reviewed prediction changes, historical snapshots and model artifact. Both prediction workflows retrain using the production trainer; the frequent publisher refreshes completed current-season results before fitting, avoiding a lag behind an unmerged data-refresh PR.
3. Retain existing workflow `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` secrets. Daily refresh runs `prediction:evaluate`, writes separate score rows and retains its report as a private Actions artifact for 90 days.
4. Inspect the first refreshed publication and actual-evaluation report. Do not substitute backtest metrics if no original forecasts can be read.

This local environment has a Supabase URL but no service-role credential. Real database evaluation and migration application have therefore not been run. The read/write transport and idempotent scoring were verified against mocks; production readiness still requires the migration and first authenticated scoring run.
