# Answer-First Information Architecture Design

## Product Direction

- Audience: mobile race-weekend visitors first, desktop data readers second.
- Primary task: identify the current or next race, championship leaders, and the latest completed round within five seconds.
- Secondary tasks: open the weekend schedule, standings, results, and deeper analysis.
- Information density: high, but summarized before detail.
- Desktop priority: show event status and four championship facts in one compact surface.
- Mobile priority: keep race, time, status, and leader gaps readable without horizontal overflow.

## F1 Data Product Fit

- First domain signal: the next unfinished session for the active championship.
- Race-control interaction: a compact global status strip links directly to the active weekend.
- Five-second facts: season progress, driver leader and gap, constructor leader and gap, latest completed round.
- Empty/loading/error states: preserve cached facts, label stale data, and keep navigation available when a module fails.

## Interface Choices

- Layout model: answer-first summary followed by short lists and explicit deep links.
- Typography: compact numeric hierarchy; no oversized marketing headline on data routes.
- Primary action: Ferrari red from `src/styles/design-tokens.css`.
- Status colors: existing race status tokens; color is never the only indicator.
- Motion: retain route continuity and state feedback only; no decorative copy animation.
- Accessibility: semantic headings, real buttons/links, visible focus, and 44 px mobile targets.

## Microcopy Rule

Keep copy only when it communicates a fact, state, source, unit, error, or action. Remove slogans, repeated descriptions, and phrases that merely announce that the page will help users “understand”, “explore”, or “see the full picture”. Metadata descriptions remain because they serve search and sharing rather than visible decoration.

## Architecture

Pure utilities derive the next session and championship summary from existing cached season data. The application shell reuses the same season cache for a global race signal. Home and standings render facts from those utilities. Race pages reuse their existing context and add direct previous/calendar/next navigation plus session result availability.

## Acceptance

- Viewports: 1440×900, 768×1024, 375×812.
- Routes: `/`, `/seasons`, `/races`, a current race info route, and the required detail routes.
- No new console errors or unexpected failed requests.
- Initial and home JS remain within the existing performance budgets.
- Screenshot evidence and an adversarial review are required before completion.
