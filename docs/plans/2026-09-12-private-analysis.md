# Private analysis implementation plan

**Goal:** Deny anonymous direct access to analysis/prediction data while retaining public classifications.

**Architecture:** Supabase RLS protects analysis and prediction tables. A private Storage bucket holds FastF1 files; browser downloads carry the user's access token and are never persisted. Export jobs publish directly to that bucket, never to a public repository artifact.

**Tech stack:** React, Supabase Auth/Postgres/Storage, Vite, GitHub Actions.

1. Write failing request authorization tests, including cached-request access after signout.
2. Add a shared authenticated request helper; migrate predictions and FastF1 downloads to it.
3. Remove persistent prediction caching and clear legacy browser/IndexedDB/worker caches.
4. Add idempotent SQL policies and direct role/HTTP allow-deny verification.
5. Move local FastF1 exports out of public, add a validated private uploader, and update exporter/importer/workflow paths.
6. Block old public routes in build/dev/hosting, and add regression checks.
7. Upload/verify private files before activating database restrictions. Verify linked project identity without logging credentials.
8. Run unit, build, lint, browser and direct permission tests; report deployment state and any external blockers precisely.

Existing published copies cannot be made secret retroactively. No credential should be printed or put in browser code. Production activation must coordinate with the new client; the old anonymous client cannot read the protected endpoints.
