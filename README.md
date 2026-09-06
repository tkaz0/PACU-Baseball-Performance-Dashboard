# PACU Baseball Performance

Pacific Baseball's independent performance workspace provides private player profiles, team access for coaches, and administrator controls. It is a personal project by **Trevor Kazahaya**, not an official university application.

The home route opens the private workspace for authorized accounts and the Pacific Baseball sign-in page for visitors. Every dashboard requires login. [Information Imports](https://pacubaseballperformance.com/imports) gives active Admins and Coaches four labeled upload areas that save reviewed readings directly to private profiles. The advanced browser workspace remains local until readings are explicitly shared. Both import workflows are unavailable during private Coach/Player View as.

Built with Next.js 16, React 19, TypeScript, Tailwind 4, Supabase Auth/PostgreSQL and Vercel. Consult [HOSTED-SETUP](docs/HOSTED-SETUP.md) for completed environment receipts.

## Start here

1. Follow [SETUP](docs/SETUP.md), install the pinned dependencies, and create `.env.local` from `.env.example`.
2. Apply the unapplied tracked migrations in order after inspecting the target database's history. Provision the first administrator deliberately; roster imports never create accounts.
3. Run `pnpm dev`. Access uses the project's publishable key plus the signed-in user's session. `/preview` also requires Supabase configuration and an active Admin or Coach; there is no public or development authentication bypass.
4. Review the protected roster, add approved readings at **Information Imports**, choose **Light / Dark / System** in Settings, and prepare players/coaches at **Team account preparation**.

## Available workflows

- **Admin:** roster and measurement imports, account configuration, coach preparation, and read-only **View as Coach/Player** with explicit athlete selection and **Exit preview**.
- **Coach:** team roster, shared profiles and performance imports. **Player:** the explicitly linked profile plus the owner-authorized team leaderboard. Live account status and PostgreSQL RLS enforce access.
- **Appearance:** Light, Dark or System, saved in the current browser; System follows device appearance. Every account can change it in Settings or the header.
- **Player profiles:** Physicality, Hitting and Throwing tabs with main values/units and actual Last Tested dates, plus secondary RENPHO, Games and history views. Baseball uses **Fall 2026**; body measurements retain their actual testing dates and separate comparison periods. Height displays in feet and inches; untested measurements show a simple placeholder. See [PLAYER_PROFILES](docs/PLAYER_PROFILES.md).
- **Leaderboards:** all active signed-in players and staff can compare the eligible current team's latest reviewed testing results by Physicality, Hitting and Throwing. Rankings appear automatically as compact stat cards, with category navigation and no filter form. Metric, source, unit and testing period stay separate; normal peer profile/history access remains restricted. See [LEADERBOARDS](docs/LEADERBOARDS.md).
- **Staff search:** names and PAC IDs suggest matching player profiles while typing in the header or roster search. Ordinary roster tables omit status while retaining stored eligibility.
- **Information Imports:** Physicality (RENPHO), Hitting (Full Swing CSV), Pitching (Full Swing CSV), and Games / Intrasquad (Full Swing CSV). Live roster matching and explicit review precede sharing. Full Swing currently supports manually mapped session summaries; an actual export is still needed to validate automatic parsing of raw swing/pitch logs.
- **RENPHO review:** browser-local OCR for the supported portrait report layout, followed by explicit player/date/value/unit review and direct profile saving. Existing mass bars, percentage bars and report history use approved numerical readings.
- **Shared measurements:** select a reviewed browser backup, inspect supported readings and exclusions, then approve uploading only whitelisted numerical observations and source provenance. Images, OCR text, report IDs and the full backup are not uploaded by this flow.
- **Team account preparation:** review player readiness and save coach names/contact emails. A prepared coach is not an Auth account and has received no invitation from this page.
- **Individual invitations:** implemented separately and disabled by default. Sending requires verified sender/templates, enabled server configuration and explicit recipient approval. The owner has said not yet to team emails; keep sending disabled and unsent until explicit approval.

The advanced local Import Center reads explicitly mapped CSV, TSV and XLSX. Vendor names are source labels, not promises of unverified parser support. Supported RENPHO PNG/JPG and one-page PDF reading stays on the device. The Fall 2026 game-sheet workflow is documented in [GAME_STATS](docs/GAME_STATS.md). Additional unverified vendor layouts, force plates, AI interpretation and training recommendations remain deferred.

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
- [INFORMATION_IMPORTS](docs/INFORMATION_IMPORTS.md), [GAME_STATS](docs/GAME_STATS.md) and [APPEARANCE](docs/APPEARANCE.md): current upload, source-update and appearance workflows.
- [PLAYER_PROFILES](docs/PLAYER_PROFILES.md) and [LEADERBOARDS](docs/LEADERBOARDS.md): profile tabs, metric definitions, periods, comparisons and read boundaries.
- [BRANDING](docs/BRANDING.md): official asset sources and presentation rules.
- [ATHLETE_IDS](docs/ATHLETE_IDS.md): stable PAC IDs, old-import compatibility and reviewed migration.
- [DATA_MODEL](docs/DATA_MODEL.md): identities, roles, measurements, provenance and database controls.
- [ACCESS_VIEWS](docs/ACCESS_VIEWS.md): real permissions and administrator display previews.
- [INVITATIONS](docs/INVITATIONS.md): coach preparation, approved sends, recipient setup and verification limits.
- [IMPORTS](docs/IMPORTS.md) and [RENPHO_CHARTS](docs/RENPHO_CHARTS.md): local file review and report charts.
- [TESTING](docs/TESTING.md), [VERIFICATION](docs/VERIFICATION.md), [HOSTED-SETUP](docs/HOSTED-SETUP.md): repeatable checks and historical receipts.
- [AGENTS](AGENTS.md): development boundaries and private-data handling.
