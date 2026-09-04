# Verification — September 4, 2026

## Browser workspace and importer release

The owner expanded scope to no-sign-in dashboard/profile access and data importers while deferring password setup. The new `/preview` workspace serves a fictional starter roster and stores reviewed imports only in that browser's IndexedDB. Protected Supabase access is unchanged.

Current checks: `pnpm check` passed lint, strict TypeScript, **150 tests across 8 files**, and production build. The production dependency audit reported no known vulnerabilities; the registry audit does not independently audit the vendor CDN package. SheetJS CE 0.20.3 is pinned to its official distribution with lockfile integrity.

The final production-mode local browser run passed **18 tests with 4 authenticated tests skipped**. These checks cover no-sign-in navigation, profiles/jersey0, unavailable local IDs, roster and measurement imports, duplicate/repeat handling, explicit name review, XLSX sheet/header selection, backup export/restore, concurrent-tab stale previews, separate-browser isolation, no file-upload network requests, and rollback after an injected real IndexedDB transaction abort. Four real Supabase session tests remain opt-in and skipped. Public browser tests use fresh fictional data in disposable profiles.

Visual checks found and fixed a mobile page-width issue caused by an absolutely positioned screen-reader table label; the scroll container now provides its containing block. The development server initially blocked HMR from 127.0.0.1 under Next 16.3.4's dev-origin rule. The exact loopback origin is now allowed; all four public-navigation browser tests pass in development mode. Production mode was unaffected.

Exact deployed release/status and final browser totals are recorded in the owner's live-status receipt. No real roster files, vendor exports, credentials, or browser storage were committed. PDF parsing, verified vendor schema presets, direct Sheets sync, and shared cloud measurement persistence remain pending.

## Original protected Phase 1 checks

| Check | Result | What it establishes |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | Passed | Lockfile installs reproducibly in the provided environment |
| `pnpm lint` | Passed; zero warnings/errors | ESLint checks source and tests |
| `pnpm typecheck` | Passed | Strict TypeScript compilation |
| `pnpm test` | **28 passed** across 3 files | 7 CSV/template/format tests, 18 PostgreSQL authorization/import tests, and 3 installed-SDK recovery cookie tests with mocked provider responses |
| `pnpm build` | Passed | Next.js production build of all requested routes; no live Supabase credentials needed to compile |
| `PLAYWRIGHT_CHANNEL=chrome pnpm test:ui` | **5 passed, 4 skipped** on the configured-app rerun | Anonymous browser/UI/API denial, reset navigation, template and responsive login; no authenticated session or email send |
| `pnpm audit --prod` | Passed; no known vulnerabilities reported | Registry audit of production dependency tree at verification time |
| Desktop/mobile visual inspection | Passed for login at 1440px and 390px | Red/black/white layout, readable controls, setup state; a spacing issue was corrected |

The `pnpm check` script completed lint → typecheck → unit/database tests → production build successfully. No unresolved lint, type, unit/database, or build failures remained. An initial build attempt was blocked by this environment's sandbox preventing Turbopack from binding a local worker port; it passed after local build permissions were granted. An initial ESLint style warning was fixed before the final run.

After adding the recovery cookie-buffering regression, `pnpm check` passed again: lint, strict TypeScript, all 28 tests across 3 files, and the production build. The three recovery tests use the installed SDK with mocked provider responses; they do not establish live recovery success. The browser suite also passed 5 tests and skipped 4 against the configured hosted-Supabase app, without an authenticated session or sending email. The four real authenticated checks remain skipped.

Installed Next.js source/documentation confirmed that development logging can include full incoming URLs and Server Function arguments. Both logging options were disabled to avoid recording recovery codes and form credentials. After this configuration change, `pnpm check` passed again and the reset form returned HTTP 200 and opened successfully in the Codex browser. No existing sensitive logs were inspected; production logging remains a separate deployment check.

## Permission evidence

Tests execute the real migration SQL in **PGlite**, an embedded PostgreSQL engine, with distinct Admin, second Admin+Player, Coach, Player A, Player B, unlinked, disabled, and unconfigured test subjects. The minimal external Supabase Auth table/UID function is supplied only inside the test database. Permission queries execute under `anon` or `authenticated`, not as the database owner.

Passed: anonymous table/RPC denial; A cannot retrieve B, including season joins; B independently sees only B; players cannot grant roles or edit links, status, official fields, or administrative RPCs; Coach reads without importing; disabled users/admins lose access under the same retained subject; Admin+Player works; self-modification/duplicate account links are blocked.

Passed: exactly 10 fictional identities; jersey `0` and NULL preservation; duplicate codes/email conflicts; invalid numbers/enums/names/URLs/direct payloads; identical re-import and repeated approval; blank-preserving updates; no deletion of omitted athletes; permanent identity/account link preservation after contact/name/jersey changes; new season without identity duplication; stale/expired/wrong-uploader rejection; full row/audit rollback after an injected later-row database failure.

An independent read-only review identified and prompted fixes for authorization after lock waits, control-character/URL validation, source-row numbering after blank lines, and CSV-to-JSON size expansion. A separate app review found no concrete authentication/authorization bypass in its inspected scope. These reviews supplement the tests; they are not a security certification.

## Hosted development checkpoints — September 4, 2026

With explicit owner approval, the two migrations were applied to the intended development database through one SQL Editor transaction. Hosted checks confirmed RLS/grants/policies, function security settings, denied anonymous reads/admin RPCs, and a non-exposed private schema. Baseline Auth settings and development redirects were saved. The local login page returned HTTP 200. See [HOSTED-SETUP](HOSTED-SETUP.md) for the public status summary and migration-history caveat. The detailed connection/account setup receipt is retained privately by the project owner.

The owner manually created an Auth user. Explicit user-ID bootstrap succeeded and was verified as active, email-confirmed, Admin-only, with one bootstrap audit event. The owner-approved fixture import created exactly ten synthetic athletes and ten season-2026 rows through the normal public stage/approve RPCs in owner SQL Editor, with the authenticated database role and verified owner subject set transaction-locally. This was administrative setup, not a real Auth JWT session or browser import verification; no app authentication bypass was created.

Hosted SQL checks confirmed the exact synthetic codes, example.com emails, jersey `0`/NULL preservation, one Auth user, zero account links, and expected audit counts. A read-only repeat plan reported ten unchanged rows and no changes/rejects. Anonymous REST reads of athletes/seasons still returned 401 / `42501` after data existed. Account/import identifiers and detailed operational records are retained privately.

Successful authenticated app login remains unverified. Auth recorded two accepted recovery sends and a throttled retry that sent no new email; an expired-link error was observed. Inbox delivery, successful password replacement, and authenticated integration are not established. Detailed account-specific recovery records are retained privately. The custom recovery template remains uninstalled; custom SMTP has not been configured.

## Not run / remaining integration verification

- **Four real authenticated UI/API tests were skipped.** At that test run, no local Supabase Auth/PostgREST stack or owner-provisioned test credentials were available. Docker, `psql`, and the Supabase CLI were not installed in the initial shell environment. The later hosted schema/Auth setup does not replace those tests; authenticated test identities remain pending. The opt-in tests are implemented in `tests/browser/local-supabase.spec.ts` and documented in `TESTING.md`.
- Therefore Player A/B isolation and disabling were verified directly in PostgreSQL, but **not yet end-to-end through real Supabase JWTs and authenticated browser sessions**. Initial anonymous checks against the unconfigured app returned a generic API denial with HTTP 503. The later rerun against the configured hosted-Supabase app returned HTTP 401. Both returned no athlete data and redirected protected pages to login.
- Successful login/logout, Supabase cookie refresh across token expiry, complete password recovery/replay, and custom SMTP remain unverified. Recovery was attempted: two accepted sends, an `otp_expired` error, and one email-rate-limited retry are recorded above and in the hosted receipt. The throttled retry did not send a fresh email.
- Multi-connection concurrency timing was not run in embedded PostgreSQL. Lock ordering and transactional behavior were reviewed, and stale-state/rollback cases were executed. `TESTING.md` describes real local concurrency checks.
- Authenticated dashboard/profile/import layouts could not be visually inspected with real sessions. Source compiles and browser integration tests are provided; only the login surface received visual inspection.
- Hosted migrations, baseline Auth settings, owner/Admin provisioning, and the explicitly approved ten-athlete synthetic import are complete as recorded above. Real authenticated app checks remain pending. The subsequent owner-approved Vercel deployment completed, with ten anonymous production HTTP checks passing. No custom-domain connection or DNS change was made.

## Handoff boundary

The public browser workspace provides immediate dashboard/profile access and reviewed CSV/TSV/XLSX imports. Hosted schema/Auth setup, owner/Admin provisioning, and the approved synthetic database roster import are complete. Password setup is paused at the owner's request; successful owner login and real authenticated integration verification remain outstanding. Browser imports do not publish or migrate real team data. See [PREVIEW](PREVIEW.md), [IMPORTS](IMPORTS.md), and the hosted receipt.
