# Release Checklist

## Automated gates

- `npm ci`
- `npm run quality:check`
- Semgrep OSS, workflow safety validation, and Dependabot checks are green
- Runtime and development dependencies have no high or critical findings

## Configuration and data

- Production `VITE_SUPABASE_URL` and anonymous key point to the intended project
- Service-role keys exist only in protected server/CI secrets
- Latest `scripts/sql/` security hardening migration has been applied
- Supabase Auth redirect URLs include the production `/login` callback
- If enabling Turnstile, deploy the public Site Key and updated forms before
  enabling Supabase CAPTCHA with the Secret Key; verify all three auth forms and
  rejection of missing/invalid tokens as described in `docs/turnstile-setup.md`
- Production email delivery uses a configured custom SMTP service; complete a
  real signup/verification/login and recovery flow with the dedicated test inbox
- Anonymous users cannot insert, update, or delete application data
- Run `supabase db query --linked --file scripts/sql/verify-release-access.sql`
  against the confirmed production project; member-only database rows and private
  Storage must also reject Supabase anonymous sign-in sessions
- Authenticated diagnostic rows persist only an allowlisted error category,
  SHA-256 fingerprint, length, and sanitized static labels; raw error messages
  and browser URL query/fragment data are never stored

## Browser QA

- Complete `docs/browser-qa-checklist.md`
- Check `/login`, password reset, `/privacy`, and an unknown route
- Verify desktop 1440×900, tablet 768×1024, and mobile 375×812
- Verify critical flows in desktop Firefox and mobile WebKit; complete a real iOS device check before claiming iOS support
- Check chart data tables with keyboard navigation and dark/light themes
- Run `npm run fonts:verify` after changing UI copy
- Review console errors and failed first-party document/script/style/font requests
- Confirm loading, empty, upstream-error, and offline shell states

## Operations

- Confirm production security headers and cache rules
- Follow `docs/production-runbook.md`; run `deployment:verify:live` against the intended release version
- Configure production-health repository variables and verify failure notifications reach the assigned owner
- Confirm rollback target and previous deploy are available
- Review monitoring/error-log volume after release
- Record accepted dependency advisories and their mitigations
- Bump SemVer and use a `vX.Y.Z` tag for a release
- Preparing `1.0.0` in source is allowed before rollout, but do not publish the
  stable tag/Release while any P0 acceptance item remains pending
