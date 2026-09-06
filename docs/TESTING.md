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

## Shared profile and coach preparation checks

The new tests use fictional data only. They verify implementation behavior; deployment, actual shared imports and recipient delivery remain separate checks. Team emails are explicitly paused.

- `tests/player-performance.test.ts` covers canonical metric/unit aliases, mathematical bounds, Fall and body-only Summer windows, source/unit isolation, latest/history ordering, tied and lower-direction percentiles, minimum five, explicit cohort membership, exact aggregate overrides and unambiguous same-report muscle derivation.
- `tests/player-performance-profile.test.ts` checks the rendered metric groups and honest missing/neutral/comparison labels using fictional inputs.
- `tests/performance-import.test.ts` covers all supported original RENPHO report readings, unchanged numbers through explicit unit aliases, unsupported-metric exclusions versus blocking recognized errors, provenance/date/duplicate/capacity checks, and the upload whitelist. The privacy regression injects extra image/report-text/nested-OCR properties into a backup measurement and proves none appears in serialized candidates.
- `tests/performance-server.test.ts` covers effective-player filtering before RPC, unlinked/other-player denial, rejecting mismatched returned identities, exact page-field validation, sequential fixed-size pagination, duplicate/history limits, constrained aggregate shapes, source metadata reconstruction, and fresh Admin mutation checks before RPC.
- `tests/performance-database.test.ts` executes the migrations in PGlite. It checks anonymous and private-catalog denial; staff versus separate linked Player table/RPC access; current account revocation; admin-only writes; summary ownership; immutable/conflicting/duplicate/invalid batch handling; full rollback; original-provenance retention; fixed eligible cohort; n<5 suppression; source/unit/period isolation; neutral and lower directions; and same-report muscle derivation, including mixed-unit ambiguity and other-protocol separation. SQL timestamp ties use browser millisecond precision. Fictional raw values with more than 15 significant digits and decimal mass pairs also pass through PostgreSQL JSON, the actual server adapter and profile model with caller `extra_float_digits=0`: n=1 remains a small cohort, n=5 gets its rank, the caller's setting is restored, and a different observed value still fails exact summary matching.
- `tests/coach-rollout.test.ts` and `tests/coach-rollout-actions.test.ts` cover preparation RLS, active Admin authorization outside preview, exact reviewed inputs, normalized-email upserts, list limits, idempotent preparation, audit behavior and no Auth/role/invitation side effects.

```sh
pnpm exec vitest run tests/player-performance.test.ts tests/player-performance-profile.test.ts tests/performance-import.test.ts tests/performance-server.test.ts tests/performance-database.test.ts tests/coach-rollout.test.ts tests/coach-rollout-actions.test.ts
```

The integrated `pnpm check` passed lint, TypeScript, **605 tests**, and the production build. The local production browser suite passed **33 runnable tests** with **4 separate-credential Supabase tests skipped**. The storage/import and serialization regressions passed within this verification. These checks do not establish hosted delivery or independent authenticated onboarding; the historical release receipts below remain separate.

Before declaring shared access ready, use separate authorized local Supabase Admin, Coach, Player A and Player B sessions: import fictional shared observations; verify Player A cannot retrieve B via UI, app API, direct table queries or the summary RPC; disable an existing session and verify denial; confirm Admin View as restricts data and rejects writes. Check that all shared-import controls are disabled during submission, approval resets on new input, and network payloads contain only reviewed numerical fields. Confirm a saved coach creates only a preparation row/audit and sends no email. PGlite and mocked provider tests do not run the full Supabase Auth/PostgREST/email stack or prove concurrent hosted behavior.

## Individual invitation checks

`tests/invitation-confirmation.test.ts` covers the actual confirmation page/actions using fictional tokens and mocked Auth. GET creates no Auth client and consumes no token; POST verifies only the matching `invite` or `recovery` type. Cases include template/route consistency, duplicate and malformed fields, expired/replayed/incomplete/provider-error responses, fixed password redirects, token-free failure pages, and the original recovery action. The focused confirmation plus existing recovery SDK tests passed **29 tests** during implementation.

`tests/invited-account-provisioning.test.ts` applies the tracked migrations in a separate PGlite instance. It checks unauthorized/inactive/revoked actors; one Coach or Player role; required/forbidden and unique athlete links; existing Auth users; preservation of active, disabled and role-free accounts; another administrator's retry; rollback when audit insertion fails; function security/search paths/grants; and the shared lock's order before authorization/absence checks. Its focused run with the existing database suite passed **42 tests**. PGlite uses one connection: lock-structure and sequential retry assertions are not a real concurrent-session test.

`tests/account-invitation.test.ts` tests input approval, bounded directory pagination and the invitation action against fictional provider mocks. It checks feature gating, live administrator checks before provider access/sending, existing-user refusal, player preflight, returned Auth identity verification, ordinary-session provisioning, and explicit handling of delivery/configuration uncertainty without automatic retries. These are application tests, not a hosted sender verification.

`tests/password-policy.test.ts` checks the 6–128 character policy with mocked Auth: 6, 7, 8 and 128 accepted, 5 and 129 rejected, matching confirmation required, and invitation setup retained after validation/provider errors. It supersedes the earlier 8-character test boundary after the owner requested Supabase's lowest supported minimum. Generated letter-only test strings require no year suffix or character mix. Rendered invitation and recovery forms use the same limits. No real passwords, provider requests or hosted policy changes are used in these tests.

```sh
pnpm exec vitest run tests/invitation-confirmation.test.ts tests/recovery.test.ts tests/invited-account-provisioning.test.ts tests/database.test.ts tests/account-invitation.test.ts tests/password-policy.test.ts
```

The complete release checks and production build must also pass after integration. The focused results above do not supersede the separate historical release receipts later in this document, and no hosted migration, custom SMTP delivery, team invitation or real password-onboarding completion is claimed by them.

Before enabling hosted app invitations, verify these in a deliberately prepared local Supabase/Mailpit environment, then repeat the required delivery/onboarding checks with an explicitly approved owner-controlled hosted recipient:

1. Public signup stays disabled; an anonymous, Coach, Player, inactive administrator, or administrator in preview cannot invoke app invitation sending or provisioning.
2. Missing secret/disabled `PACU_INVITATIONS_ENABLED` blocks the sending form and action. The server-only secret never appears in HTML, browser bundles, logs or network responses. Ordinary data calls use the actor's session and remain subject to RLS.
3. A reviewed invitation creates one Auth identity, one intended application role and the correct unique athlete link. The recipient chooses a password and signs in independently. Verify Player A cannot read B through the UI, app API or direct Supabase API.
4. Opening the email's landing page does not consume the token; the explicit confirmation does. Check a second browser, invalid/expired/replayed tokens, password validation, sign-out and a fresh password login.
5. Existing Auth accounts are not reinvited or overwritten. Inject directory, delivery and post-send provisioning failures and inspect partial outcomes before any manual retry. Verify another administrator cannot replace a just-provisioned account, and revocation while waiting on the shared lock prevents the database write.

Use only fictional local fixtures or the individually authorized hosted test account. Do not enable the feature for the team or send real invitations merely to run automated tests. See [INVITATIONS](INVITATIONS.md) for the staged environment configuration.

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

The anonymous `access.spec.ts` and `preview.spec.ts` tests verify redirects from every dashboard path, including `/preview`, no athlete API data, no public signup/demo/browser-workspace link, no IndexedDB opening before login, recovery navigation, labelled login fields and horizontal layout at 390px/1440px, and the template download. Without Supabase config the APIs return 503 with a generic denial; with a working unauthenticated connection they return 401. Disabled authenticated users receive 403.

The remaining browser-local import, OCR, charts, storage and layout specs use `tests/browser/local-admin.ts`. They require an ignored `.env.test.local`, `RUN_LOCAL_SUPABASE_TESTS=true`, local-only app/Supabase URLs, and the separately provisioned `TEST_ADMIN_EMAIL`/`TEST_ADMIN_PASSWORD` below. Each isolated browser signs in through the real form and verifies current Admin access. Without that opt-in these specs are explicitly skipped. They never inject fake roles, bypass production routes, use hosted credentials, or reuse the owner's browser data. Their auth fixture creates no accounts and sends no email. Earlier anonymous-import release receipts below are historical, not verification of the current authenticated workflow.

`tests/proxy-preview.test.ts`, `tests/preview-route-access.test.ts`, `tests/access-preview-server.test.ts`, `tests/local-workspace-access.test.ts` and `tests/admin-workspace-boundary.test.ts` exercise token refresh without a public exception, fresh Admin checks at every local page, denial for Coach/Player/inactive/invalid-preview sessions, exact user/path client authorization, current-session failure handling and preserving the current import view during successful periodic checks. Those component/provider mocks do not replace real authenticated browser coverage.

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

`tests/import-engine.test.ts`, `tests/import-files.test.ts`, and `tests/local-workspace.test.ts` exercise pure previews, bounded CSV/XLSX parsing, provenance/deduplication, and backup integrity. They use generated fictional fixtures only. `tests/browser/preview.spec.ts` covers anonymous denial; the opt-in authenticated importer/storage specs cover reviewed profiles, validation, reload persistence and transfer using a real local Admin. Local browser tests create isolated profiles and never use the owner's saved browser data.

For a second local checkout, start it on an unused port and set `TEST_APP_URL=http://127.0.0.1:3101 PLAYWRIGHT_CHANNEL=chrome pnpm test:ui`. The test configuration rejects remote URLs. Production HTTP smoke checks are separate and read-only.

## RENPHO reader checks

`tests/renpho.test.ts` contains wholly fictional text and geometry-region fixtures. It covers supported labels, source-column mass units, explicit/known-layout unit evidence, zero/negative numbers, literal percentage points, ignored regions, duplicate removal, invalid values/ranges/units, title/ID/date anchors, full and abbreviated English months, invalid calendar/time values, metadata ambiguity and parser limits. SMI fallback tests require explicit unit confirmation or exclusion, prevent stripping the immutable flag, and keep the generic text parser strict. Narrow Fat-Free Mass unit-glyph tests preserve numeric digits and reject an unseparated digit-like suffix. No real report values, IDs, images or OCR text are fixture data.

`tests/renpho-preview.test.ts` exercises the adapter into the existing measurement engine: fixed metric columns and page/source lines, excluded/reordered selections preserving observation IDs, repeats/renamed files becoming unchanged, OCR line drift reconciliation without rewriting existing provenance, athlete/date/unit/value remap conflicts, reviewed numeric edits, immutable provenance, unknown-athlete denial, parser-error blocking and aggregate capacity across pages. The local-workspace/engine tests additionally cover unique normalized RENPHO IDs, backup validation and the atomic measurement/remembered-ID save.

Run the focused pure checks with:

```sh
pnpm exec vitest run tests/renpho.test.ts tests/renpho-preview.test.ts
```

The focused checks passed during implementation. They do not by themselves exercise browser OCR or establish exact extraction from an actual image. For each additional report layout/version, privately compare its browser-extracted candidates with the source and verify supported labels, exact numerical agreement, units, printed report ID/date and excluded regions. Keep actual values/IDs out of terminal output, screenshots, traces, fixtures and receipts; record aggregate pass/fail results only. Synthetic one-page PDF, oversized-input and multi-page rejection checks remain separate from actual-image verification.

### Actual-image browser receipt

At **2026-09-05T02:28:00.864Z**, the authorized private browser check passed for the owner's supplied portrait report. The browser workspace contained **33 roster profiles and 16 approved report readings**. All 16 values and units exactly matched the image; the report ID and test date matched exactly. The intended owner's profile was uniquely selected, its report-ID alias was remembered, and all 16 readings were present on the profile after reload. No fallback unit-confirmation checkboxes were needed. Observed uploads/external requests: **0**. Browser errors: **0**.

The owner explicitly authorized including this report. A private workspace backup was saved outside the Git repository; its contents, filename details, actual values and report identifier are excluded from this receipt. This verifies the supplied image and that private browser workflow only. It does not establish support for every RENPHO layout or export version. The final full test suite and rebuild following subsequent profile-organization edits were still pending at this receipt and must be recorded separately before release.

In an isolated browser profile, verify that choosing a file creates no saved measurements or ID mapping; edits invalidate approval; unknown IDs require selection; a remembered exact ID proposes only its owning athlete; conflicts fail; save persists approved values and optional ID atomically; reload/backup restore retain those results; repeats add nothing; a stale revision blocks both parts of the save. Inspect network requests to establish that reports/text are never uploaded and that PDF/OCR assets load from the app's own origin. Check the red/black workspace and report-review tables at desktop/mobile widths. Existing protected-route and Auth tests remain required and separate.

## September 4, 2026 release verification

The final `pnpm check` passed lint, strict TypeScript, 243 tests across 10 files, and the production build. The complete production-mode local Chrome suite passed 23 tests and skipped 4 tests requiring separately provisioned Supabase Auth sessions. The suite includes real OCR of synthetic PNG and single-page PDF reports, review/edit/revision guards, duplicate prevention, no upload or external-origin requests, and rejection of multi-page PDFs. Three failure tests verify reload-only retries after failed/canceled OCR initialization and bounded forced termination of a stalled PDF worker.

The final reader build also re-read the private owner-provided PNG: 16 candidates, no parser errors, no browser errors or upload requests. The earlier exact-value/unit and actual-profile import receipt above remains the numerical validation. Separate synthetic profile checks verified that latest-report cards use one file hash/test date/source, do not backfill older measurements, preserve zeros and distinct units, and fit desktop/mobile widths. Private roster/report backups were restored through the UI on the custom domain in Chrome's School profile and the Codex browser; no real data was included in the public source or deployment.

## RENPHO chart release verification

`tests/renpho-charts.test.ts` covers athlete/report isolation, exact file-hash/date grouping, deterministic newest/history order, tied-date history limits, canonical page/hash provenance, missing measurements, ambiguous duplicate pairs, supported units, zero values, invalid percentages and finite numeric extremes. `tests/browser/renpho-charts.spec.ts` covers report and metric selectors, actual rendered bar proportions, zero-width marks, fixed percentage scales, same-day sources, unit separation, omission notices, baseline wording and responsive keyboard-accessible controls. Fixtures are fictional and restored into isolated local browser profiles through the normal backup UI.

The chart release passed `pnpm check`: lint, strict TypeScript, 256 tests across 11 files, and production build. The complete local production-mode Chrome suite passed 28 tests; four Supabase session integration tests remain skipped because their separate owner-provisioned identities are unavailable. Desktop 1440px and phone 390px synthetic chart screenshots were visually inspected without overflow or missing labels.

A private check at **2026-09-05T03:41:21.276Z** compared the owner's existing verified 16-reading backup to the charts: all 10 mass/percentage bars, six individual indicators and 16 history metric selections matched the saved exact values/units; history dates matched, reload retained the charts, and both viewport checks passed. Uploads, external requests and browser errors were all zero. The earlier actual-image receipt establishes agreement between that backup and the supplied report. This chart check does not re-extract or reinterpret the report, and private values/identifiers remain outside the repository.

## Access levels and View as

`tests/access-preview.test.ts` exercises the independent role matrix, actor binding, strict cookie format/expiry, canonical UUID comparisons, player-only reads and mutation denial. `tests/access-preview-server.test.ts` invokes the real auth, preview and administrative actions with a mocked trusted provider to verify live revocation, profile/API scoping, denied writes before RPC, explicit player verification and safe exit. These mocks do not replace the local Supabase integration suite above.

`tests/local-view.test.ts` checks pure browser-view projection and route restrictions. `tests/browser/local-view.spec.ts` uses isolated Chrome contexts and fictional backups: Coach/Player navigation, direct-route denials, reload persistence, absence of imports/backups, and complete exported-workspace equality before and after switching views. These verify presentation behavior only; browser-local views are not account authorization.

The account editor was also exercised in a temporary, localhost-only fictional component harness (removed before build). Checks covered prefilled settings, approval clearing after changes, invalid role/link combinations, blocked own-account edits, loading an already configured target, uppercase UUID normalization, a synthetic submit handler, and desktop/phone fit with no browser errors. No Supabase requests or real account mutations were used in that harness.

The access-view release passed lint, strict TypeScript, **294 tests across 14 files**, and a production build. The full local production Chrome suite passed **31 tests**, with **4 skipped** separately provisioned local Supabase sessions. New and existing roster, measurements, RENPHO OCR/charts, storage rollback, cross-tab revision and anonymous-access tests passed. View-menu, coach, player and account-editor layouts fit 1440px desktop and 390px phone widths with no browser errors. The account search field's decorative icon was removed after visual review to prevent overlap with its placeholder.

## Shared-profile precision verification

The final measurement-precision changes passed `pnpm check`: lint, TypeScript, **631 tests across 28 files**, and the production build. The earlier full profile browser suite passed 33 runnable tests with four separately provisioned Supabase-session tests skipped. The precision change adds no browser UI code. Live administrator checks confirmed the imported profile/report history, Coach view without administration, Player view without team/admin navigation, and a denied other-athlete profile URL. The corrected live derived-body comparison retains the one-player sample size without inventing a percentile. Separate teammate-account sign-ins remain unverified while invitations are paused.

## Staff imports, appearance and Fall game snapshot release

The release passed `pnpm check`: lint, strict TypeScript, **862 tests across 46 files**, and the production build. The final local production-mode Chrome suite passed **11 tests** and skipped **28 credential-dependent tests** because separately provisioned local Auth sessions were unavailable. The runnable checks cover anonymous route/API denial, login navigation and responsive controls, Light/Dark/System persistence, cross-tab synchronization, pre-paint appearance, and storage failure. No test accounts were provisioned and no invitations were sent.

Focused unit/database checks cover real staff import gates, read-only private View as, exact field serialization, source provenance, RENPHO fixed-position deduplication, reviewed Full Swing summary mapping, game-source capture coverage, Fall dates, atomic snapshot replacement and player row isolation. Temporary fictional component harnesses exercised desktop/phone settings, profiles, RENPHO/import lanes and game views; all harness routes were removed before the final build. These checks do not certify separate live Coach/Player sign-ins or raw vendor export layouts. No actual Full Swing export was available; raw swing/pitch aggregation remains unverified and is not automatically accepted.

Production database migrations 006 through 009 were applied through the authenticated SQL editor in transactions and verified. The live roster remained **34**, performance measurements **17**, game rows **0** and game snapshots **0**. New game tables enforce RLS; anonymous REST/RPC checks returned no records. A full private capture of each approved Fall Sheet found zero populated source rows, so no game statistics were fabricated or saved. The daily workflow retains its September 12 start and requires reviewed identity/date mappings, a running Mac/Codex session and an active staff login; a populated-source hosted write has not yet been exercised.

## Profile tabs, staff search and team leaderboards release

`pnpm check` passed lint, TypeScript, **964 tests across 50 files**, and the production build. The final local production-mode browser suite passed **11 tests** and skipped **29 credential-dependent tests** because dedicated local Supabase Auth identities remain unavailable. Anonymous denial now includes `/leaderboards`; an additional authenticated profile-tab regression is ready in that opt-in suite. No accounts were provisioned or invitations sent.

Synthetic browser QA covered **24 search/profile layout states** and **12 leaderboard layout states**, using Light/Dark and desktop/phone widths. It verified immediate names/PAC suggestions, keyboard selection/wrapping/escape, exact profile navigation, one active profile panel, tab Arrow/Home/End navigation, comparison metric/unit/source/period controls, neutral result presentation and empty states. Every mobile leaderboard row retains its date without horizontal scrolling. The final leaderboard harness had zero browser/console errors and zero POSTs; temporary routes and servers were removed before build. No private roster or report data was used in those harnesses.

The database suite verifies all new metric labels/units through an actual Coach-role numerical import and the Player adapter, without relabeling legacy Bat Speed. Leaderboard tests cover live active-role checks and revocation, unchanged Player-own raw-data RLS, minimal fields, exact values, latest-result selection, ties, isolated periods/sources/units, eligible roster, constrained same-report derivation and blocked peer links. These embedded database checks do not establish a separate live Coach/Player sign-in.

Migrations 010 and 011 were applied together to the existing Supabase project. A fresh post-reconnect schema read confirmed all eight new metric definitions and the leaderboard RPC after both had been absent before the transaction; **34 current roster entries, 17 measurements and zero game rows were preserved**. Live anonymous calls to both public leaderboard RPCs returned HTTP401 / SQLSTATE42501 with no rows. The leaderboard remains a narrow explicitly authorized signed-in team view, not general peer-history access. Game-sheet snapshots remain separate from these testing rankings.

## Coach-ready presentation review

The ranking-only presentation adds deterministic automatic comparison selection, no-filter rendering, height formatting (in/cm display conversion and foot carry), retained precision/source units, top-ten expansion and honest empty-state checks. Profile height and placeholder copy are exercised alongside existing profile/access tests.

Fictional localhost-only visual fixtures exercised the real profile, Overview, importer and leaderboard components in Light/Dark at 390px and 1440px. Checks included tab keyboard controls, empty and populated states, compact roster rows, all import categories, Game/Intrasquad selection, a two-player summary CSV through mapping/review with save disabled until approval, and top-ten leaderboard expansion. No production accounts or private data were used, and no save or external data request occurred. All temporary QA routes are removed before production builds.

Final coach-presentation verification passed lint, TypeScript, 984 tests across 51 files, and the production build. The local production browser suite passed 11 tests; 29 requiring separate local Auth identities were skipped. Synthetic QA covered 32 profile states, 56 coach/leaderboard/import checks, and eight additional phone import checks after compacting the category chooser. This does not replace separate live Coach/Player Auth onboarding tests.


## Profile Overview and workspace navigation release

The release passed lint, TypeScript, **1,044 tests across 53 files**, and the production build. The local production browser suite passed **11 tests**, with **29 credential-dependent tests skipped** because separate local Supabase Auth identities remain unavailable. No accounts were provisioned or invitations sent.

Focused tests verify the protected staff-roster/linked-player landing destinations, compatibility redirects without loops, retained preview notices, no duplicate profile Game Stats query, Overview as the default tab, and Hitting hidden for pitcher-only profiles while retained for explicit two-way players. Insight tests cover comparable-percentile thresholds, neutral metric exclusion, malformed data, exact athlete/source/unit/period isolation, distinct test dates, deterministic ties, zero baselines, declines and relative improvement direction.

A temporary localhost-only fictional fixture exercised **36 profiles and 132 tab states** across position players, pitchers and two-way players, empty/body-only/populated data, Light/Dark, and 390px/1440px widths. It verified keyboard navigation, actual before/after dates, lower-is-better gains, feet/inches, honest waiting states and no page overflow. Four additional phone checks confirmed all four position/two-way tabs fit on one line. Browser errors, external requests and writes were zero. Temporary routes and owned servers were removed before release; these checks do not replace separate live teammate sign-ins.


## Interactive Coach view and Physicality organization

The release passed lint, TypeScript, **1,067 tests across 56 files**, and the production build. The local production browser suite passed **11 tests**, with **29 credential-dependent tests skipped** because separate local Supabase Auth identities remain unavailable. The updated opt-in Coach browser test now saves a reviewed fictional measurement and checks that roster/backup/account controls remain unavailable. No production test measurements or accounts were created.

Focused tests exercise the real shared authorization resolver for interactive Admin Coach view, measurement/report/game-snapshot import routes, live Admin revocation, blocked Player writes, retained management restrictions, and Coach import receipt scoping to the actual signed-in user. Local provider tests cover valid Coach measurement saves, blocked roster/backup/restore/reset/export calls, and stale callbacks after view changes. Accessible names are verified through the actual submit-button wrapper.

Profile regression checks verify Body Fat % appears under Body Composition with its original value, pitcher-only speed/agility cards and insights are omitted, and shared displayed history excludes those tests without deleting the supplied measurements. Position and explicit two-way profiles retain speed testing. Fictional visual QA passed **24 profiles and 88 tab states** across Light/Dark, 390px/1440px, and empty/populated inputs; final desktop checks verified the two-card Body Composition row fills its width. No overflow, browser errors, external requests or writes occurred in that fixture. Temporary routes were removed and owned servers stopped before release. These tests do not replace separately onboarding a real Coach account.
