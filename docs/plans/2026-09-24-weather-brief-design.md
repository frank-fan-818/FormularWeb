# Weather brief

Primary task: quickly scan recorded session weather. Match the single-surface weekend schedule and history panels. Replace the bordered descriptions table with a semantic definition list: two temperature ranges first, followed by humidity, rainfall and maximum wind speed. Keep the section heading/source and use existing spacing, typography, neutral rules and surface tokens. No decorative icons or extra cards.

Desktop has five columns; tablet and phone place temperature ranges above the three compact metrics. Preserve loading, error/retry, missing summary, null-value formatters and rain interval count. No API/data changes. Verify three standard viewports, populated weather, wrapping values and existing route regression.

QA 2026-09-24: production build at http://127.0.0.1:4173. 384 unit tests; strict lint, encoding and security scans passed. Browser QA: 51 passed, 19 intentional project skips, at desktop 1440×900/tablet 768×1024/mobile 375×812. Required route smoke checks passed; weather values and rain interval count readable without overflow. Screenshots: artifacts/browser-qa/screenshots/weather-brief-{desktop,mobile,tablet}-chromium.png. No blocking findings.
