# Race history brief

Primary task: compare the circuit’s five most recent results and understand the frequency of historical track statuses. Secondary task: inspect the underlying sample years.

The former two-card layout repeated four statistics, squeezed the sample table into a narrow sidebar, and left most of the lower page empty. Options considered: keep equal-height cards (preserves duplication), stack all content (too much scrolling), or one brief with a results-first split and full-width disclosure (selected).

Desktop uses roughly two thirds for results and one third for four compact status bars. Sample count and pole conversion use inline statistics; the misleading arithmetic mean of overlapping status probabilities is removed. Samples expand across the entire surface. Tablet stacks the two sections; phone renders historical rows in a labelled grid with no horizontal scrolling. Existing loading, empty, retry, membership and feature-flag behavior stays available.

Reuse design tokens for surfaces, spacing, typography and SC/VSC/red/yellow colors. Bars share a zero-to-100 scale and retain explicit percentages and counts; unknown values stay unknown. Status frequency is historical, not a prediction. Native details supports keyboard access and visible focus. English and Chinese copy are maintained.

Acceptance: production build; targeted analytics and translation tests; 1440×900, 768×1024 and 375×812 browser checks, populated/empty/error states, keyboard expansion, unclipped sample tags and no page overflow. Evidence is saved under artifacts/browser-qa/screenshots/history-*.png.

## Verification

- Date: 2026-09-24
- Branch: codex/redesign-race-history-brief
- Build URL: http://127.0.0.1:4173 (production build)
- Routes: /, /races, /races/1, /races/13/info?season=2026, /drivers/max_verstappen, /constructors/red_bull, /circuits/monaco, plus authentication/settings smoke routes.
- Viewports: desktop 1440×900, tablet 768×1024, mobile 375×812.
- Results: 384 unit tests passed; build, strict lint, UTF-8 and security scans passed. Browser smoke and history suite: 45 passed, 19 intentional project skips. Existing session resilience suite: 11 passed, 4 intentional skips, including the stalled-history retry flow.
- Findings: populated and empty history, unknown probabilities, disclosure keyboard operation and wrapping sample tags pass. No page or result-table overflow, console exceptions or unexpected failed requests in the populated history flow.
- Screenshots: artifacts/browser-qa/screenshots/history-brief-{desktop,mobile,tablet}-chromium.png and history-samples-{desktop,mobile,tablet}-chromium.png. Screenshot capture hides sticky shell elements to expose panel content.
- Blocking issues: none.
