# Hosted development setup — September 4, 2026

**The development schema, baseline Auth configuration, an active owner/Admin account, and ten synthetic athletes for season 2026 are configured. Successful owner login and authenticated app checks remain unverified.** This is a public status summary. The detailed connection/account setup receipt is retained privately by the project owner.

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
- Email/password is enabled; public signup, anonymous sign-ins, and manual identity linking are disabled; email confirmations are enabled; the password minimum is 12 characters. Development Site URL and exact callback/reset redirects were configured.
- An explicitly selected, manually created Auth user was bootstrapped as active and Admin-only. The database contains one Auth user and no account-to-athlete links.

## Synthetic import

The owner-approved [synthetic fixture](../fixtures/synthetic-roster.csv) was staged and approved for season 2026 using the normal public import RPCs in owner SQL Editor, with transaction-local authenticated role and the verified owner subject. This was administrative setup, not a real Auth JWT session or browser import test; no application authentication bypass was created.

- Preview: **10 create, 0 update, 0 unchanged, 0 reject**.
- Result: exactly ten identities `SYN-001`–`SYN-010`, ten season rows, and only `example.com` roster emails.
- `SYN-001` jersey is `0`; `SYN-010` jersey is NULL.
- Audit counts: one owner bootstrap, one preview, ten roster creates, and one completed import.
- A read-only repeat plan returned **0 create, 0 update, 10 unchanged, 0 reject**. No second import was applied.
- Anonymous athlete/season reads remained denied after data existed.

## Recovery and remaining verification

Auth recorded two accepted recovery sends and one throttled retry; the retry sent no new email. An expired-link error was observed. Inbox delivery, successful password replacement, login/logout, expiry refresh, and replay handling remain unverified. Detailed account-specific recovery records are retained privately.

Recovery requests now buffer cookie writes until provider success; three installed-SDK tests with mocked responses passed. Failed sends preserve earlier verifier state, but cannot restore an expired or consumed link. These tests do not establish live recovery success.

No custom SMTP, custom recovery-template installation, player invitations, Vercel deployment, domain connection, DNS change, or production smoke test was completed at this checkpoint. The default recovery flow requires the same browser and hostname; see [SETUP](SETUP.md) for configuration and email-sender requirements.

Separate real authenticated permission and browser checks remain outstanding. See [VERIFICATION](VERIFICATION.md) for the passed checks and limitations, [TESTING](TESTING.md) for repeatable tests, and [DATA_MODEL](DATA_MODEL.md) for the authorization design.
