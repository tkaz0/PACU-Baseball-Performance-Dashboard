# Setup, step by step

These steps are for Trevor's independently owned project. Nothing in this repository automatically connects to GitHub, changes a hosted database, creates Auth users, sends emails, deploys, or changes DNS. **You choose when to perform those steps.** Use a development database with synthetic data first. For the already connected project, read [HOSTED-SETUP](HOSTED-SETUP.md) before repeating any migration or account-provisioning step.

## 1. Install local software

Install [Node.js 24 LTS](https://nodejs.org/en/download), [Git](https://git-scm.com/downloads), and an editor such as VS Code. Node includes npm. Open Terminal inside this project folder, then install the pinned package manager:

```sh
npm install --global pnpm@11.19.0
node --version
pnpm --version
pnpm install --frozen-lockfile
```

The project requires Node 22 or later and was checked using Node 24.19.0. Use Node 24 in Vercel too. The committed lockfile preserves the installed dependency versions. `pnpm-workspace.yaml` approves only the named build dependencies and retains package security settings.

Optional for a complete offline development stack: install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and follow [Supabase CLI installation](https://supabase.com/docs/guides/local-development/cli/getting-started). The app and embedded PostgreSQL tests do not require Docker; full local Supabase Auth/API tests do.

## 2. Create `.env.local`

In Terminal, from the project folder:

```sh
cp .env.example .env.local
```

Open `.env.local` in your editor. Copy **only the project URL and publishable key** from your intended development Supabase project's Connect/API Keys settings. Do not paste secret keys into chat or source files. The app never needs a service-role key.

| Variable | Value / purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Your development project's HTTPS URL, or local `http://127.0.0.1:54321` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The public publishable key for that same project |
| `APP_URL` | Trusted browser origin, initially `http://localhost:3000`. Used server-side for recovery redirects; not inferred from request headers. |
| `NEXT_PUBLIC_SYNTHETIC_DATA` | `true` for this synthetic development environment; shows a banner. It never grants access. Set `false` only for an intentionally configured non-synthetic environment. |

The connected hosted development project currently uses `APP_URL=http://127.0.0.1:3000` and that same Auth Site URL. Use `127.0.0.1` consistently in its browser session. The localhost examples below apply when deliberately configuring a separate local environment.

For the local CLI, `supabase status`/local Studio exposes connection settings; use the local publishable key. If using an older CLI that exposes only legacy keys, upgrade it; never substitute a privileged key. Keep URL and key from the same project. Do not include quotes around copied values unless your environment file parser requires them.

Restart `pnpm dev` after editing environment variables. `.env.local` and all `.env.*` files except `.env.example` are ignored by Git. Do not place real roster CSVs in fixtures; keep private files outside source or in ignored `private-data/`.

## 3. Apply migrations to the intended development database

There are two tracked migrations under `supabase/migrations/`. They create tables, policies, and functions; they do **not** create users, send email, or insert athletes. They do not delete or replace existing tables. If your database already has these table names or other prior schema work, inspect and reconcile it first; do not force the migrations over existing work.

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

Read the dry-run output. It should propose only the two supplied migrations. After confirming the intended development project and changes, run:

```sh
pnpm dlx supabase db push
```

If asked for a database password, enter it privately in the CLI prompt. Never add it to app environment variables, commands in shared documents, logs, source, or this chat. Do not put connection strings containing passwords in shell history. If a migration fails, stop and inspect it; do not delete existing tables to make it pass.

The app requires the `public` API schema, but **`private` must not be exposed through Supabase Data API settings**. The private schema contains carefully checked database functions. The browser and app server use public RPC wrappers with the user's session.

## 4. Configure Supabase Auth before creating player access

In **Authentication → Sign In / Providers** (labels can vary):

1. Enable email/password login.
2. Turn **Allow new users to sign up OFF**. Hiding a signup page alone does not disable Supabase's signup API.
3. Turn **Allow anonymous sign-ins OFF**. Do not enable unused providers.
4. Keep email confirmations enabled. Set a password policy with at least 12 characters; use unique generated passwords for every test identity. The reset form accepts 12–128 characters and Supabase enforces the configured password policy.
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

The standard Supabase PKCE recovery flow is also supported by `/auth/callback`, which exchanges the code and uses a fixed trusted destination. The standard code flow requires the same browser and hostname that requested the link because its verifier cookie is host-bound. Requesting on `localhost` and returning to `127.0.0.1` (or the reverse) does not work merely because both callback URLs are allowed. For the connected development environment, use `http://127.0.0.1:3000` consistently. The supplied token-hash template is the recommended cross-device recovery path. Do not add an arbitrary `next` destination to these handlers.

Recovery requests buffer Auth cookie changes and commit them only after a successful provider response. A failed or rate-limited send preserves existing PKCE verifier cookies, so that failure does not replace the verifier for an earlier request. This cannot restore an expired or already consumed link, and it does not establish successful email delivery or recovery. The generic reset confirmation does not prove that a new email was sent; check the provider's actual result when diagnosing a failed attempt. Three installed-SDK tests with mocked responses cover this regression; see [TESTING](TESTING.md).

Development logging of incoming request URLs and Server Function arguments is disabled in `next.config.ts` because recovery URLs and form arguments can contain private values. Before deployment, separately verify that hosting/proxy logs redact authentication query strings and never record credentials; these development settings do not configure production logging.

### Custom email sender before player invitations

Supabase's default sender is for limited testing and restricts recipients/delivery. Before inviting players or relying on production resets, choose an SMTP provider, verify a sending domain you control, and configure sender address, name, host, port, username, and password in **Supabase Auth → SMTP Settings**. Set the provider's required SPF/DKIM records and appropriate DMARC policy through your DNS provider only when you explicitly approve those DNS changes. Store SMTP secrets with Supabase/provider settings, never this app.

Use your independently owned domain and branding; do not assume permission to send from the university domain. Disable provider click tracking if it rewrites Auth links. Send a test to an owner-controlled inbox after authorizing it and verify delivery, reset, expiration, and replay handling. Purchasing `pacubaseballperformance.com` does not by itself configure SMTP or email delivery. No player invitations or custom-SMTP delivery tests have been performed. Owner recovery sends and the throttled retry are recorded in [HOSTED-SETUP](HOSTED-SETUP.md).

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
5. In **Account access**, paste each verified Auth UUID, select its exact intended role(s), mark active, and confirm. Link Player A to `SYN-001` and Player B to `SYN-002`. Leave Coach without an athlete link. Verify names/codes independently of email before linking.

This page replaces roles, active status, and the link as one approved/audited change. An unchecked active box disables access. An empty athlete selection removes the link. It refuses linking an athlete already assigned to another account, linking without Player role, or editing your own account. Admin+Player is supported as a union of permissions; it does not pretend to simulate a restricted player view.

To make your own account both Admin and Player later, have a **different** administrator approve that change, or use the explicitly selected UUIDs in `supabase/admin/owner-link-self.sql` as owner. That script preserves Admin, adds Player, requires an existing verified athlete, and audits the link. It refuses to replace an existing link silently.

## 7. Start and test the app

```sh
pnpm dev
```

Open the origin configured in `APP_URL`—currently `http://127.0.0.1:3000` for the connected development project. Keep this terminal open; stop with Ctrl+C. You should see a synthetic-data banner after connecting to your development environment. The generic login page never exposes athlete records. Full test instructions are in [TESTING.md](TESTING.md).

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The production build does not need live credentials to compile. That proves the code builds, not that your Supabase project is configured. To check the build locally, stop `pnpm dev`, then run `pnpm start`.

## 8. Deploy to Vercel when you explicitly choose to

No deployment has been performed. After reviewing this source and completing development tests:

1. Copy the project into your chosen GitHub repository/branch after inspecting and preserving existing work. Before committing, inspect `git status` and staged changes. Only synthetic fixture/template CSVs should be tracked; never force-add `.env.local` or roster exports.
2. In Vercel, import that repository. Choose the Next.js preset and set **Root Directory** to this project's location inside the repository. If its contents are at repository root, leave Root Directory at root.
3. Select Node 24.x. Add the **Vercel-only build variable** `ENABLE_EXPERIMENTAL_COREPACK=1` for each environment you will deploy. It enables Vercel's documented Corepack support so the existing `packageManager: "pnpm@11.19.0"` pin is used. This additional variable is not a secret and is not read by the app. Do not rely on an unqualified install override alone: Vercel can otherwise select an older pnpm version. See [Vercel package managers](https://vercel.com/docs/package-managers) and [Corepack configuration](https://vercel.com/docs/builds/configure-a-build#corepack).
4. With Corepack enabled, use `pnpm install --frozen-lockfile` and `pnpm build`; keep the default Next.js output setting. Do not configure this as a static export: authentication requires server execution. Check the first build's output to confirm pnpm **11.19.0** was selected. A successful local build does not verify Vercel's build environment.
5. Add the same four app environment variables for the intended environment, in addition to the Vercel-only build flag above. Point Preview deployments at a separate development Supabase project with synthetic data. For a deployed synthetic preview, keep `NEXT_PUBLIC_SYNTHETIC_DATA=true` even though Next.js uses production mode.
6. Set `APP_URL` to the exact stable HTTPS deployment origin, such as your assigned Vercel project hostname. Do not guess a deployment hostname or use broad wildcard callback permissions. Redeploy after changing variables.
7. Choose **Deploy** only when ready. Test login, logout, recovery, and each role with real separate test sessions before using any real roster data.

## 9. Update Auth URLs after deployment

For the Supabase project serving that deployment:

- Set Auth **Site URL** and Vercel `APP_URL` to the same exact HTTPS origin.
- Add exact `/auth/callback`, `/auth/confirm`, and `/reset-password` redirect URLs for that origin.
- Keep localhost URLs only in a development project that still needs them. Use separate development/production projects; changing Site URL changes where the recovery template sends users.
- If/when you approve connecting `pacubaseballperformance.com`, add it in Vercel, follow Vercel's verified DNS instructions, then update `APP_URL`, Site URL, and the three redirect paths to `https://pacubaseballperformance.com`. Do not change DNS simply because the domain is mentioned here.

## Official references checked for this implementation

- [Next.js installation and system requirements](https://nextjs.org/docs/app/getting-started/installation)
- [Supabase SSR clients and Proxy](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Supabase password-based Auth](https://supabase.com/docs/guides/auth/passwords)
- [Auth configuration](https://supabase.com/docs/guides/auth/general-configuration), [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Database migrations](https://supabase.com/docs/guides/local-development/database-migrations), [local config](https://supabase.com/docs/guides/local-development/cli/config), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs)
