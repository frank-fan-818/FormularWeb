---
name: "version-manager"
description: "Manage semantic versioning for user-facing features, fixes, releases, and tags."
---

# Version Manager

Use this skill when preparing a release-worthy commit, updating `package.json` version, creating a Git tag, or shipping a user-facing feature or fix.

## Version Rules

The project uses SemVer in `X.Y.Z` format. The first stable Web release targets
`1.0.0`; this is an explicit release decision, not a requirement to count through
all `0.x.x` versions. Preparing that version in source does not mean it has been
published: the final release checklist and production verification must pass
before creating the stable tag and GitHub Release.

| Commit Type | Version Change | Use For |
|-------------|----------------|---------|
| `feat:` | minor | New user-facing features, pages, or components |
| `fix:` | patch | Bug fixes and user-visible content fixes |
| `refactor:` | patch | Behavior-preserving code restructuring |
| `perf:` | patch | Performance improvements |
| `docs:` | none by default | Documentation-only changes |
| `style:` | none by default | Formatting and visual-only code style |
| `test:` | none by default | Test-only changes |
| `chore:` | none by default | Build, tooling, and maintenance |

## Workflow

1. Inspect the change scope.
2. Decide the commit type.
3. Decide whether a SemVer bump applies.
4. Update `package.json` before committing when a bump is required.
5. Use commit messages in this format:

```text
<type>: <description>

Version: X.Y.Z
```

6. Use tag format `vX.Y.Z` when creating a release tag:

```bash
git tag -a vX.Y.Z -m "<type>: <description>"
```

## Notes

- Do not bump the version for documentation-only roadmap updates unless the user asks for a release.
- If both versioning and pushing are requested, run this skill before `github-security-check`.
