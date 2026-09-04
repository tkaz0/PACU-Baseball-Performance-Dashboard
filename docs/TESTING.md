# Verification and repeatable tests

## Checks that require no Supabase credentials

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

`pnpm test` executes the exact tracked migrations in an ephemeral PGlite PostgreSQL engine, then exercises grants, RLS, constraints, transactional import routines, and audit writes. Tests define the minimal external `auth.users`/`auth.uid()` contract and switch to distinct `anon`/`authenticated` database roles and separate UUID subjects. Tests never run as the owner for permission assertions; owner privileges are used only to set up fixtures and injected failure conditions.

Covered cases include anonymous reads/RPCs; Player A versus Player B direct database reads and joins; self-role/link/status/official-field mutation denial; Coach read-only access; unlinked/unconfigured/disabled users; disabling an existing player/admin subject; Admin+Player; duplicate account links; duplicates/email conflicts; invalid values/direct JSON payloads; repeat uploads and approvals; blank updates; jersey `0`; season identity preservation; stale/expired/wrong-uploader approval; and rollback of rows/audit after a later-row failure.

`tests/recovery.test.ts` adds three cookie-buffering regression tests using the installed Supabase SSR/Auth SDK with mocked `/recover` responses. They verify that successful responses commit a matching PKCE verifier only after the response; a rate-limited retry preserves all previous verifier cookies, including a full pending-flow ring; and a first request returning 429 creates no verifier cookies. The tests make no network requests and send no emails.

The database tests exercise PostgreSQL semantics, and the recovery tests exercise the installed SDK's cookie behavior against mocks. They do **not** run Supabase's Auth server, token refresh, PostgREST, email delivery, or multiple database connections. Cookie preservation cannot restore expired or consumed links. Full concurrent-session and Auth/API integration remain separate checks.

## Anonymous browser tests

Start `pnpm dev` in a separate terminal. Then:

```sh
pnpm exec playwright install chromium
pnpm test:ui
```

If Chrome is already installed, skip browser download and use:

```sh
PLAYWRIGHT_CHANNEL=chrome pnpm test:ui
```

On Windows PowerShell, set `$env:PLAYWRIGHT_CHANNEL='chrome'` first, then run `pnpm test:ui`.

These tests verify anonymous protected-page redirects, no athlete API data, no public signup/demo affordance, password recovery navigation/invalid-link handling, labelled login fields and horizontal layout at 390px/1440px, and the template download. Without Supabase config the API returns 503 with a generic denial; with a working unauthenticated connection it returns 401. Disabled authenticated users receive 403.

No browser traces, screenshots, or videos of authenticated data are saved by default. Do not capture real credentials/rosters in test artifacts.

## Real local Supabase tests with separate identities

These are opt-in because they require actual accounts and deliberately update the local test database. They refuse non-local app/Supabase URLs. They do not provision Auth users or send email automatically.

1. Follow [SETUP.md](SETUP.md) to start local Supabase and apply migrations.
2. Manually create four different local Auth users with unique passwords: Admin, Coach, Player A, Player B. Configure their trusted roles. Import the fixture into season `2026`, link A to `SYN-001` and B to `SYN-002`, and leave Coach unlinked. Player B must be a dedicated active test account with **only** Player role; the disable test restores precisely that state.
3. Create ignored `.env.test.local` in the project root. Enter values privately in your editor; never commit them. The app's `.env.local` must point at this same local Supabase project.

```dotenv
RUN_LOCAL_SUPABASE_TESTS=true
TEST_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=REPLACE_WITH_LOCAL_PUBLISHABLE_KEY
TEST_ADMIN_EMAIL=REPLACE_PRIVATELY
TEST_ADMIN_PASSWORD=REPLACE_PRIVATELY
TEST_COACH_EMAIL=REPLACE_PRIVATELY
TEST_COACH_PASSWORD=REPLACE_PRIVATELY
TEST_PLAYER_A_EMAIL=REPLACE_PRIVATELY
TEST_PLAYER_A_PASSWORD=REPLACE_PRIVATELY
TEST_PLAYER_A_ATHLETE_ID=REPLACE_WITH_SYN_001_UUID
TEST_PLAYER_B_EMAIL=REPLACE_PRIVATELY
TEST_PLAYER_B_PASSWORD=REPLACE_PRIVATELY
TEST_PLAYER_B_ATHLETE_ID=REPLACE_WITH_SYN_002_UUID
```

`TEST_APP_URL` defaults to `http://127.0.0.1:3000` if omitted. `PLAYWRIGHT_CHANNEL` is optional and selects an installed browser. These are test-only variables, not app/Vercel requirements. Only `RUN_LOCAL_SUPABASE_TESTS=true` enables the authenticated suite.

4. Run `pnpm test:ui`. Four additional tests exercise:
   - Real Player A login, own profile, denial of B through the UI/app API/direct Supabase API, blocked self-role insertion, and blocked admin page.
   - A real Player B session, admin disable via RPC, immediate API/UI/database denial using the existing session, then restoration in `finally`.
   - Coach roster/profile access and denied import page.
   - Admin upload, preview, approval of synthetic records and logout.

The admin test writes an import/audit record. The disabled-user test changes only the local dedicated Player B's trusted application state. Neither uses a privileged key. Run against a disposable local development project, not hosted data. A successful local run still does not certify your later deployment's environment/redirect/SMTP settings.

## Owner-run recovery and concurrency checks

After authorizing local email capture (or a test email to an owner-controlled inbox), request a reset. Local Supabase captures email in Mailpit; obtain its URL from `supabase status` (normally `http://127.0.0.1:54324`). Verify the confirmation button, new password, logout/sign-in, expired token rejection and one-time reuse failure. Test opening the supplied token-hash link on a different browser/device. Do not paste recovery links into chat or logs.

For actual concurrent sessions, use separate admin accounts/connections against a disposable local database: stage a draft, change the same roster before approval, and confirm stale rejection; approve a draft twice concurrently and confirm one audit application; disable an administrator while staging/approval waits and confirm access is checked after locks. The embedded suite covers state transitions and transactional rollback, but cannot reproduce multi-connection timing.

Re-run the separate-identity UI/API tests after deployment with owner authorization and dedicated test data. A role switcher or hidden navigation item is not a permission test.

## Browser-local importer tests

`tests/import-engine.test.ts`, `tests/import-files.test.ts`, and `tests/local-workspace.test.ts` exercise pure previews, bounded CSV/XLSX parsing, provenance/deduplication, and backup integrity. They use generated fictional fixtures only. `tests/browser/preview.spec.ts` and `tests/browser/imports.spec.ts` cover the no-sign-in workspace, imported profiles, validation, reload persistence, and transfer. Local browser tests create isolated profiles and never use the owner's saved browser data.

For a second local checkout, start it on an unused port and set `TEST_APP_URL=http://127.0.0.1:3101 PLAYWRIGHT_CHANNEL=chrome pnpm test:ui`. The test configuration rejects remote URLs. Production HTTP smoke checks are separate and read-only.
