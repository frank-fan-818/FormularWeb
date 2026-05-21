# FormularOneWeb Project Rules
Version: 1.7
Updated: 2026-05-21

## 1. Project Context

### Stack
React 18 + TypeScript + Vite + Ant Design 5 + Zustand + React Router v6

### Main Source Layout
```text
src/
├── api/        # API access and remote data logic
├── hooks/      # Reusable business logic and data hooks
├── pages/      # Route-level page components
├── store/      # Zustand state
├── types/      # Shared TypeScript types
└── utils/      # Shared utilities
```

## 2. Core Coding Rules

- Reusable logic belongs in `src/hooks/`
- API calls belong in `src/api/`
- Shared types belong in `src/types/`
- Never hardcode secrets, tokens, passwords, or connection strings
- Keep `.env` and `.env.*.local` out of version control
- Use `src/utils/logger.ts` for structured JSON logging; do not leave `console.log` in shipped code
- Avoid complex business logic directly inside JSX
- Never allow Chinese mojibake in source files
- Chinese UI copy must render correctly in UTF-8 or use Unicode escape literals

### Karpathy Guidelines (behavioral)

From Andrej Karpathy's observations on LLM coding pitfalls:

1. **Think Before Coding** — State assumptions explicitly. If unclear, ask. If multiple interpretations exist, present them — don't pick silently.
2. **Simplicity First** — Minimum code that solves the problem. No speculative features, no abstractions for single-use code, no error handling for impossible scenarios.
3. **Surgical Changes** — Touch only what you must. Don't "improve" adjacent code. Match existing style. Every changed line should trace to the user's request.
4. **Goal-Driven Execution** — Transform tasks into verifiable goals before coding. Define success criteria upfront.

### TDD & Verification

- **TDD**: Before writing implementation, write a failing test and watch it fail. Then write minimal code to pass. Refactor only after green.
- **Verification**: Never claim work is complete without running the relevant verification command (tests, build, etc.) and seeing the fresh output. Evidence before claims. Use `npm run build` and `npm test` as verification gates.
- **Debugging**: Fix root cause, not symptoms. If 3+ fix attempts fail, question the architecture.

## 3. Naming

| Type | Convention | Example |
|------|------|------|
| Page components | PascalCase | `RaceDetail.tsx` |
| Hooks | camelCase | `useSeasonData.ts` |
| Utility functions | camelCase | `formatDate.ts` |
| Types / interfaces | PascalCase | `Driver`, `Race` |
| Constants | UPPER_SNAKE_CASE | `API_BASE_URL` |

## 4. Pre-Commit Checks

- [ ] Run `npx tsc --noEmit`
- [ ] Run the relevant test or build command
- [ ] Verify Chinese UI copy renders correctly
- [ ] Confirm hooks, API files, and pages keep clean responsibilities
- [ ] Confirm no secrets or debug leftovers were introduced

## 5. Git Workflow

### Basic Rules
- Review `git status` before commit
- Review `git diff` before commit
- Prefer feature branches over direct `main` edits

### Recommended Flow
```bash
git status
git branch --show-current

git checkout -b feature/ai-assisted-work

git status
git diff
git add <specific-file>
git commit -m "feat: describe the change"
git push -u origin feature/ai-assisted-work
```

### Push Checklist
- [ ] `git status`
- [ ] `git diff`
- [ ] `git push --dry-run`
- [ ] Confirm `.env` and sensitive files are not tracked
- [ ] Confirm no mojibake text, temp scripts, or build output will be pushed

## 6. Project Skills

Use `.trae/skills/` as the project-specific skill source. Do not treat skill files inside `node_modules` as repo rules.

| Skill | Path | Purpose |
|------|------|------|
| `frontend-quality-review` | `.trae/skills/frontend-quality-review/SKILL.md` | Review route pages, dashboard layouts, charts, and visual styling |
| `browser-qa-check` | `.trae/skills/browser-qa-check/SKILL.md` | Browser QA for UI, routing, data-loading, and chart changes |
| `refactor-safety-check` | `.trae/skills/refactor-safety-check/SKILL.md` | Safe refactors, large-file splits, API contract changes, and `any` removal |
| `github-security-check` | `.trae/skills/github-security-check/SKILL.md` | Scan for secrets and unsafe files before pushing |
| `version-manager` | `.trae/skills/version-manager/SKILL.md` | Handle version bumps and tagging before release work |
| `f1-scoring-rules` | `.trae/skills/f1-scoring-rules/SKILL.md` | F1 historical scoring rules reference for championship calculations |

**Methodology reference**: `.claude/skill-*.md` files provide additional design and engineering methodology (data modeling, contract-first design, workflow orchestration, reliability engineering). See `docs/engineering-specification.md` for the integrated project-level specification.

### Order
- For UI/chart changes, run `frontend-quality-review`, then `browser-qa-check`
- For RaceDetail, API, hooks, or utility refactors, run `refactor-safety-check` before edits and targeted tests after edits
- For new API endpoints: follow contract-first flow in `docs/engineering-specification.md` §1.5
- For multi-step data pipelines: follow workflow design flow in `docs/engineering-specification.md` §2.3-2.5
- Run `version-manager` before version bumps or tags
- Run `github-security-check` before pushing
- If versioning and pushing both apply, run `version-manager`, then `github-security-check`, then commit/push steps
