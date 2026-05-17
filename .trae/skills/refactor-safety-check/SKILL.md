# refactor-safety-check

Use this skill when splitting large files, extracting hooks/utilities, changing API contracts, or removing `any`.

## Rules

- Inspect `git status` and protect unrelated user changes before editing.
- Prefer small behavior-preserving extractions with tests.
- Extract pure functions before moving stateful React logic.
- Keep API calls in `src/api/`, reusable state/data logic in `src/hooks/`, shared types in `src/types/`, and pure helpers in `src/utils/`.
- Add or update tests for data mapping, time/date logic, scoring logic, search, and derived chart data.
- Do not combine unrelated redesigns with refactors.
- Run targeted tests first, then broader checks.

## Evidence To Report

- What behavior was preserved.
- Which tests cover the extraction.
- Any remaining large-file or typing debt.
