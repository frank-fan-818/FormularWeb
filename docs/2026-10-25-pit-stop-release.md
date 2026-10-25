# Pit stop timing and DHL Award — 1.4.0

## Scope and release identity

- Release type: `feat:`, minor bump from 1.3.0 to 1.4.0.
- Repository: `frank-fan-818/FormularWeb`.
- Release branch: `codex/pit-stop-award-release`, based on production `8908a28f26b63987c37b7289e4603d01e509b6ad`.
- Production project: `formular-web` / `prj_oult3EZeCTB7Vroi4grvDaFCMHvf`.
- Production origin: `https://frankpitwall.com`.
- Rollback target: `dpl_HHeqBfHaoLvBNoezwXSuSR4DYLiQ`, version 1.3.0, linked to the production base above.
- No database migration, credentials, or authentication-policy changes are required.

This batch was explicitly approved for push and production deployment. The current `develop` branch diverges from production and retains obsolete private-analysis exports. This release uses a protected PR into `main` from the production baseline; `develop` is preserved without merging its unrelated data into the release. All required checks and conversation resolution apply, with no protection bypass.

## Features and validation

- `/pit-stops` offers official season points and race leaderboards; race overview links to the matching event.
- Pit-lane and stationary timing remain separate. Missing or ambiguous stationary matches stay unavailable, rather than becoming zero or guessed values.
- Data-source discovery, pagination, official positions, upstream validation and invalid-request tests are included in `deployment:verify` for CI.
- Responsive, live-source and route evidence is recorded in [pit stop QA](browser-qa-pit-stops-2026-10-25.md).
- Credentials, browser traces, screenshots, dependency directories and private exports are excluded from Git and deployment uploads.

## Production verification record

The merged release commit, deployment ID, build identity, production checks and health-workflow run are recorded in the GitHub `v1.4.0` release after successful rollout. The version tag must point to the merged commit. GitHub `EXPECTED_RELEASE_VERSION` is updated to 1.4.0 only after the production origin confirms that version.

The server and CDN use bounded on-demand caches; this release does not add persistent database snapshots or scheduled history backfills. Earlier-than-2011 pit records are not populated by this adapter. Official Award and timing coverage remain source-dependent.
