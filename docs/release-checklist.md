# Release Checklist

## Automated gates

- `npm ci`
- `npm run quality:check`
- GitHub CodeQL and Dependabot checks are green
- Runtime and development dependencies have no high or critical findings

## Configuration and data

- Production `VITE_SUPABASE_URL` and anonymous key point to the intended project
- Service-role keys exist only in protected server/CI secrets
- Latest `scripts/sql/` security hardening migration has been applied
- Supabase Auth redirect URLs include the production `/login` callback
- Anonymous users cannot insert, update, or delete application data
- Authenticated error reports contain no query string, URL fragment, token, or password

## Browser QA

- Complete `docs/browser-qa-checklist.md`
- Check `/login`, password reset, `/privacy`, and an unknown route
- Verify desktop 1440×900, tablet 768×1024, and mobile 375×812
- Review console errors and failed first-party document/script/style/font requests
- Confirm loading, empty, upstream-error, and offline shell states

## Operations

- Confirm production security headers and cache rules
- Confirm rollback target and previous deploy are available
- Review monitoring/error-log volume after release
- Record accepted dependency advisories and their mitigations
- Bump SemVer and use a `vX.Y.Z` tag for a release
