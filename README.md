# PACU Baseball Performance

Open [the live dashboard](https://pacu-baseball-performance-dashboard.vercel.app) without signing in. Browse ten fictional starter profiles, then import your roster and measurements into a **browser-local workspace**. Files stay in that browser; export a backup to keep or transfer them. The owner approved this scope on September 4, 2026 while password setup is paused. See [Import Center](docs/IMPORTS.md) and [the access boundary](docs/PREVIEW.md).

Phase 1 plus the owner-requested browser-local Import Center: identity, access, roster, and measurement imports. An independently owned personal project by **Trevor Kazahaya**, for use by Pacific Baseball players and coaches. This is **not an official university-owned application**.

Built with Next.js 16, React 19, TypeScript, Tailwind 4, Supabase Auth, and PostgreSQL. Deployable to Vercel. Authorized hosted development setup has begun; read the [current setup receipt](docs/HOSTED-SETUP.md) before repeating setup steps.

## Start here

1. Read [the beginner setup guide](docs/SETUP.md).
2. Install Node.js 24 LTS and pnpm 11, then run `pnpm install --frozen-lockfile` from this folder.
3. Copy `.env.example` to `.env.local`; enter your development project's public Supabase URL and publishable key.
4. For a new database, apply the tracked migrations to your intended **development** project, disable public signup, and provision your chosen initial administrator as described in the guide. For the already connected project, consult the receipt first: its schema is already applied.
5. Run `pnpm dev`, open the origin configured in `APP_URL` (currently `http://127.0.0.1:3000` for the connected development project), to use the browser workspace. The private team workspace additionally requires an owner-provisioned sign-in.

The browser workspace works without Supabase configuration. Private sign-in remains disabled until configured; public browsing does not create an account or grant database access.

On Trevor's Mac, after connection setup is complete, double-click **Start PACU.command** in this folder to open the local app. Keep its Terminal window open while using PACU. It reuses an already-running instance and never changes your Supabase database or creates accounts.

## Included in Phase 1

- Email/password login, logout, password recovery, and SSR session handling.
- Multiple trusted roles per account: Admin, Coach, Player. Live active/disabled status and PostgreSQL RLS.
- Separate permanent athlete identities, seasonal roster entries, login accounts, and administrator-approved account links.
- Responsive overview, roster, athlete profiles, roster import, and account-access administration.
- Strict CSV upload → validated database preview → explicit approval. Permanent-code matching, blank-preserving updates, duplicate/email checks, stale-preview protection, transactional application, and audit events.
- Exact [CSV template](public/templates/master-roster.csv) and [10 clearly fictional athletes](fixtures/synthetic-roster.csv). The public browser workspace starts with that fictional fixture. The protected Supabase roster uses an explicit administrator import.
- Tests that execute the migrations in embedded PostgreSQL and test browser access denial. Optional real local Supabase integration tests use separate owner-provisioned identities.

The browser-local Import Center reads CSV, TSV, and XLSX with explicit column mapping. It supports roster imports and numeric measurements tagged RENPHO, Blast, Rapsodo, Full Swing, Player Metrics, or a custom source. Vendor-specific schemas are not assumed. Dates, units, athlete matches, and row changes are reviewed before saving. Imported measurements appear on athlete profiles; absent measurements display **“No data yet.”** No performance statistics are fabricated. PDF parsing and direct Google Sheets sync remain pending actual formats and scope.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the local development app |
| `pnpm lint` | Run ESLint separately from the build |
| `pnpm typecheck` | Check TypeScript |
| `pnpm test` | Run CSV and actual PostgreSQL policy/import tests without network credentials |
| `pnpm test:ui` | Browser tests against an already running local app |
| `pnpm build` | Create a production build |
| `pnpm start` | Serve the production build locally |

## Project guide

- [SETUP](docs/SETUP.md): local software, environments, migrations, Auth configuration, provisioning, Vercel, redirect URLs.
- [DATA_MODEL](docs/DATA_MODEL.md): protected schema, browser-local data model, and future shared import architecture.
- [IMPORTS](docs/IMPORTS.md): file formats, mapping, athlete matching, review, backups, and limitations.
- [TESTING](docs/TESTING.md): reproducible checks and local Auth/API/UI tests.
- [VERIFICATION](docs/VERIFICATION.md): actual checks completed and remaining limitations.
- [HOSTED-SETUP](docs/HOSTED-SETUP.md): applied schema/Auth settings, owner/Admin account, and approved synthetic roster; password recovery and authenticated login/checks remain unresolved.
- [AGENTS](AGENTS.md): guardrails for future development.

The initial workspace contained only empty `work/` and `outputs/` folders, with no Git checkout. This source was created as a standalone project; no pre-existing repository was overwritten and no GitHub connection was assumed. To use an existing repository, review its contents first and copy these files into an appropriate branch.

## Deliberately deferred

Vendor-specific automatic presets and PDF parsing, direct Google Sheets sync, shared cloud measurements, game/physical/sprint analytics, force plates, AI interpretation, and training recommendations remain deferred. CSV/TSV/XLSX exports work through explicit mapping in the browser Import Center. Actual vendor formats have not been supplied; no vendor fields or units were invented.
