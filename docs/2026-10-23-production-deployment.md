# Production deployment — loading improvements

- Date: 2026-10-23 (Asia/Shanghai).
- Production: https://frankpitwall.com
- Version/build: `1.2.2 / cacf09a80145`.
- Vercel project: `formular-web` (`prj_oult3EZeCTB7Vroi4grvDaFCMHvf`).
- Deployment: `dpl_HLtmVbf4BXk71pqfurF2WJAnsrTB`.
- Deployment URL: https://formular-4wpsi6hj9-frankfan060818-1597s-projects.vercel.app
- Previous known-good production: `dpl_B8soyL9y19QqD8n72BdVdie5hGD9`.
- No database migration was needed.

The initial P0–P3 deployment was uploaded from the local working tree with the Vercel CLI, built remotely using production configuration, tested at the candidate URL, and promoted using the Vercel API. At that point the branch was `codex/compact-schedules-and-headings`, based on `e207dfe8`, and its release changes had not been committed or pushed. That was an incomplete release workflow. The follow-up source synchronization uses `codex/loading-performance-release`, based on the equivalent merged main tree, and includes all release source and the explicit complete-release rules in `AGENTS.md` and `.trae/rules/project_rules.md`. GitHub PR/commit and Vercel deployment records provide the final revision identity. `.vercelignore` excludes local credentials, private exports, and QA artifacts from upload.

## Verification

- Source security scan, deployment configuration/tests and service-worker freshness checks passed before upload.
- Remote Linux/Node 24 production build succeeded.
- Candidate: release identity, Motorsport RSS, FIA RSS, Reddit Atom and race classification all returned 200.
- After promotion, `npm run deployment:verify:live` passed all nine checks: home, login, security headers, release identity, service worker, missing asset 404, private analysis boundary, season proxy and hashed asset.
- Two consecutive reads on production: all three news sources and the R17 classification returned 200; second reads had `x-vercel-cache: HIT`, with observed end-to-end times 88–97 ms from this test location.
- Guest browser: `/news` displayed 15 items and `/races/17/results?season=2026` displayed 22 rows, without uncaught page exceptions. Diagnostic Performance entries were present.
- Observed cold guest content times were 4.316 seconds for news and 6.717 seconds for race detail; these single samples include route/module downloads and are not a controlled comparison with earlier measurements.
- GitHub `EXPECTED_RELEASE_VERSION` updated from `1.1.0` to `1.2.2`; production URL remains `https://frankpitwall.com`.
- Remote production health run succeeded: https://github.com/frank-fan-818/FormularWeb/actions/runs/39892546618

Local ignored evidence: `artifacts/production/verification.json`, `cache-verification.json`, `browser-verification.json`, `news-desktop.png`, `race-desktop.png`.
