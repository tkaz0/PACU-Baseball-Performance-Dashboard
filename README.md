# PACU Baseball Performance

Open [the live dashboard](https://pacubaseballperformance.com) without signing in. Browse ten fictional starter profiles, then import your roster and measurements into a **browser-local workspace**. Files stay in that browser; export a backup to keep or transfer them. The owner approved this scope on September 4, 2026. Individual account invitations are now implemented for the separate private workspace, with sending disabled until email and server setup are verified. See [invitations](docs/INVITATIONS.md), [Import Center](docs/IMPORTS.md), and [the access boundary](docs/PREVIEW.md). If you previously imported data at the Vercel address, follow [the backup transfer steps](docs/SETUP.md#move-saved-browser-data-to-the-custom-domain) to bring it to the custom domain.

Phase 1 plus the owner-requested browser-local Import Center: identity, access, roster, and measurement imports. An independently owned personal project by **Trevor Kazahaya**, for use by Pacific Baseball players and coaches. This is **not an official university-owned application**.

Built with Next.js 16, React 19, TypeScript, Tailwind 4, Supabase Auth, and PostgreSQL. Deployable to Vercel. Authorized hosted development setup has begun; read the [current setup receipt](docs/HOSTED-SETUP.md) before repeating setup steps.

## Start here

1. Read [the beginner setup guide](docs/SETUP.md).
2. Install Node.js 24 LTS and pnpm 11, then run `pnpm install --frozen-lockfile` from this folder.
3. Copy `.env.example` to `.env.local`; enter your development project's public Supabase URL and publishable key.
4. For a new database, apply all three tracked migrations to your intended **development** project, disable public signup, and provision your chosen initial administrator as described in the guide. For the already connected project, consult its receipt and migration history first: do not replay the original schema; the new invitation-provisioning migration is a separate upgrade.
5. Run `pnpm dev` and open the local URL printed by Next.js to use the browser workspace. For local private sign-in/reset flows, set `APP_URL` to that same local origin. The private team workspace additionally requires an owner-provisioned sign-in.

The browser workspace works without Supabase configuration. Private sign-in requires Supabase configuration and an explicitly authorized account; public browsing does not create an account or grant database access. Optional invitations require `SUPABASE_AUTH_ADMIN_SECRET` on the server and `PACU_INVITATIONS_ENABLED=true`, enabled only after the new migration, SMTP and email templates are verified. Normal database access continues using the public connection values and signed-in user's session.

On Trevor's Mac, after connection setup is complete, double-click **Start PACU.command** in this folder to open the local app. Keep its Terminal window open while using PACU. It reuses an already-running instance and never changes your Supabase database or creates accounts.

## Included in Phase 1

- Email/password login, logout, password recovery, invitation acceptance, and SSR session handling. A gated admin invitation form supports individually reviewed Coach or Player accounts and recipient-chosen passwords; hosted delivery and onboarding are not yet verified.
- Admin “View as” Coach/Player previews with explicit athlete selection, read-only controls, and an easy exit; searchable account management. Browser-local role previews are labeled separately from secure account access. See [Access & views](docs/ACCESS_VIEWS.md).
- Multiple trusted roles per account: Admin, Coach, Player. Live active/disabled status and PostgreSQL RLS.
- Separate permanent athlete identities, seasonal roster entries, login accounts, and administrator-approved account links.
- Responsive overview, roster, athlete profiles, roster import, and account-access administration.
- Strict CSV upload → validated database preview → explicit approval. Permanent-code matching, blank-preserving updates, duplicate/email checks, stale-preview protection, transactional application, and audit events.
- Exact [CSV template](public/templates/master-roster.csv) and [10 clearly fictional athletes](fixtures/synthetic-roster.csv). The public browser workspace starts with that fictional fixture. The protected Supabase roster uses an explicit administrator import.
- Tests that execute the migrations in embedded PostgreSQL and test browser access denial. Optional real local Supabase integration tests use separate owner-provisioned identities.

The browser-local Import Center reads CSV, TSV, and XLSX with explicit column mapping. It supports roster imports and numeric measurements tagged RENPHO, Blast, Rapsodo, Full Swing, Player Metrics, or a custom source. The separate RENPHO workflow reads the owner-supplied portrait Body Composition Analysis Report layout from PNG/JPG or a one-page PDF using local OCR, then requires review of the player, date, units and selected values. Other vendor-specific schemas are not assumed. Imported measurements appear on athlete profiles; absent measurements display **“No data yet.”** No performance statistics are fabricated.

The workspace uses a red, black, gray and white baseball theme with original graphics and responsive roster/profile views. It remains Trevor's independent project. An optional local `renpho_id` roster field and manually confirmed report IDs support exact saved-ID matching; new IDs require explicit player selection. Reports, extracted text and images stay in browser memory. Only approved normalized measurements and any explicitly remembered ID mapping are saved locally. See [Import Center](docs/IMPORTS.md) for supported fields, limits and review requirements.

Athlete profiles include interactive RENPHO charts: select a saved report for separate mass bars, percentage bars and other indicators, or select a measurement/unit to compare reports over time. A single report establishes a starting point; later imports fill in the history. Charts use only reviewed report readings saved in this browser. See [chart definitions](docs/RENPHO_CHARTS.md).

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
- [INVITATIONS](docs/INVITATIONS.md): sender setup, server-only provisioning, recipient password setup, partial outcomes, and rollout checks.
- [IMPORTS](docs/IMPORTS.md): file formats, mapping, athlete matching, review, backups, and limitations.
- [TESTING](docs/TESTING.md): reproducible checks and local Auth/API/UI tests.
- [VERIFICATION](docs/VERIFICATION.md): actual checks completed and remaining limitations.
- [HOSTED-SETUP](docs/HOSTED-SETUP.md): applied schema/Auth settings, owner/Admin account, and approved synthetic roster; password recovery and authenticated login/checks remain unresolved.
- [AGENTS](AGENTS.md): guardrails for future development.

The initial workspace contained only empty `work/` and `outputs/` folders, with no Git checkout. This source was created as a standalone project; no pre-existing repository was overwritten and no GitHub connection was assumed. To use an existing repository, review its contents first and copy these files into an appropriate branch.

## Deliberately deferred

Other vendor-specific automatic presets and report layouts, direct Google Sheets sync, shared cloud measurements, game/physical/sprint analytics, force plates, AI interpretation, and training recommendations remain deferred. CSV/TSV/XLSX exports work through explicit mapping. RENPHO support is limited to the supplied portrait layout and requires review; it is not a general document or health-analysis system.
