# Compact home weekend schedule

## Product direction

- Audience: F1 fans checking the next weekend from the home page.
- Primary task: identify the next session and its local start time within five seconds.
- Secondary task: compare all five session times without opening race details.
- Information density: high; preserve dates, times, timezone and meaningful session states.
- Desktop priority: a single shared strip with five compact columns, two lines per session.
- Mobile priority: five compact rows with session/status on the left and date/time on the right.

## Interface choices

- Use the existing typography, spacing, border and theme tokens. Remove redundant session abbreviations and repeated upcoming labels.
- Show month/day and time only; omit weekday names as requested.
- Keep the next/live/completed labels; emphasize next/live using a thin Ferrari-red accent and restrained tint.
- Prefer this visible schedule over a collapsed panel (extra interaction) or horizontal carousel (hidden sessions).
- Leave fetching, timezone conversion, ordering, date/time fallbacks, loading, empty and error handling in the existing data flow.
- Static rows remain non-interactive. Preserve machine-readable times and legible tabular numerals.

## Acceptance

- Check `/` at 1440 x 900, 768 x 1024 and 375 x 812 in light/dark themes, including sprint and regular weekends.
- Inspect console and network failures; check the existing core-route smoke suite and timezone regression.
- Save schedule screenshots and browser findings under the existing QA artifact/report locations.
- Treat as `style:` presentation cleanup; keep version 1.2.0. No commit, push or deployment is part of this request.

## Race-detail extension

- Apply the same compact layout to `RaceWeekendOverview`, using `src/styles/weekend-schedule.css` for both surfaces.
- Flatten the existing date groups for display without changing the scheduling API or its timezone conversion. Show each session's month/day beside its time.
- Remove weekday headings, duplicated abbreviations, repeated upcoming states and the source subtitle. Preserve collected-result badges, meaningful session states, timezone accessibility text, the empty state and the circuit-facts footer.
- Extend the existing race schedule browser check to both themes and all three viewports. Update the timezone regression to verify actual session dates across midnight rather than removed day containers.
