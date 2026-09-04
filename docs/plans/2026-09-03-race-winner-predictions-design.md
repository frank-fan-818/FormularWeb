# Race Winner Predictions Design

## Product Direction

- Audience: F1 viewers who want a fast, evidence-backed pre-race favourite.
- Primary task: identify the most likely winner for the next or selected race and understand how fresh the prediction is.
- Secondary tasks: compare the top three candidates and see which prediction phase produced the result.
- Information density: medium on Home, high on Race Info.
- Desktop priority: keep the prediction beside the active weekend context.
- Mobile priority: preserve the winner, probability, phase, and freshness before secondary factors.

## Architecture

Training and backtesting remain offline jobs. A short-lived prediction publisher fetches the current season, builds a feature vector from completed races and the newest qualifying or sprint data, loads the approved model artifact, and idempotently publishes a prediction run plus ranked candidates to Supabase. The React app only has anonymous read access.

The first release uses the existing GitHub Actions and Node toolchain to run the publisher frequently. The publisher is kept independent of GitHub-specific APIs so it can be moved to Supabase Edge Functions later without changing the database or frontend contracts.

## Freshness Contract

- `pre_weekend`: refresh when the entry field or latest completed result changes.
- `post_quali`: refresh when qualifying data becomes available; this is the final pre-race phase.
- Every run records `generated_at`, `data_cutoff_at`, `input_hash`, and `model_version`.
- The UI treats a prediction older than six hours as stale and says so explicitly.
- Predictions are never regenerated from race results after the race has started.

## Interface Choices

- Home: compact prediction strip within the next-race command surface.
- Race Info: full prediction panel after weather and before historical context.
- Ferrari red marks the predicted winner; existing design tokens supply all other visual constants.
- Loading, empty, stale, and error states remain distinct.
- Probability is presented as model confidence, not certainty.

## Acceptance

- Viewports: 1440x900, 768x1024, 375x812.
- Routes: `/` and `/races/:round/info?season=:season`.
- No new console errors; a missing prediction is a normal empty state.
- Unit coverage includes row validation, freshness, phase labels, and result mapping.
