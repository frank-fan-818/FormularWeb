# FastF1 reliability implementation plan

**Goal:** Diagnose upstream fetch failures, recover transient requests, preserve complete snapshots and report persistent session gaps without blocking healthy sessions.

**Architecture:** Instrument FastF1's GET boundary with bounded retries and structured diagnostics. Export into staging, validate before replacement, publish complete sessions independently, then fail the overall run on unresolved gaps. Persist health by season/scope in private Storage and expose a sanitized Actions summary.

**Tech stack:** Python/FastF1 3.8.3, Node 24, Supabase private Storage, GitHub Actions.

The user approved implementation after discussing this design. Preserve the existing uncommitted private-storage migration and work in the shared checkout; do not commit unrelated changes.

1. Write failing Python tests for timeout/429/503 recovery, Retry-After, non-retryable 403, incomplete-vs-fetch-error classification and preservation of existing files. Run `python -m unittest scripts.fastf1_reliability_test`.
2. Implement `scripts/fastf1_reliability.py`; integrate structured diagnostics and staging in the single-session and season exporters. Repeat targeted tests.
3. Write failing Node tests for complete-only publication, failed-session isolation and persistent health counts. Implement publication/health helpers and private Storage restoration. Run `node --test scripts/fastf1-publication.test.mjs`.
4. Order the workflow as restore, export, independent publication, health summary, strict final verification. Upload sanitized diagnostics even on failure. Use the pinned artifact action already used by this repository; retain read-only GitHub permissions.
5. Run automation tests, workflow validation, `npm test` and `npm run build`. Validate local exports with the pinned FastF1 version without touching production credentials or publishing data.
6. Document CI diagnosis and an optional trusted runner override. A hosted-runner access problem is resolved only after a real CI run demonstrates success; local tests cannot prove runner reachability.

Acceptance: missing payloads cannot overwrite complete ones; transient requests have bounded retries; 403 and incomplete successful responses are never called 'not yet published'; complete sessions publish despite another session's failure; diagnostics identify endpoints/status/attempts without credentials; unresolved gaps remain a failing run with persistent health history.

Version classification: `fix`, patch version 0.19.1. No tag, commit or production publication requested in this implementation step.
