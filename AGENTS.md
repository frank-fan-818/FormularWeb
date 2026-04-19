# FormularOneWeb Codex Project Rules

This repository contains project-specific skills under `.trae/skills/`. When working in this repo, treat those skills as the authoritative project workflow extensions.

## Project Context

- Stack: React 18, TypeScript, Vite, Ant Design 5, Zustand, React Router v6
- Main source layout:
  - `src/api/`
  - `src/hooks/`
  - `src/pages/`
  - `src/store/`
  - `src/types/`
  - `src/utils/`

## Core Coding Rules

- Reusable logic belongs in `src/hooks/`
- API calls belong in `src/api/`
- Shared types belong in `src/types/`
- Never hardcode secrets, tokens, passwords, or connection strings
- Keep `.env` files out of version control
- Avoid leaving `console.log` in shipped code
- Avoid complex business logic directly inside JSX

## Project Skills

Only use skills from `.trae/skills/` as repo-specific skills. Ignore third-party `SKILL.md` files under dependencies such as `node_modules/`.

### 1. `github-security-check`

Path: `.trae/skills/github-security-check/SKILL.md`

Trigger this skill when:
- preparing to run `git push`
- checking whether the repo contains secrets or sensitive files
- preparing to publish the project to GitHub or another public remote

Minimum checks:
- confirm `.gitignore` excludes `.env`, `.env.*.local`, `node_modules/`, logs, and build outputs
- scan for hardcoded API keys, tokens, passwords, webhook URLs, and database connection strings
- check for private key files such as `*.pem`, `*.key`, or `id_rsa`
- inspect `git status` before push/commit-related actions

If sensitive material is found:
- stop push-related work
- report the risky file or pattern clearly
- prefer removing it from version control, updating `.gitignore`, and rotating exposed credentials

### 2. `version-manager`

Path: `.trae/skills/version-manager/SKILL.md`

Trigger this skill when:
- preparing a commit that should affect release versioning
- updating `package.json` version
- creating a Git tag or release
- shipping a user-facing feature or fix

Versioning rules:
- `feat:` => bump minor
- `fix:` => bump patch
- `refactor:` => bump patch
- `perf:` => bump patch
- `docs:`, `style:`, `test:`, `chore:` => no version bump by default

Execution rules:
- decide the commit type first
- decide whether SemVer major/minor/patch applies
- update `package.json` before commit when a bump is required
- use `vX.Y.Z` format for tags

## Skill Order

If a task includes both versioning and pushing:
1. Run `version-manager`
2. Run `github-security-check`
3. Only then proceed to commit/push steps

## Source Of Truth

- Detailed project rules: `.trae/rules/project_rules.md`
- Project-specific skills:
  - `.trae/skills/github-security-check/SKILL.md`
  - `.trae/skills/version-manager/SKILL.md`
