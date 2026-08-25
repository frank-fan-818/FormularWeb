# Authentication Center Design Brief

## Product Direction

- Audience: F1 data visitors who want a personal account or need to recover access.
- Primary task: Complete email sign-in or registration immediately after opening an auth route.
- Secondary tasks: Request a password reset, set a recovered password, return to public race data.
- Information density: Low.
- Desktop priority: A focused split-screen identity and form experience.
- Mobile priority: Put the form first and keep all controls reachable without horizontal scrolling.

## F1 Data Product Fit

- Domain signal users should notice first: Race-control access language and a restrained timing-line motif.
- Race-control or paddock-style interaction: An access-status rail and telemetry-inspired brand panel.
- Data that must be scannable in under 5 seconds: Current auth task, required fields, primary action, alternate route.
- Empty/loading/error states: Unconfigured identity service, session loading, invalid recovery link, request failure, and success confirmation.

## Interface Choices

- Layout model: Standalone auth shell outside the application sidebar and header; two columns on desktop and form-first single column on mobile.
- Typography scale: Existing display, body, and mono tokens.
- Primary action color: Ferrari red from `src/styles/design-tokens.css`.
- Status colors: Existing Ant Design semantic colors and project tokens.
- Motion or interaction detail: Short panel entry and subtle track-line movement; disabled for reduced motion.
- Accessibility notes: Visible labels, correct autocomplete values, status alerts, keyboard focus, minimum 44px mobile controls.

## Acceptance

- Viewports to check: 1440x900, 768x1024, 375x812.
- Browser QA routes: `/login`, `/register`, `/forgot-password`, `/reset-password`, and `/` regression check.
- Console/network expectations: No new console errors; Supabase calls may be disabled locally when browser configuration is absent.
- Screenshot path: `docs/browser-qa/2026-08-24-authentication-center/`.
