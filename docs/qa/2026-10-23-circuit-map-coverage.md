# Official white circuit map QA

- Date: 2026-10-23.
- Branch: codex/ui-loading-polish-release; local uncommitted batch after release 1.2.5.
- Build URL: production bundle served temporarily at http://127.0.0.1:4173.
- Routes: `/circuits`, Shanghai, Monaco, Jeddah and Adelaide profiles; required smoke routes `/`, `/races`, `/races/1`, `/drivers/max_verstappen`, `/constructors/red_bull`, `/circuits/monaco`.
- Viewports: desktop 1440×900, tablet 768×1024, mobile 375×812; light/dark themes and reduced motion.
- Change: both atlas previews and detail diagrams now use official local images only. Removed outline/manual-overlay rendering, graph-paper backgrounds and thumbnail contrast/rotation effects. Preview, detail, unavailable and zoom surfaces remain white in both application themes.
- Sources: 32 maps with official page/image provenance, source year, WebP signatures and SHA-256 verification. Coverage includes 2026 calendar circuits and available recent historical tracks. Historical circuits without a verified source have an explicit unavailable state; failed assets do not fall back to unofficial outlines.
- Interactions: lazy list previews preserve card navigation; detail maps have a full-resolution white native dialog. Close button, Escape dismissal, keyboard focus return and native image width are verified. Delayed and failed-image paths are covered.
- Validation: 651 unit tests passed, including 43 official-map coverage/alias/integrity checks. Nine circuit browser tests and six required route smoke tests passed. Strict lint, encoding, font verification, production build and performance budgets passed.
- Browser findings: successful detail flows produce no unexpected console errors or failed requests. No horizontal page overflow in the checked themes/viewports. The zoom canvas intentionally scrolls the full-size image within its own viewport.
- Performance: initial JS 80.4 KiB gzip; Home path 91.9 KiB gzip; optional analysis APIs stay outside the critical race graph. Total map assets are approximately 2.58 MB; pages request their own images, and list previews are lazy.
- Screenshots: ignored `artifacts/browser-qa/screenshots/circuit-jeddah-white-{light-mode,dark-mode}-{desktop,mobile,tablet}-chromium.png`, corresponding `circuit-jeddah-zoom-*` images, and `circuit-atlas-white-*` full-page screenshots.
- Blocking: none for the changed image flow. Historic coverage is limited to verified available official sources. Existing Jeddah specification-card distance/lap-record values require a separate data audit.
- No commit, push or deployment performed for this batch.
