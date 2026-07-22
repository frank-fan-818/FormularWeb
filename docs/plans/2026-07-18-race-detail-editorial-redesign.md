# RaceDetail Editorial Race Control Redesign

## Product Direction

- Audience: F1 fans who want a fast race story first and progressively deeper evidence.
- Primary task: understand what happened in the weekend and why it mattered.
- Secondary tasks: inspect classifications, compare drivers, review strategy, telemetry, weather, history, and upgrades.
- Information density: high, with explicit 5-second, 30-second, and deep-analysis layers.
- Desktop priority: command-center context, large analytical canvas, fast comparison.
- Mobile priority: a compact race identity, clear horizontal navigation, and prioritized data without overlapping sticky controls.

## F1 Data Product Fit

- Domain signal users should notice first: race state, winner/pole/fastest lap, decisive movement, and interruptions.
- Race-control interaction: a persistent race command header, session rail, analysis jump rail, selectable driver series, and linked evidence.
- Scannable in under 5 seconds: race identity, podium, biggest mover, fastest lap, DNF count, and weekend state.
- States: preserve route skeletons and partial-data notices; add module-specific empty copy and visible source/freshness hints.

## Interface Choices

- Layout model: editorial hierarchy over an industrial 12-column race-control grid.
- Typography: condensed display numerals and headings; existing product body font for Chinese copy.
- Primary action color: Ferrari red, reserved for active navigation and decisive facts.
- Status and chart colors: existing design tokens and stable driver/status colors.
- Motion: restrained command-header reveal, hover lift, active rail transitions, and reduced-motion fallbacks.
- Accessibility: semantic headings, visible focus, 44px mobile targets, high contrast, no information encoded by color alone.

## Page Model

1. `results` becomes a true overview: podium, key stories, weekend pulse, then session classification.
2. `qualifying` leads with a purpose-built analysis header and moves raw evidence below the headline.
3. `race` presents the analytical modules as a numbered race debrief with a non-overlapping jump rail.
4. `sprint` uses the same visual grammar while keeping Sprint Qualifying and Sprint Race distinct.
5. `info` becomes Weekend Intelligence: schedule and circuit first, then conditions, history/risk, and upgrades.

## Acceptance

- Viewports: 1440x900, 768x1024, 375x812.
- Routes: `/races/:round/results`, `/qualifying`, `/race`, `/sprint` when available, and `/info`.
- Production build succeeds and relevant unit tests pass.
- No new console errors, clipped chart tooltips, overlapping sticky navigation, or unreadable mobile controls.
- Screenshots are captured after the final browser pass.
