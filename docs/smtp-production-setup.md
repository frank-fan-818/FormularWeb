# Production authentication email setup

SMTP sends the site's signup-verification and password-recovery emails. It is
independent of the mailbox used to receive GitHub Actions failure notifications.

The maintainer confirmed custom SMTP is disabled on 2026-10-20. Supabase's default
service currently limits delivery to authorized team addresses and two emails
per hour; it is intended for testing, not production registration. See
[Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

## Configure

1. Use an existing SMTP-capable transactional email service, or prepare one and
   verify the sending address/domain as required by that provider.
2. Open the production project's
   [SMTP settings](https://supabase.com/dashboard/project/zmihswdvixurhjjsazrl/auth/smtp).
3. Enable custom SMTP and copy the following values from the provider:

| Supabase field | Value to supply |
| --- | --- |
| Sender email | Provider-verified sending address |
| Sender name | FormularOneWeb |
| Host | Provider's SMTP hostname |
| Port | Provider's documented SMTP port and connection requirements |
| Username | Provider's SMTP username |
| Password | Provider's SMTP password/API credential, entered directly in Supabase |

4. Save, then review Authentication rate limits against the provider's configured
   quota. Keep email verification enabled.
5. Confirm the production site URL and allowed `/login` and `/reset-password`
   redirect destinations refer to `https://formular-web.vercel.app`.

Do not paste SMTP credentials into chat, code, issues or release evidence.
Domain registration, service purchases and accepting provider terms require the
maintainer's own choices; this guide does not provision a paid service.

## Acceptance

- Register with a new dedicated test address that can receive mail.
- Receive the verification mail, follow its link and sign in.
- Refresh and confirm the signed-in session remains valid.
- Sign out, request password recovery, receive the mail, set a different
  password and sign in again.
- If a step fails, record only its time and safe error message. Never retain
  passwords, tokens or recovery links in the acceptance report.

Mark the signup gate passed only after this real delivery and login test. The
existing-account recovery test passed before SMTP setup; it does not substitute
for new public-user signup delivery.
