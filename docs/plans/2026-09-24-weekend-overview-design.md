# Weekend overview simplification

Primary task: scan the weekend schedule and its timezone, then check circuit facts. Preserve the editorial index, red eyebrow, typography and status colors used throughout RaceDetail.

Considered retaining two cards (continues the empty sidebar), removing all grouping (weak day boundaries), and a single surface with three date columns and a circuit-facts footer (selected). Remove the duplicated schedule header and nested card borders. Reduce masthead index and turn boxed counters into inline metadata. Stack days on narrower screens. Keep existing timing, session-state and sprint logic.

Use existing spacing/surface/typography tokens. Readable completed sessions retain full opacity. Unknown circuit data stays a dash; missing schedule retains the empty state. Desktop 1440×900, tablet 768×1024 and phone 375×812 QA covers session counts, one schedule heading, circuit facts, overflow and screenshots.

QA 2026-09-24: production build at http://127.0.0.1:4173; 384 unit tests, strict lint, encoding and security checks passed. Browser suite: 48 passed, 19 intentional skips. Required home/race/driver/constructor/circuit routes checked at all three viewports; no new route errors or overflow. Screenshots: artifacts/browser-qa/screenshots/weekend-brief-{desktop,mobile,tablet}-chromium.png. No blocking findings.
