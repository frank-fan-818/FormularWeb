# Branching Strategy

## Branch roles

- `main` is the production branch. It must always point to a release-ready commit.
- `develop` is the test and integration branch. Features, maintenance, dependency updates, and automated data refreshes merge here first.
- `feature/*`, `fix/*`, `refactor/*`, and `perf/*` branches start from `develop` and merge back into `develop` through Pull Requests.
- `hotfix/*` branches start from `main` for urgent production fixes. After release, merge the same fix into `develop` to prevent regression.

## Normal delivery flow

1. Update local `develop` from `origin/develop`.
2. Create a short-lived work branch from `develop`.
3. Open a Pull Request into `develop` and wait for CI to pass.
4. Test the integrated result on the preview/test deployment.
5. Open a release Pull Request from `develop` into `main`.
6. Run the complete release checklist on the exact release commit.
7. Merge without force-pushing, tag the release as `vX.Y.Z`, and deploy `main`.

## Production invariants

- Do not commit feature work directly to `main`.
- Do not merge `develop` into `main` while required CI checks are failing or pending.
- `main` must remain deployable and retain the previous production deployment as a rollback target.
- Version bumps and changelog entries are completed before the release Pull Request is merged.
- Database migrations, production environment variables, authentication redirects, and rollback steps are verified before deployment.

## Required GitHub settings

Protect `main` with these repository rules:

- Require a Pull Request before merging.
- Require the `Security`, `Lint`, `Type Check`, `Test`, `Build`, and `Browser QA` checks.
- Require branches to be up to date before merging.
- Block force pushes and branch deletion.
- Apply the rules to administrators when the repository plan supports it.

Protect `develop` against force pushes and deletion. Pull Requests are recommended for all changes, while maintainers may choose a lighter review requirement than `main`.
