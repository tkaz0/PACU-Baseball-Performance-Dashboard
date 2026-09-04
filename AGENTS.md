<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# PACU project rules

This is Trevor Kazahaya's independently owned personal project for Pacific Baseball players and coaches. It is not an official university application. Preserve existing work and keep changes within the explicitly requested phase.

- Stack: Next.js App Router, TypeScript, Tailwind, Supabase Auth/PostgreSQL, Vercel. Use the lockfile and current official documentation.
- On September 4, 2026 the owner approved dashboard access without sign-in and then expanded scope to data importers. `/preview` serves a fictional starter roster and browser-local imports in IndexedDB. It never reads Supabase, creates a session, or grants roles. The home page leads to this workspace. No imported file contents go to the server.
- No public signup, demo account, anonymous database roster reads, authentication bypass for protected routes, first-login admin, or shared/default passwords. Real roster and administrative actions require existing Auth/RLS checks.
- Normal app access uses only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` plus the signed-in user's session. Never introduce a service-role/secret key for ordinary reads or writes.
- Authentication is separate from authorization. Check live trusted active status and database roles in every server entry point; enforce data access with RLS. Do not trust user metadata, email, UI switches, or client-supplied roles.
- Accounts and athlete identities remain separate. Only an explicitly authorized administrator/owner may set an account link. Roster emails never provision accounts or link them.
- Athlete UUID/code are permanent. Seasonal roster details live in `athlete_seasons`; performance measurements do not belong in roster fields.
- The protected Supabase roster importer accepts only its documented CSV template and matches permanent code. The browser-local Import Center accepts explicitly mapped CSV/TSV/XLSX; local roster rows may match a unique email or get a new local code. Preserve jersey `0`, merge only nonblank values, never delete omitted athletes, review all rows, and save atomically after a revision check. Measurement imports require explicit identity, dates, metrics, and units; retain source row/file provenance.
- Private SECURITY DEFINER functions must pin `search_path`, schema-qualify objects, revoke default execution, check current authorization, and keep consistent advisory-lock order. Keep the `private` schema out of exposed API schemas.
- No real roster data, production exports, credentials, access tokens, SQL dumps, or passwords in source, prompts, logs, screenshots, fixtures, or commits. Use only marked fictional `example.com` fixtures.
- Do not provision hosted accounts, modify hosted databases, send email, deploy, or change DNS without explicit user authorization for that action. Local checks are permitted.
- The owner expanded Phase 1 to the browser-local Import Center. Vendor labels are source tags, not unverified vendor parsers. Do not invent vendor schemas or units. PDF extraction, direct Google Sheets sync, cloud measurement storage, force plates, AI interpretation, and training advice remain outside this implementation.
- Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` after substantive changes. Browser suite: `pnpm test:ui`. Report skipped integration tests honestly; PGlite is not the full Supabase Auth/API stack.
- Keep README and `docs/SETUP.md`, `docs/DATA_MODEL.md`, `docs/TESTING.md` aligned with code.
