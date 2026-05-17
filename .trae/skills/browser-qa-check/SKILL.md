# browser-qa-check

Use this skill before finishing UI, routing, data-loading, or chart changes.

## Minimum Flow

1. Run the relevant unit tests.
2. Run `npm run build` when the change can affect production behavior.
3. Start the Vite app if browser verification is needed.
4. Check the routes listed in `docs/browser-qa-checklist.md`.
5. Inspect console and failed network requests.
6. Capture screenshots for desktop and mobile when layout changed.

## Required Routes

- `/`
- `/races`
- `/races/:round`
- `/drivers/:driverId`
- `/constructors/:constructorId`
- `/circuits/:circuitId`

## Report Format

Use the report template in `docs/browser-qa-checklist.md`.

If a finding blocks release, stop and fix or ask before continuing.
