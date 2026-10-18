# Prediction improvement second round

Date: 2026-10-18 (Asia/Shanghai). Branch: `codex/points-completed-race-alignment`. Local implementation and verification; no production publication or database mutation.

## Result

Implemented independent recent-form windows, prior-only circuit history, timestamped confirmed roster/grid capture, positive full-history sample weighting, chronological temperature calibration and reproducible model comparison/promotion checks. All eligible 2026 rounds 1–17 remain in every final model's training data.

No candidate passed all promotion checks. The active artifact keeps the first-round baseline recipe in both phases, under feature schema 3. The improved feature recipes are available as evaluated challengers, rather than silently replacing a model after a known regression. Calibration is implemented but disabled because earlier chronological validation did not support it.

## Controlled experiments

All variants use the same 109 source races, 24 training iterations, 0.085 learning rate and 0.003 L2 penalty. Each target's features and fit use earlier races only. After 24 usable training races, there are 84 pre-weekend folds and 85 post-qualifying folds. The first 2022 preliminary roster cannot be built; the 2024 Australian preliminary roster misses returning Carlos Sainz and remains an evaluated coverage miss. No target winner or eventual grid is injected to repair those predictions.

Full output: `docs/model-artifacts/prediction-comparison.json`.

| Post-qualifying variant | Top 1 (85 races) | Top 3 | Log loss ↓ | Brier ↓ | 2026 top 1 |
| --- | ---: | ---: | ---: | ---: | ---: |
| First-round baseline | 62.35% | 91.76% | 1.11738 | 0.51807 | 12/17 |
| Independent windows | 62.35% | 90.59% | 1.10309 | 0.51340 | 12/17 |
| Windows + circuit history | 61.18% | 91.76% | 1.09131 | 0.50196 | 12/17 |
| Plus recent weighting | 62.35% | 92.94% | 1.07483 | 0.49397 | 11/17 |
| Plus season weighting | 62.35% | 92.94% | 1.07512 | 0.49518 | 11/17 |

Recent weighting uses a 24-race half-life. Season weighting halves the relative contribution for each older season. Every retained race has positive weight; these policies do not discard earlier 2026 rounds.

Candidate recipe selection uses only validation folds through 2025: lower log loss without lower baseline top-1 accuracy. This selects the baseline for pre-weekend and season-weighted windows/circuit inputs for post-qualifying. Temperature calibration must additionally improve Brier on those earlier validation folds; neither selected phase qualifies.

The post-qualifying candidate's 2026 log loss improves from 1.04146 to 0.90468 and Brier from 0.50556 to 0.44637, but top-1 drops from 12/17 to 11/17 and top-3 from 17/17 to 16/17. The promotion check therefore blocks it. These already inspected 2026 scores are a retrospective regression check, not an untouched test set; they are not used to tune an alternative.

Active artifacts: `race-prediction-models.json` and `race-prediction-recipe.json`. Selected candidate: `race-prediction-challenger.json`. Routine training reads the reviewed active recipe; it does not rerun model selection or promote a challenger automatically.

## Shared data behavior

- Driver windows use the latest 3/5/10 actual participations. Constructor windows use 3/5/10 distinct race meetings, including both drivers' outcomes without counting a team victory twice. No-history rates stay neutral. Windows supply win rate, podium rate, average finish and reliability; the baseline recipe remains available for exact comparisons.
- Circuit counts and grid-to-win conversion use prior completed races at the same circuit. Safety-car/red-flag values remain unknown because Jolpica does not supply them here. Historical final grids are used only as prior race history, never as the target's confirmed pre-start grid.
- Confirmed observations carry the actual local observation time and canonical Jolpica IDs. The optional adapter joins an exact OpenF1 race session to the season driver/constructor directories, reuses existing team aliases and refuses partial/ambiguous fields. Zero grid position means pit lane; it does not become pole position. Qualifying rank and confirmed grid rank remain separate.
- Unchanged observations keep their first availability time. A temporary loss of grid data cannot erase a previously confirmed grid for the same field. Changed fields/grids append a new observation. Historical feature generation honors the prediction cutoff and never backdates a downloaded observation.
- Pre-weekend archive evaluation uses the conservative race-start-minus-72-hours cutoff; post-qualifying uses just before race start. A live forecast uses its real generation time. Qualifying remains the existing phase-available source. Unknown confirmed entries fall back to qualifying or the previous race roster, with the estimate recorded explicitly.
- Optional reads follow the [OpenF1 driver/session/starting-grid documentation](https://openf1.org/docs/). API calls live in `src/api/preRacePredictionInputs.ts`; capture files are under `data/prediction/pre-race/`. Both workflows restore/cache observations, capture available updates and daily refresh includes them in its data artifact/PR.

## Verification

- Full unit suite: 521 passed at verification time; existing unrelated search, driver-profile and race-overview work was preserved.
- Prediction script TypeScript check, production TypeScript/Vite build, strict lint, UTF-8 check, workflow verification and `git diff --check` passed.
- Live capture test for 2026 round 18 returned `provider-unavailable` and wrote no fabricated observation. Consequently, actual confirmed-entry/grid coverage has not increased in the historical snapshots, and no accuracy gain from those live inputs is claimed. The adapter, canonical mapping, partial field rejection and failure paths passed mocked tests.
- Actual publisher dry run: 2026 round 18, pre-weekend, 22 candidates, Antonelli 32.6067%, roster `estimated`, grid `qualifying-proxy`; no database write. Output: `artifacts/prediction-second-round/current.json`.
- Browser QA: 47 passed, 19 existing viewport/service-worker skips. Build URL `http://127.0.0.1:4173`; Chromium desktop 1440×900, tablet 768×1024 and mobile 375×812. Required home/races/race-detail/driver/constructor/circuit routes and prediction details/loading/empty/error/retry flows passed their console/network assertions. No UI layout changes were introduced. Evidence: `artifacts/browser-qa-prediction-second/`.

## Activation and remaining evidence

This is version 0.22.7, a prediction-behavior fix. No commit, push, deployment, live migration or Supabase publication was requested or performed. The first-round evaluation-table migration and service-role deployment requirements still apply.

The next meaningful evidence is a future timestamped roster/grid capture and forecasts scored after unseen races. Candidate probability improvements alone do not establish higher winner-picking accuracy. Re-run the explicit comparison command after a separately reviewed model change; routine data refreshes preserve the active recipe.
