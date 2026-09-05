# Browser workspace and access boundary

On September 4, 2026 the owner requested dashboard access without signing in, deferred password setup, and expanded the scope to data importers. The home page opens `/preview`; its roster, profiles, and Import Center are available without an account.

The starter roster comes exclusively from `fixtures/preview-roster.json`, checked for exact equality with the approved fictional CSV. The adapter rejects external photos, real names, and non-example.com emails in this fixture. Never copy real roster data into the repository or deployed assets.

User-selected CSV/TSV/XLSX data is parsed in the browser, reviewed, then saved in IndexedDB on that origin. No upload endpoint, Supabase request, account, session, or role is created. A different browser or origin has its own workspace. The browser workspace is not team-shared cloud storage. It requires JavaScript and browser site storage. Export/restore JSON backups provide owner-controlled transfer. Anyone using that browser profile can open its saved data while sign-in is paused.

The protected `/overview`, `/roster`, `/athletes`, `/admin`, private athlete API, server actions, and Supabase RLS continue to enforce authenticated active roles. Public browsing cannot authorize those endpoints. Profile URL IDs in the browser workspace are local athlete codes, separate from protected database UUIDs. Unknown local IDs return a public page shell and display “Profile unavailable” after storage hydration because the server cannot know a browser's roster.

Dynamic workspace responses disable caching. `/preview` does not refresh a Supabase session and works independently of Auth availability. Source imports contain no server modules or privileged keys. IndexedDB saves compare revisions atomically so another tab cannot silently overwrite a reviewed import. State changes only after transaction completion; failures preserve the prior workspace.

Run `pnpm check` and local browser tests before publishing changes. No custom-domain DNS change or password reset is needed to use this workspace. See [IMPORTS.md](IMPORTS.md) for supported formats and limitations.

## Role layout previews

The owner can use **View as** to inspect Coach or Player layouts and **Exit preview** to restore the full Admin layout. **Access & views** explains each role and links to private sign-in for real account management. Coach view includes team data but no import/backup/account controls. Player view includes the explicitly selected local athlete and their own readings; direct team, other-athlete, import and access routes show a restricted-view message. The owner-only inspection menu remains outside the role-specific content so another player can be chosen. These are display previews available to anyone using this unsigned browser workspace, not secured identities.

The per-tab session preference survives reload when browser session storage is available. Missing player selections show no athlete data. Exports and revision-checked local writes reject while previewing. Switching views never changes the IndexedDB record and creates no accounts, cookies for Auth, links, or roles. Actual account access and admin preview enforcement are documented in [ACCESS_VIEWS.md](ACCESS_VIEWS.md).
