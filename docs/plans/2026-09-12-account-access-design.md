# Account entry and guest access

## Agreed behavior

- A first visit to a data route opens the standalone login page before mounting the data layout.
- A valid existing Supabase session opens the requested data page directly.
- Guests must explicitly choose guest browsing. That choice lasts for the current tab session, including refreshes.
- Guests can view calendars, classifications, standings and basic driver/team/circuit pages.
- Signed-in users additionally get lap/sector comparisons, telemetry, strategy analysis and predictions.
- Locked features explain the difference and retain the intended route, query and fragment through login/registration.
- Signing out clears guest consent and immediately removes member content. Privacy and account recovery routes remain public.

## Page design brief

- Audience: F1 readers and analysis users. Primary task: choose account login or guest access.
- Secondary tasks: registration, password recovery, privacy information.
- Density: low. Keep the existing standalone brand/form layout and design tokens, with Ferrari red for login.
- Make the guest/user difference readable beside the guest action. Mobile uses a single column with no dashboard navigation.
- Identity loading blocks data routes; failures offer retry and guest access. Missing configuration keeps guest access available.
- Review at 1440×900, 768×1024 and 375×812; capture login and guest lock states.

## Implementation

1. Share one auth subscription through AuthProvider and useAuthState; expose it through useAuthSession.
2. Guard data routes with SiteAccess and member sections with MemberAccess.
3. Disable member analytics requests for guests, including FastF1 classification fallback and hover prefetch.
4. Update navigation, login benefits and privacy copy.
5. Verify policy tests, production build, lint and browser login/guest/member flows. Existing data QA explicitly uses mocked member sessions.

## Data boundary

This change enforces access within the application and prevents its guest views from loading member analysis data. It is not a private-data security boundary: FastF1 static assets and existing public Supabase read endpoints remain publicly addressable. Protecting those sources requires authenticated server delivery/private storage and database policies, including migration of public static fallbacks. No remote policy or deployment is changed here.

Authentication browser tests mock Supabase responses; they do not verify real email delivery or production identity configuration. No real accounts or messages are created.

Release classification: `feat` (minor) when shipping; no commit, tag or deployment requested in this change.
