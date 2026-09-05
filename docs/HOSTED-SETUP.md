# Hosted setup — updated September 5, 2026

**The no-sign-in dashboard at https://pacubaseballperformance.com supports a fictional starter roster, athlete profiles, and reviewed browser-local roster/measurement imports. The owner-approved custom domain, DNS records, HTTPS certificates, and Auth URL settings are configured.** The separate development schema, baseline Auth configuration, owner/Admin account, and ten synthetic database athletes are configured. Successful owner login and authenticated app checks remain unverified. This is a public status summary. The detailed deployment and connection receipt is retained by the project owner.

## September 5 account setup

The owner resumed individual account setup and approved Resend plus the two server credentials. The verified sender is `accounts@auth.pacubaseballperformance.com`; its scoped Resend sending key is stored in Supabase SMTP. The sending domain and its DKIM, SPF and MX records are verified. Both invitation and recovery templates use the custom-domain confirmation page. Owner recovery email delivery is confirmed. No teammate invitations have been sent.

The invitation migration `202609050003_invited_account_provisioning.sql` was applied in an owner-authorized SQL Editor transaction. The new RPC is present, anonymous execution remains denied, and there is still one configured account. This did not import the browser's real roster or measurements.

`SUPABASE_AUTH_ADMIN_SECRET` is stored as a Production-only Vercel secret. `PACU_INVITATIONS_ENABLED` remains unset, so the app cannot send invitations yet. Enable it only after the remaining account setup checks in [INVITATIONS](INVITATIONS.md).

The owner requested the simplest supported password policy, with no added year or suffix. Supabase's supported minimum is six characters, with no character-class requirement. The app accepts 6–128 characters. Password replacement and a fresh owner login still require live verification.

A real emailed recovery link exposed an application bug: Supabase's `pkce_` token prefix was rejected by a hex-only format check. The confirmation GET and POST now share a bounded validator accepting that prefix and preserve the complete token for Supabase verification. The GET still only renders confirmation; it does not consume the token. Synthetic regression tests cover prefixed links and malformed input. See [Supabase's verification implementation](https://github.com/supabase/auth/blob/master/internal/api/verify.go).

The sections below preserve earlier deployment checks. They are historical where superseded by this account-setup receipt.

## Browser workspace and custom domain

The deployed workspace is available at [the custom domain](https://pacubaseballperformance.com) and [the original Vercel alias](https://pacu-baseball-performance-dashboard.vercel.app). Imports are reviewed and saved in this browser's IndexedDB. They do not upload files, write Supabase data, create an account, or grant access to protected routes. The owner expanded scope from the initial fictional preview to this local Import Center while password setup remains paused; see [IMPORTS](IMPORTS.md) and [PREVIEW](PREVIEW.md).

The apex domain and `www` have been added to Vercel, and the two owner-approved DNS-only CNAME records have been saved at Cloudflare. Both point to `8cf2defd6102f1d0.vercel-dns-017.com`. Vercel shows valid configuration for both domains. Both authoritative nameservers and public DNS resolvers returned the new records. HTTPS checks with ordinary certificate and hostname verification passed for both domains: the apex redirects to `/preview`, and `www` returns a permanent 308 redirect to the apex while preserving the path and query. Initial checks used a per-process authoritative-IP override because the local network still cached the earlier missing DNS answer; that check does not establish propagation through every resolver.

Vercel `APP_URL` has been saved as `https://pacubaseballperformance.com`, preserving its Production and Preview environment selection. Supabase Site URL is saved to that same apex, and the three exact `/auth/callback`, `/auth/confirm`, and `/reset-password` redirects were added successfully while existing entries were retained. Vercel activates environment changes on the next deployment; verify the deployed `/auth/callback` redirects to the custom domain before resuming password setup. Domain verification does not establish successful live password recovery.

Browser data does not move with the domain: IndexedDB at the Vercel alias is separate from `https://pacubaseballperformance.com`. Keep the alias available, export a JSON backup there from the browser profile holding the data, then restore it through Import Center on the custom domain. Restore replaces the destination workspace after confirmation; the two origins do not synchronize. See [the transfer steps](SETUP.md#move-saved-browser-data-to-the-custom-domain).

## Applied schema

The two tracked migrations were applied successfully through one owner-authorized SQL Editor transaction:

| Migration | SHA-256 |
| --- | --- |
| [Identity and access](../supabase/migrations/202609040001_identity_and_access.sql) | `1ba1f6e0d2571d8c87b1c32862cda8a41e8dea7eb2d7dbfa59f602d0fdd061e2` |
| [Roster imports](../supabase/migrations/202609040002_roster_imports.sql) | `7a7b7a0eedded03030049194c61a387e8b1e64db93fcde1e01d687951022ee0c` |

**SQL Editor execution does not record Supabase CLI migration history.** No CLI history reconciliation was performed. Before a later CLI push, inspect and reconcile the intended database's history with its applied schema; do not blindly rerun the create-table migrations.

## Verified development state

- All seven application tables have RLS enabled, deny anonymous access, allow authenticated SELECT, and deny direct authenticated writes. Seven SELECT-only policies match the migrations.
- All eleven functions have the expected owner, security mode, empty `search_path`, and execution grants. Anonymous EXECUTE is denied; authenticated EXECUTE is also denied on the private planning/validation helpers.
- Anonymous REST requests to all seven tables and all three administrative RPCs returned HTTP 401 / `42501`. Requests for the private API schema returned HTTP 406 / `PGRST106`.
- Historical September 4 verification: email/password was enabled; public signup, anonymous sign-ins, and manual identity linking were disabled; email confirmations were enabled; the password minimum was 12 characters. Development Site URL and exact callback/reset redirects were configured. The owner later requested simpler requirements; see the current account-setup receipt above.
- An explicitly selected, manually created Auth user was bootstrapped as active and Admin-only. The database contains one Auth user and no account-to-athlete links.

## Synthetic import

The owner-approved [synthetic fixture](../fixtures/synthetic-roster.csv) was staged and approved for season 2026 using the normal public import RPCs in owner SQL Editor, with transaction-local authenticated role and the verified owner subject. This was administrative setup, not a real Auth JWT session or browser import test; no application authentication bypass was created.

- Preview: **10 create, 0 update, 0 unchanged, 0 reject**.
- Result: exactly ten identities `SYN-001`–`SYN-010`, ten season rows, and only `example.com` roster emails.
- `SYN-001` jersey is `0`; `SYN-010` jersey is NULL.
- Audit counts: one owner bootstrap, one preview, ten roster creates, and one completed import.
- A read-only repeat plan returned **0 create, 0 update, 10 unchanged, 0 reject**. No second import was applied.
- Anonymous athlete/season reads remained denied after data existed.

## September 4 recovery checks (historical)

Auth recorded two accepted recovery sends and one throttled retry; the retry sent no new email. An expired-link error was observed. Inbox delivery, successful password replacement, login/logout, expiry refresh, and replay handling remain unverified. Detailed account-specific recovery records are retained privately.

Recovery requests now buffer cookie writes until provider success; three installed-SDK tests with mocked responses passed. Failed sends preserve earlier verifier state, but cannot restore an expired or consumed link. These tests do not establish live recovery success.

The original owner-approved Vercel deployment used Node 24.x and pnpm 11.19.0. At that deployment, the Vercel alias, `APP_URL`, Supabase Site URL, and three exact HTTPS callback/confirm/reset redirects agreed. Ten anonymous deployed HTTP checks passed, including protected-page redirects, athlete API denial, the CSV template, and no-store/security headers. A subsequent owner recovery request returned HTTP 200 with a mail-send event and the then-configured callback address. These earlier checks do not verify the custom-domain transition. Password replacement and successful owner login remain unverified, and password setup is paused.

At that earlier checkpoint, no custom SMTP, custom recovery-template installation, or player invitations had been completed. The September 5 receipt above supersedes the SMTP/template and email-delivery status. No new email or password test is part of the domain verification. The default recovery flow requires the same browser and hostname; after the custom-domain configuration is verified, start and finish future private recovery flows there. Registering both origins does not transfer a PKCE verifier between them. See [SETUP](SETUP.md) for configuration and email-sender requirements.

Separate real authenticated permission and browser checks remain outstanding. See [VERIFICATION](VERIFICATION.md) for the passed checks and limitations, [TESTING](TESTING.md) for repeatable tests, and [DATA_MODEL](DATA_MODEL.md) for the authorization design.
