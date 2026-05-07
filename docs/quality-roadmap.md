# Quality Roadmap

## P0

- Remove mojibake from source comments and user-facing copy.
- Keep `.claude/` reference bundles out of version control; extract durable project rules into `.trae/skills/`.

## P1

- Continue decomposing `src/pages/RaceDetail.tsx` into utilities, hooks, and `src/components/race-detail/`.
- Replace high-propagation `any` in API and table contracts with shared types.
- Add browser QA reports for core routes after chart or data-loading changes.

## P2

- Add page design briefs for new route-level pages.
- Standardize ECharts option builders and no-data states.
- Expand tests around history summaries, race schedule timezone handling, and FastF1 derived chart data.

## Completed

- Added first RaceDetail formatter extraction and tests.
- Added browser QA, chart, and design brief documentation.
