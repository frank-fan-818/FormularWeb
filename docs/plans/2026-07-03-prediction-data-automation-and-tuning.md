# Prediction Data Automation and Tuning Implementation Plan

**Goal:** Automatically ingest completed 2026 races, refresh model artifacts through a reviewable pull request, and tune with time-safe evaluation.

**Architecture:** Normalize Jolpica data under `data/prediction/seasons/`, merge it with F1DB by season/round, then use a scheduled GitHub Action to verify and update one automation PR.

## Tasks

1. Add and test the snapshot contract and Jolpica mapper.
2. Add an idempotent sync command with timeout, retry, and check mode.
3. Merge complete snapshot races into the backtest while retaining local enrichments.
4. Add a daily/manual workflow that creates a reviewable PR.
5. Correct feature semantics, eval labels, constant features, and duplicated samples.
6. Tune on 2024, hold out 2025, and treat 2026 as forward evaluation.
7. Run targeted and full verification.
