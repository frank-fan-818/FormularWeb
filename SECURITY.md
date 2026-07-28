# Security Policy

## Supported version

Only the latest release on `main` receives security fixes.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability or exposed
credential. Use GitHub's private vulnerability reporting for this repository.
Include the affected route or file, reproduction steps, impact, and any known
mitigation. Please avoid accessing or modifying data that does not belong to
you.

## Repository security baseline

- Browser code receives only the Supabase anonymous key.
- Administrative scripts require `SUPABASE_SERVICE_ROLE_KEY`.
- Public application data is read-only to browser roles; authenticated users
  may insert sanitized diagnostics into `error_logs`.
- Pull requests must pass secret scanning, production dependency audit,
  strict lint, type checking, coverage, build, performance, and CodeQL gates.
- Exposed credentials must be revoked and rotated; removing them from Git
  history is not sufficient.
