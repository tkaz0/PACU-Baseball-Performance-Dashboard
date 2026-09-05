# PACU Baseball Performance

Pacific Baseball's independent performance workspace provides private player profiles, team access for coaches, and administrator controls. It is a personal project by **Trevor Kazahaya**, not an official university application.

The home route opens the private workspace for authorized accounts and sign-in for visitors. The separate [browser workspace](https://pacubaseballperformance.com/preview) remains available without sign-in for fictional starter profiles, local imports and report review. Browser data becomes shared only through an administrator's explicitly approved numerical import.

Built with Next.js 16, React 19, TypeScript, Tailwind 4, Supabase Auth/PostgreSQL and Vercel. Consult [HOSTED-SETUP](docs/HOSTED-SETUP.md) for completed environment receipts.

## Start here

1. Follow [SETUP](docs/SETUP.md), install the pinned dependencies, and create `.env.local` from `.env.example`.
2. Apply the unapplied tracked migrations in order after inspecting the target database's history. Provision the first administrator deliberately; roster imports never create accounts.
3. Run `pnpm dev`. Private access uses the project's publishable key plus the signed-in user's session. `/preview` works without Supabase configuration.
4. Review the protected roster, import approved measurements at **Shared measurements**, and prepare players/coaches at **Team account preparation**.

## Available workflows

- **Admin:** roster and measurement imports, account configuration, coach preparation, and read-only **View as Coach/Player** with explicit athlete selection and **Exit preview**.
- **Coach:** team roster and shared profiles. **Player:** only the explicitly linked athlete. Live account status and PostgreSQL RLS enforce access.
- **Player profiles:** body, hitting and pitching cards with exact values/units, history and measured-team percentiles. Baseball uses **Fall 2026**; body measurements additionally preserve a separate summer baseline. Missing measurements stay empty. See [PLAYER_PROFILES](docs/PLAYER_PROFILES.md).
- **RENPHO review:** browser-local OCR for the supported portrait report layout, followed by explicit player/date/value/unit review. Existing mass bars, percentage bars and report history use approved numerical readings.
- **Shared measurements:** select a reviewed browser backup, inspect supported readings and exclusions, then approve uploading only whitelisted numerical observations and source provenance. Images, OCR text, report IDs and the full backup are not uploaded by this flow.
- **Team account preparation:** review player readiness and save coach names/contact emails. A prepared coach is not an Auth account and has received no invitation from this page.
- **Individual invitations:** implemented separately and disabled by default. Sending requires verified sender/templates, enabled server configuration and explicit recipient approval. The owner has said not yet to team emails; keep sending disabled and unsent until explicit approval.

The local Import Center reads explicitly mapped CSV, TSV and XLSX. Vendor names are source labels, not promises of unverified parser support. Supported RENPHO PNG/JPG and one-page PDF reading stays on the device. Direct Google Sheets-to-dashboard synchronization, additional vendor presets, force plates, AI interpretation and training recommendations remain deferred.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Run the development app |
| `pnpm lint` | Check code style |
| `pnpm typecheck` | Check TypeScript |
| `pnpm test` | Run unit, adapter and embedded PostgreSQL tests |
| `pnpm test:ui` | Run browser tests against a local app |
| `pnpm build` | Build for production |
| `pnpm start` | Serve a local production build |

On the owner's Mac, **Start PACU.command** starts the local app; keep its Terminal open while using it. It does not provision accounts or change the database.

## Project guide

- [SETUP](docs/SETUP.md): environments, migrations, account setup, sharing and deployment.
- [PLAYER_PROFILES](docs/PLAYER_PROFILES.md): metric definitions, periods, comparisons and import boundaries.
- [DATA_MODEL](docs/DATA_MODEL.md): identities, roles, measurements, provenance and database controls.
- [ACCESS_VIEWS](docs/ACCESS_VIEWS.md): real permissions and administrator display previews.
- [INVITATIONS](docs/INVITATIONS.md): coach preparation, approved sends, recipient setup and verification limits.
- [IMPORTS](docs/IMPORTS.md) and [RENPHO_CHARTS](docs/RENPHO_CHARTS.md): local file review and report charts.
- [TESTING](docs/TESTING.md), [VERIFICATION](docs/VERIFICATION.md), [HOSTED-SETUP](docs/HOSTED-SETUP.md): repeatable checks and historical receipts.
- [AGENTS](AGENTS.md): development boundaries and private-data handling.
