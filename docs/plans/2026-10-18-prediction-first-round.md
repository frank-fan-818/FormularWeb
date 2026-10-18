# Prediction Reliability First Round Implementation Plan

**Goal:** Use the same features in training and publication, fit separate pre-weekend and post-qualifying models, include every completed 2026 race, and score immutable published forecasts.

**Architecture:** Keep experimental backtests separate. The production trainer and publisher share the existing raw-race input builder and feature functions. Train on all eligible 2022–2026 races, fit final models including the last completed race, and use expanding chronological folds for evaluation. Store actual-publication scores separately from model backtests.

**Tech Stack:** TypeScript, Vitest, Node/tsx, Supabase Postgres, GitHub Actions.

## Decisions

- Implement the agreed scope in this session; preserve unrelated search work.
- Support the two phases for which current publication has real inputs. A practice phase needs the later data integration round.
- Use completed prior races only; never use the target's result, eventual grid penalties or future sessions as inputs. Pre-weekend entrants come from the prior field, and missing winners count as failed coverage rather than disappearing from evaluation.
- Historical seasons remain in training. Every eligible current-season race is retained exactly once; no short rolling training cutoff or duplicate oversampling.
- A shared feature schema and a content-based model identifier prevent silently mixing incompatible artifacts.
- No claim that more data automatically increases confidence. Report sample counts, coverage and held-out probability metrics by phase and season.
- Preserve legacy experimental models/artifact; publish only the newly validated phase-specific artifact.

## Task 1: Shared feature and history boundaries

Files: `src/utils/currentRacePrediction.ts`, its tests, `src/utils/winnerFeatureBuilder.ts`, `src/types/predictionData.ts`.

Write failing tests for chronological history, cross-season form/current-season standings, missing qualifying, phase session masking and retirement reliability. Run targeted Vitest, implement shared input preparation, rerun tests. Historical target outcomes must not affect features.

## Task 2: Production training and full-season inclusion

Files: `src/utils/racePredictionTraining.ts`, its tests, `src/types/racePredictionModel.ts`, `scripts/prediction-history.ts`, `scripts/train-race-prediction.ts`, package scripts.

Test disjoint expanding folds, all completed 2026 rounds in final training, separate phases, rejection of incompatible/future-trained artifacts and stable inference. Refresh 2026 data, build phase models and report per-phase/season metrics. Keep the legacy research command available separately.

## Task 3: Publication and actual forecast scoring

Files: publisher, `src/utils/racePredictionEvaluation.ts`, evaluation tests, `scripts/evaluate-race-predictions.ts`, SQL migration, prediction workflows.

Test phase selection and truthful training provenance; score saved candidate probabilities against actual winners, excluding late/incomplete publications, and choose the latest valid forecast per phase for aggregate reporting. Use paginated reads and idempotent score writes without changing forecast rows. Wire daily evaluation and fresh model training into automation.

## Task 4: Verification and delivery

Run targeted tests first, then full unit tests, TypeScript, strict lint, encoding checks, workflow validation and production build. Run a real training/backtest with 2026 data and a publisher dry run. Document metrics and activation requirements; do not deploy or mutate live forecasts/database during local verification.
