# Prediction Improvement Second Round Implementation Plan

**Goal:** Independently improve recent form and circuit inputs, compare full-history weighting policies, and validate chronological probability calibration while retaining every eligible completed 2026 race.

**Architecture:** Extend the shared feature input builder, retain an explicit baseline feature recipe for ablations, and version the feature schema. All training folds and calibration examples precede the race being evaluated. Fit final models on all eligible history. Preserve unrelated search, driver and race-overview edits.

**Tech Stack:** TypeScript, Vitest, Node/tsx, existing Jolpica snapshots, optional OpenF1 pre-start observations, Supabase publication contract.

## Decisions and contract

- Use genuinely distinct 3/5/10 prior participations for driver form and 3/5/10 distinct race meetings for constructor form. Constructor win rates count races, not two driver rows as two races.
- Circuit inputs use completed prior races at the same circuit. Target/future outcomes never provide circuit history. Unknown safety-car and weather information stays unknown.
- A confirmed entry list or grid is a timestamped observation: `{ observedAt, source, entries: [{ driverId, constructorId, gridPosition? }] }`. Only complete, unambiguous observations before both prediction cutoff and race start can override an estimated roster. A grid position of zero means pit lane; missing means unknown. Qualifying position remains a separate value.
- Optional OpenF1 reads: GET `/v1/sessions` (race date identity), `/v1/drivers` and `/v1/starting_grid` by exact session key, joined to Jolpica season driver/constructor directories. Record local observation time, never invent historical availability. Missing/unavailable/ambiguous data falls back to existing estimates and is reported explicitly.
- Save observations under `data/prediction/pre-race/`; deduplicate identical payloads while retaining their first observed time. Both trainer and publisher load the same files. Do not backfill eventual race-result grids as historical pre-start observations.
- Ablations: existing baseline; windows only; windows plus circuit history. Compare equal, exponential recency and season weighting on the full dataset. All sample weights must remain positive.
- Policy selection uses only earlier seasons (through 2025); report 2026 separately as already inspected retrospective data. Do not call 2026 an untouched test set. Retain equal weighting unless a candidate improves validation log loss without reducing validation top-1 accuracy.
- Temperature calibration uses only earlier out-of-fold forecasts, never fitted training predictions or the current target. Report raw and calibrated probability errors and preserve ranks. Enable it only when earlier chronological validation supports it.
- This is a fix to prediction behavior: patch version increment. No commit, push, migration or production publication is requested.

## Tasks and verification

1. Add failing tests for independent windows, constructor meeting counts, prior-only circuit history, confirmed roster/grid cutoffs and pit-lane semantics. Implement shared inputs and feature calculation; run targeted Vitest.
2. Add weighted-gradient and chronological-calibration tests. Implement positive race weights, policy metadata, temperature prediction and schema validation. Run targeted tests and the prediction CLI TypeScript check.
3. Implement optional pre-race API transport, mapping tests, capture/load commands and workflow wiring. Verify provider failures/unknown identities do not silently produce partial confirmed fields.
4. Run controlled chronological ablations with unchanged folds and training settings. Select weighting/calibration from earlier-season validation, refit all 2026 rounds and save a reproducible comparison artifact/report.
5. Verify a real publisher dry run, full unit tests, production build, lint, encoding, workflow validation and prediction browser regression. Report improvements and regressions, coverage and activation requirements honestly.
