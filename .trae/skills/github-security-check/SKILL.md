---
name: "github-security-check"
description: "Check for secrets, sensitive files, unsafe ignores, and publish risks before pushing or making the project public."
---

# GitHub Security Check

Use this skill when preparing to run `git push`, checking whether the repo contains secrets, or preparing to publish the project to GitHub or another public remote.

## Minimum Checks

### Ignore Rules
- Confirm `.gitignore` excludes `.env`, `.env.local`, `.env.*.local`, `node_modules/`, logs, caches, coverage, and build outputs such as `dist/` and `build/`.
- Confirm `.claude/` stays ignored unless a future change explicitly whitelists a small, reviewed reference file.

### Secret Scan
- Scan source, config, scripts, docs, and staged files for hardcoded API keys, tokens, passwords, webhook URLs, and database connection strings.
- Check for private key files such as `*.pem`, `*.key`, `id_rsa`, and `id_ed25519`.
- Check that `.env` files are not tracked or staged.

### Git Review
- Inspect `git status` before commit or push-related work.
- Inspect `git diff --cached` before pushing staged changes.
- Stop push-related work if sensitive material appears.

## Suggested Commands

```bash
git status --short
git diff --cached
rg -n "API_KEY|SECRET|PASSWORD|TOKEN|WEBHOOK|DATABASE_URL|SUPABASE.*KEY|PRIVATE KEY" .
rg --files -g ".env*" -g "*.pem" -g "*.key" -g "id_rsa" -g "id_ed25519"
```

## If Sensitive Material Is Found

1. Stop commit or push work.
2. Report the risky file and pattern clearly.
3. Remove the material from version control and update `.gitignore`.
4. Rotate exposed credentials before publishing.
