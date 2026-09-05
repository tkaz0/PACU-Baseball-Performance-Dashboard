# Setup, step by step

The private home route opens sign-in or the authorized team workspace. Player profiles combine reviewed shared measurements, history and fixed-cohort comparisons; coaches can read the team and administrators manage imports and access. The owner has requested this expanded scope. Historical environment receipts are in [HOSTED-SETUP](HOSTED-SETUP.md).

The separate `/preview` browser workspace still supports fictional starter profiles and local CSV/TSV/XLSX/RENPHO review without a Supabase account. It requires JavaScript and site storage. Local imports do not become shared by signing in: an administrator must import the protected roster and approve the separate numerical sharing step. Use synthetic data in a development database first and inspect migration history before setup.

For body-composition reports, open **Import Center → RENPHO report** and choose a complete portrait PNG/JPG or one-page PDF. The local reader needs its first asset load before it can process a report. Confirm the selected player, test date and each extracted value/unit against the displayed original; uncheck unwanted readings, review, then approve saving. A new report ID requires player selection. You may explicitly remember that exact ID for later imports in this browser. The roster's optional `renpho_id` uses the same exact-match behavior. No IDs create sign-in accounts or connect Supabase identities.

Use the [local roster template](../public/templates/local-roster.csv) for browser imports; the protected administrator template retains its original 16 fields. Export a workspace backup after importing real data. The report image/text is not included in the backup, but saved measurements and remembered report IDs are, so keep the backup private. Browser storage belongs to the exact domain and browser profile; it is not a team-shared database.

After saving a RENPHO report, open that player's profile and scroll to **RENPHO charts**. The **RENPHO report** selector changes the mass bars, percentage bars and individual indicators together. **History measurement** compares the same measurement and unit across reports; use **View chart values and sources** for the exact dates, readings and source files. Your existing saved reports populate the charts after refreshing the dashboard; no re-import is needed.

## 1. Install local software

Install [Node.js 24 LTS](https://nodejs.org/en/download), [Git](https://git-scm.com/downloads), and an editor such as VS Code. Node includes npm. Open Terminal inside this project folder, then install the pinned package manager:

```sh
npm install --global pnpm@11.19.0
node --version
pnpm --version
pnpm install --frozen-lockfile
```

The project requires Node 22.13 or later and was checked using Node 24.19.0. Use Node 24 in Vercel too. The committed lockfile preserves the installed dependency versions. `pnpm-workspace.yaml` approves only the named build dependencies and retains package security settings.

Optional for a complete offline development stack: install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and follow [Supabase CLI installation](https://supabase.com/docs/guides/local-development/cli/getting-started). The app and embedded PostgreSQL tests do not require Docker; full local Supabase Auth/API tests do.

## 2. Create `.env.local` for the private workspace

In Terminal, from the project folder:

```sh
cp .env.example .env.local
```

Open `.env.local` in your editor. For normal private-workspace access, copy the project URL and publishable key from your intended development Supabase project's Connect/API Keys settings. Normal database reads and writes use these public connection values plus the signed-in session. The optional invitation feature has a separate server-only Auth administrator secret, described below; do not substitute it for the publishable key or paste it into chat or source files.

| Variable | Value / purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Your development project's HTTPS URL, or local `http://127.0.0.1:54321` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The public publishable key for that same project |
| `APP_URL` | Trusted browser origin. Use the exact local origin during development; the custom-domain deployment target is `https://pacubaseballperformance.com`. Used server-side for recovery redirects; not inferred from request headers. |
| `NEXT_PUBLIC_SYNTHETIC_DATA` | `true` for this synthetic development environment; shows a banner. It never grants access. Set `false` only for an intentionally configured non-synthetic environment. |
| `SUPABASE_AUTH_ADMIN_SECRET` | Optional **server-only** Auth administration secret from the same project, used only to check Auth users and send invitations. Leave blank while invitations are disabled. Never use a `NEXT_PUBLIC_` prefix. |
| `PACU_INVITATIONS_ENABLED` | Defaults to `false` in `.env.example`. Set exactly `true` only for an environment whose new migration, SMTP and email templates have been verified. The secret must also be present. |

Keep local and deployed settings separate. For local development, choose `http://127.0.0.1:3000` or `http://localhost:3000` and use that host consistently. The localhost examples below describe a separately configured local Supabase environment. Vercel `APP_URL`, Supabase Auth Site URL, and the three exact custom-domain redirects use `https://pacubaseballperformance.com`. Redeploy after any later environment change; see [HOSTED-SETUP](HOSTED-SETUP.md).

For the local CLI, `supabase status`/local Studio exposes connection settings; use the local publishable key. If using an older CLI that exposes only legacy keys, upgrade it; never substitute a privileged key. Keep URL and key from the same project. Do not include quotes around copied values unless your environment file parser requires them.

Restart `pnpm dev` after editing environment variables. `.env.local` and all `.env.*` files except `.env.example` are ignored by Git. Do not place real roster CSVs in fixtures; keep private files outside source or in ignored `private-data/`.

## 3. Apply migrations to the intended development database

There are five tracked migrations under `supabase/migrations/`. The first two create identity/access and the protected roster importer. `202609050003_invited_account_provisioning.sql` adds checked invitation provisioning; `202609060001_performance_profiles.sql` adds reviewed shared measurements and restricted aggregate comparisons; `202609060002_coach_rollout.sql` adds administrator-only coach preparation. These migrations do **not** create Auth users, send email, or insert athletes. They do not delete or replace existing tables. If your database already has these table names or other prior schema work, inspect and reconcile it first; do not force migrations over existing work.

### Option A: local Supabase (recommended for complete tests)

Start Docker Desktop, then run:

```sh
pnpm dlx supabase start
pnpm dlx supabase migration up --local
pnpm dlx supabase status
```

The supplied `supabase/config.toml` configures the local project and disables public signup, anonymous Auth, and automatic seed execution. Use local Studio (normally `http://127.0.0.1:54323`). Use the app consistently at `http://localhost:3000`, matching `APP_URL` and the Auth Site URL.

Do not run `supabase db reset` against any database with data you want to keep. The reset command erases/recreates local data; it is unnecessary for initial setup here.

### Option B: your hosted development Supabase project (owner action)

Do this only when you deliberately approve changing that development project. In the Supabase dashboard, confirm the project name **and project reference** in its settings. Keep production separate.

The CLI route records migration history:

```sh
pnpm dlx supabase login
pnpm dlx supabase link --project-ref YOUR_VERIFIED_DEVELOPMENT_PROJECT_REF
pnpm dlx supabase migration list
pnpm dlx supabase db push --dry-run
```

For a fresh database, the dry run should propose all five supplied migrations in order. For an existing database, it should propose only the files absent from its verified migration history. Invitation provisioning, shared performance and coach preparation are separate upgrades; do not assume they were applied together. If the original schema was applied manually and migration history is missing, verify the existing schema and reconcile that history before proceeding; do not replay the original files. After confirming the intended development project and exact changes, run:

```sh
pnpm dlx supabase db push
```

If asked for a database password, enter it privately in the CLI prompt. Never add it to app environment variables, commands in shared documents, logs, source, or this chat. Do not put connection strings containing passwords in shell history. If a migration fails, stop and inspect it; do not delete existing tables to make it pass.

The app requires the `public` API schema, but **`private` must not be exposed through Supabase Data API settings**. The private schema contains carefully checked database functions. The browser and app server use public RPC wrappers with the user's session.

For the already connected hosted project, the invitation migration is a separate, explicitly reviewed upgrade. A passing local test or production build does not apply it remotely. Keep invitation sending disabled until its exact public RPC and grants are confirmed in the intended database; do not rerun the first-admin script or synthetic roster import as part of this upgrade.

## 4. Configure Supabase Auth before creating player access

In **Authentication → Sign In / Providers** (labels can vary):

1. Enable email/password login.
2. Turn **Allow new users to sign up OFF**. Hiding a signup page alone does not disable Supabase's signup API.
3. Turn **Allow anonymous sign-ins OFF**. Do not enable unused providers.
4. Keep email confirmations enabled. Set the password minimum to 6 characters, the lowest supported value in [Supabase's official configuration template](https://github.com/supabase/cli/blob/develop/apps/cli-go/pkg/config/templates/config.toml#L181-L182). The owner requested no additional minimum or year suffix; the reset form accepts 6–128 characters with no character-mix requirement. The earlier 12- and 8-character policies are historical. Use a different password for each test identity.
5. In **Authentication → URL Configuration**, set **Site URL** to `http://localhost:3000` for the development project. Add these exact redirect URLs:
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3000/auth/confirm`
   - `http://localhost:3000/reset-password`
6. Keep built-in Auth rate limits enabled. Configure stricter limits for your expected usage if needed. A generic reset response avoids revealing which emails have accounts.

### Password recovery template

The connected project's Dashboard was inspected on September 4, 2026: with the default sender, reset-template source and save controls were disabled, and the UI offered custom SMTP or a plan upgrade to enable editing. If you encounter this restriction, configure a custom SMTP provider using the section below, then install the template. This project does not require or initiate a plan upgrade. Until then, the default template remains in place and the app's same-browser PKCE callback may support it; delivery must be tested rather than assumed.

When template editing is available, in **Authentication → Email Templates → Reset Password**, use the body in `supabase/templates/recovery.html`. Its link targets:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=recovery">Continue to password reset</a>
```

The landing page waits for an explicit button click before consuming the one-time token. It then verifies `type=recovery`, establishes a cookie session, and opens the password form. Expired/invalid links return to login with an error. Successful changes request global session sign-out and return to login. Already-issued JWTs can last until their expiry; disabling a trusted app account independently removes database access on subsequent requests.

The standard Supabase PKCE recovery flow is also supported by `/auth/callback`, which exchanges the code and uses a fixed trusted destination. The standard code flow requires the same browser and hostname that requested the link because its verifier cookie is host-bound. Requesting on `localhost` and returning to `127.0.0.1`, or requesting on the Vercel alias and returning to the custom domain, does not work merely because both callback URLs are allowed. After the domain configuration is verified, start and finish private sign-in/reset flows on `https://pacubaseballperformance.com` in the same browser. The supplied token-hash template is the recommended cross-device recovery path. Do not add an arbitrary `next` destination to these handlers.

Recovery requests buffer Auth cookie changes and commit them only after a successful provider response. A failed or rate-limited send preserves existing PKCE verifier cookies, so that failure does not replace the verifier for an earlier request. This cannot restore an expired or already consumed link, and it does not establish successful email delivery or recovery. The generic reset confirmation does not prove that a new email was sent; check the provider's actual result when diagnosing a failed attempt. Three installed-SDK tests with mocked responses cover this regression; see [TESTING](TESTING.md).

Development logging of incoming request URLs and Server Function arguments is disabled in `next.config.ts` because recovery URLs and form arguments can contain private values. Before deployment, separately verify that hosting/proxy logs redact authentication query strings and never record credentials; these development settings do not configure production logging.

### Custom email sender before player invitations

Supabase's default sender is for limited testing and restricts recipients/delivery. Before inviting players or relying on production resets, choose an SMTP provider, verify a sending domain you control, and configure sender address, name, host, port, username, and password in **Supabase Auth → SMTP Settings**. Set the provider's required SPF/DKIM records and appropriate DMARC policy through your DNS provider only when you explicitly approve those DNS changes. Store SMTP secrets with Supabase/provider settings, never this app.

Use your independently owned domain and branding; do not assume permission to send from the university domain. Disable provider click tracking if it rewrites Auth links. Send a test to an owner-controlled inbox after authorizing it and verify delivery, reset, expiration, and replay handling. Purchasing `pacubaseballperformance.com` does not by itself configure SMTP or email delivery. No player invitations or custom-SMTP delivery tests have been performed. Owner recovery sends and the throttled retry are recorded in [HOSTED-SETUP](HOSTED-SETUP.md).

### Enable reviewed individual invitations

The invitation form is implemented under private **Account access**, but `.env.example` leaves sending disabled. Complete the following for the exact environment before enabling it:

1. Verify the owner can sign in as an active administrator, and apply the new invitation-provisioning migration after reviewing the existing migration history.
2. Configure and verify custom SMTP. Install `supabase/templates/invite.html` as **Invite user** and the existing recovery template as **Reset password** in hosted Auth settings. The local `supabase/config.toml` template entries do not change hosted templates.
3. Keep the verified Site URL and exact authentication redirects on the intended origin. Exercise an explicitly approved owner-controlled invitation and recovery flow, including the confirmation button, recipient-chosen password, fresh login, expiry and replay. Use local Supabase/Mailpit first; Supabase Dashboard invitations can verify the hosted recipient flow while the app's sending flag remains false. Do not send team invitations as a setup test.
4. Add `SUPABASE_AUTH_ADMIN_SECRET` privately to the server environment for that same Supabase project. The code exposes only its Auth administrator interface; it uses this privilege to inspect the Auth directory and invite a new user. The application still uses the administrator's ordinary session for audited database provisioning. The SMTP password remains in Supabase/provider settings, not this environment variable.
5. Set `PACU_INVITATIONS_ENABLED=true` for the verified environment and restart/redeploy. Keep it false in every other environment. Disabling this flag removes the sending form and blocks its server action; it does not revoke accounts already provisioned.

With sending enabled, review one person's sign-in email, choose Coach or Player, select the exact unlinked private athlete for a Player, and explicitly approve **Send approved invitation**. This is separate from roster email matching. Existing Auth users are not reinvited; review their existing account and use password recovery. Timeouts can mean an email was sent: inspect Auth/provider records before retrying. If the invitation succeeds but database provisioning is not confirmed, the app instructs an administrator to review that user and configure existing access; it never silently overwrites an existing account. See [INVITATIONS](INVITATIONS.md) for the full flow and testing limits.

Private logins do not transfer records saved in one browser. Import the reviewed roster into the protected database, retain its permanent codes, then approve shared numerical measurements using the workflow below. Never distribute the complete local workspace backup to give players access.

## 5. Create the first administrator deliberately

1. In development Supabase **Authentication → Users → Add user → Create new user**, create your own test account using an email/inbox you control and a unique password from a password manager. Choose the manual create-user option, not an invitation. For owner-controlled test identities, manually auto-confirm the email if that option is shown so no email is sent. Use local Studio and synthetic `example.com` identities for offline testing.
2. Copy that exact user's **Auth UUID** from its user record. Verify it is the user you selected.
3. Open `supabase/admin/first-admin.sql`. In a private SQL Editor session for the verified development project, paste the script and replace only its placeholder UUID. Review, then run it as the project owner. Do not commit the filled-in copy.
4. The script checks that the Auth user exists and refuses to bootstrap if an active admin already exists. It creates the trusted account/role and an audit event. No first-login behavior exists.
5. Start the app and sign in as that user. You should see Overview, Master roster, Roster import, and Account access.

Never use last-name-plus-number passwords or a shared default. Keep credentials in a password manager. Do not ask an athlete to submit their own athlete ID to claim a profile.

## 6. Load synthetic athletes and configure separate test identities

1. Sign in as Admin and open **Roster import**.
2. Enter season `2026`, upload `fixtures/synthetic-roster.csv`, and choose **Validate and preview**.
3. Review 10 fictional athletes and the field changes. Check the approval box and choose **Approve and apply import**. Verify Avery Northstar has jersey `0` and Jordan Westcloud has no jersey value. Importing the same file again should show 10 unchanged rows.
4. Manually create separate **Coach**, **Player A**, and **Player B** Auth users as above, each with a unique password. No account is created by importing the fixture.
5. In **Account access**, choose **Configure existing user** and paste each verified Auth UUID, select its exact intended role(s), mark active, and confirm. For later edits, search and select a configured account to prefill its current settings. Link Player A to `SYN-001` and Player B to `SYN-002`. Leave Coach without an athlete link. Verify names/codes independently of email before linking.

This page replaces roles, active status, and the link as one approved/audited change. An unchecked active box disables access. An empty athlete selection removes the link. It refuses linking an athlete already assigned to another account, linking without Player role, or editing your own account. Admin+Player is supported as a union of permissions; it does not pretend to simulate a restricted player view.

To make your own account both Admin and Player later, have a **different** administrator approve that change, or use the explicitly selected UUIDs in `supabase/admin/owner-link-self.sql` as owner. That script preserves Admin, adds Player, requires an existing verified athlete, and audits the link. It refuses to replace an existing link silently.

## 7. Start and test the app

```sh
pnpm dev
```

Open the local URL printed by Next.js. The home page directs visitors to sign-in and authorized accounts to `/overview`. To use local imports without sign-in, open `/preview` explicitly; it starts with ten fictional athletes until replaced by a reviewed local roster. Use its Import Center to map, review and save files. Keep this terminal open; stop with Ctrl+C. Private sign-in/reset flows must use the origin configured in `APP_URL`. Full test instructions are in [TESTING.md](TESTING.md).

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The production build does not need live credentials to compile. That proves the code builds, not that your Supabase project is configured. To check the build locally, stop `pnpm dev`, then run `pnpm start`.

## 8. Deploy to Vercel when you explicitly choose to

The owner-approved browser workspace is deployed at `https://pacubaseballperformance.com`; the original Vercel alias remains available for browser-data transfers. The deployment uses Node 24.x, Corepack, and pnpm 11.19.0. These steps describe configuration for this project or a new environment:

1. Copy the project into your chosen GitHub repository/branch after inspecting and preserving existing work. Before committing, inspect `git status` and staged changes. Only synthetic fixture/template CSVs should be tracked; never force-add `.env.local` or roster exports.
2. In Vercel, import that repository. Choose the Next.js preset and set **Root Directory** to this project's location inside the repository. If its contents are at repository root, leave Root Directory at root.
3. Select Node 24.x. Add the **Vercel-only build variable** `ENABLE_EXPERIMENTAL_COREPACK=1` for each environment you will deploy. It enables Vercel's documented Corepack support so the existing `packageManager: "pnpm@11.19.0"` pin is used. This additional variable is not a secret and is not read by the app. Do not rely on an unqualified install override alone: Vercel can otherwise select an older pnpm version. See [Vercel package managers](https://vercel.com/docs/package-managers) and [Corepack configuration](https://vercel.com/docs/builds/configure-a-build#corepack).
4. With Corepack enabled, use `pnpm install --frozen-lockfile` and `pnpm build`; keep the default Next.js output setting. Do not configure this as a static export: authentication requires server execution. Check the first build's output to confirm pnpm **11.19.0** was selected. A successful local build does not verify Vercel's build environment.
5. Add the four normal app environment variables for the intended environment, in addition to the Vercel-only build flag above. Keep optional invitation sending disabled until its separate rollout is verified; only then add the server-only Auth secret and enable its flag. Point Preview deployments at a separate development Supabase project with synthetic data, and never copy a production Auth administrator secret into previews. For a deployed synthetic preview, keep `NEXT_PUBLIC_SYNTHETIC_DATA=true` even though Next.js uses production mode.
6. Set `APP_URL` to the exact stable HTTPS deployment origin. This project's custom-domain target is `https://pacubaseballperformance.com`. Do not use broad wildcard callback permissions. Redeploy after changing variables.
7. Choose **Deploy** only when ready. Check the public workspace and imports independently of Auth. Before using the private shared roster, test login, logout, recovery, and each role with separate test sessions.

## 9. Update Auth URLs after deployment

For the Supabase project serving that deployment:

- Set Auth **Site URL** and Vercel `APP_URL` to the same exact HTTPS origin.
- Add exact `/auth/callback`, `/auth/confirm`, and `/reset-password` redirect URLs for that origin.
- Keep localhost URLs only in a development project that still needs them. Use separate development/production projects; changing Site URL changes where the recovery template sends users.
- The owner-approved custom-domain settings are saved: Vercel `APP_URL` and Supabase Site URL use `https://pacubaseballperformance.com`, with exact redirects `https://pacubaseballperformance.com/auth/callback`, `https://pacubaseballperformance.com/auth/confirm`, and `https://pacubaseballperformance.com/reset-password`. Existing redirect entries were retained. After any address change, redeploy and verify the live callback destination; see [HOSTED-SETUP](HOSTED-SETUP.md).

### Move saved browser data to the custom domain

IndexedDB is specific to the exact origin and browser profile. Data saved at the Vercel alias does not automatically appear at the custom domain, even though both show the same app. Keep [the original Vercel alias](https://pacu-baseball-performance-dashboard.vercel.app) available for transfers.

1. In the same browser profile that holds your data, open the original alias and choose **Import Center → Export backup**.
2. Open `https://pacubaseballperformance.com` after its HTTPS configuration is verified, then choose **Restore workspace JSON backup** in Import Center.
3. Select the exported JSON file, review the replacement confirmation, and choose **Restore backup**. Confirm your roster and measurements appear before clearing data at the old origin.

Restore replaces the destination browser's roster, measurements, and import history. Export a destination backup first if it already holds data you want to keep. The alias and custom domain remain separate workspaces; later edits do not synchronize. The same rule applies to `www`, localhost, and another browser or device.

## Official references checked for this implementation

- [Next.js installation and system requirements](https://nextjs.org/docs/app/getting-started/installation)
- [Supabase SSR clients and Proxy](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Supabase password-based Auth](https://supabase.com/docs/guides/auth/passwords)
- [Auth configuration](https://supabase.com/docs/guides/auth/general-configuration), [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Database migrations](https://supabase.com/docs/guides/local-development/database-migrations), [local config](https://supabase.com/docs/guides/local-development/cli/config), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs)

## Preview coach and player access

The browser workspace has a **View as** menu and **Access & views** page. Choose Coach or select a player and choose Preview player. A visible banner identifies this as a read-only layout preview. Exit preview restores full browser-workspace controls without changing its saved roster, measurements, or backups. This does not grant accounts, change real roles, or protect browser storage.

After signing into the private workspace as an active administrator, its separate **View as** menu uses trusted server access checks. Choose Coach or a specific athlete for Player. The effective view hides administration and refuses roster/account mutations. Player routes and API responses are explicitly scoped to the selected athlete. Exit preview restores actual roles. An invalid, expired, or unavailable selection shows a recovery page rather than falling back to full admin access. The four-hour preview preference applies to private workspace tabs in that browser; refresh another tab to update its visible navigation.

Account roles remain independent of preview choices. A real player login needs an administrator-approved athlete link. Switching a preview creates no accounts, links, invitations or measurement imports. Shared measurements have their own approved import workflow. See [ACCESS_VIEWS.md](ACCESS_VIEWS.md).


## Share reviewed performance measurements

The target database needs `202609060001_performance_profiles.sql` before this workflow. See [PLAYER_PROFILES](PLAYER_PROFILES.md) for supported metrics and comparison rules.

1. Import and review the intended private roster, retaining permanent athlete codes and adding its `2026-27` season entries. Account links still require separate administrator approval.
2. In `/preview/import`, finish reviewing the original reports, selected athletes, dates, values and units. Export a private workspace JSON backup.
3. Sign in as Admin, exit View as, and open **Shared measurements** (`/admin/performance`). Choose the backup; the current UI accepts up to 2 MiB.
4. Review every supported reading against its intended shared athlete. Unknown metrics are listed as exclusions; invalid recognized units/values/provenance and unmatched athletes block sharing. One approved batch supports at most 500 readings. Both the posted Measurement JSON and normalized database JSON must fit within 1 MiB. A larger batch needs deliberate selection/export of a smaller set; the app does not split and partly save it automatically.
5. Confirm the review and select **Share with team**. Only the exact numerical Measurement fields and source provenance are posted. The full backup, report images/text, unknown extra fields and remembered report IDs remain on the device.
6. Verify the resulting private profile and import receipt. Repeated observations are unchanged; conflicting data for the same observation rejects the transaction. The original source filename/import metadata survives a renamed-file retry. Removing a local batch does not delete a shared observation.

## Prepare player and coach accounts

After applying `202609060002_coach_rollout.sql`, open **Team account preparation** (`/admin/rollout`) as an active administrator outside preview. It lists `2026-27` players with roster/account readiness and stores individually reviewed coach names/emails. The list supports up to 100 coaches; saving the same normalized email updates the name and records an audit event.

**Ready to invite** means roster prerequisites are present; it does not verify an inbox or send an email. **Account connected** means a trusted active Player link exists; it does not prove password setup. A saved coach is only a preparation record. Use the separate Account access flow and explicit recipient approval when invitations are authorized. The owner has said not yet to team emails; keep sending disabled and unsent until explicit approval.
