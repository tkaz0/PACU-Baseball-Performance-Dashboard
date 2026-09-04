<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# PACU project rules

This is Trevor Kazahaya's independently owned personal project for Pacific Baseball players and coaches. It is not an official university application. Preserve existing work and keep changes within the explicitly requested phase.

- Stack: Next.js App Router, TypeScript, Tailwind, Supabase Auth/PostgreSQL, Vercel. Use the lockfile and current official documentation.
- No public signup, demo login, anonymous roster reads, auth bypass, first-login admin, or shared/default passwords.
- Normal app access uses only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` plus the signed-in user's session. Never introduce a service-role/secret key for ordinary reads or writes.
- Authentication is separate from authorization. Check live trusted active status and database roles in every server entry point; enforce data access with RLS. Do not trust user metadata, email, UI switches, or client-supplied roles.
- Accounts and athlete identities remain separate. Only an explicitly authorized administrator/owner may set an account link. Roster emails never provision accounts or link them.
- Athlete UUID/code are permanent. Seasonal roster details live in `athlete_seasons`; performance measurements do not belong in roster fields.
- Import only the documented CSV template. Preserve jersey `0`, merge only nonblank values, match by code, never delete omitted athletes, stage authoritative previews, recheck stale drafts, and apply changes/audit transactionally.
- Private SECURITY DEFINER functions must pin `search_path`, schema-qualify objects, revoke default execution, check current authorization, and keep consistent advisory-lock order. Keep the `private` schema out of exposed API schemas.
- No real roster data, production exports, credentials, access tokens, SQL dumps, or passwords in source, prompts, logs, screenshots, fixtures, or commits. Use only marked fictional `example.com` fixtures.
- Do not provision hosted accounts, modify hosted databases, send email, deploy, or change DNS without explicit user authorization for that action. Local checks are permitted.
- Stop after Phase 1. Do not implement vendor parsers, PDF/RENPHO processing, Google Sheets connections, analytics, force plates, AI interpretation, or training advice.
- Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` after substantive changes. Browser suite: `pnpm test:ui`. Report skipped integration tests honestly; PGlite is not the full Supabase Auth/API stack.
- Keep README and `docs/SETUP.md`, `docs/DATA_MODEL.md`, `docs/TESTING.md` aligned with code.
