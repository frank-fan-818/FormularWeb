# Content loading states

- Primary task: clearly signal which content is being fetched, without hiding existing data behind decorative animation.
- Replace content skeleton bars, scanning surfaces, phase legends and large standalone spinners with a compact red ring and a short contextual label.
- Reuse TimingBeacon's page, panel and inline API. Keep existing data requests, error states, empty states and retries.
- Cover prediction, recent winners, FIA upgrades, weather, analysis panels, profiles and archives, homepage, standings, race layout, sprint sessions, viewport tables, circuit image placeholders, chart fallbacks and route loading. Use the same ring for Ant Design table spinners.
- Preserve button submission feedback. Respect reduced-motion preferences with a static ring; keep status labels available to assistive technology.
- Acceptance: desktop, tablet and phone; light/dark themes; deliberately delayed data, successful completion and failure/retry flows; production build and performance budgets.
- Work remains local until the user explicitly authorizes submission.
