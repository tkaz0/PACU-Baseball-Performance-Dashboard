# PAC athlete IDs

The owner-approved format is `PAC-0001`, `PAC-0002`, and onward. The September 2026 change replaces `LOCAL-` with `PAC-` while preserving the exact existing number. Names, jersey numbers, row order and seasons never determine a new number. Fictional `SYN-` records remain separate.

The internal database athlete UUID remains unchanged. Account links, seasons, performance observations, original observation IDs and import receipts continue to reference that UUID. Previous codes live in a private alias table; they cannot be assigned to another athlete or queried through the ordinary client.

## Applying the reviewed change

Install `202609060005_pac_athlete_codes.sql` after the preceding migrations. Installation adds safeguards and import compatibility; it changes no athlete codes.

An active administrator can call `admin_rename_athlete_codes(p_mapping, p_reviewed)` through the ordinary signed-in client. `p_reviewed` must be true. Each mapping contains exactly `athlete_id` (the existing UUID), `old_code`, and `new_code`. The RPC accepts 1–1,000 mappings and only the exact `LOCAL-NNNN` to `PAC-NNNN` prefix change. Validate the complete expected roster snapshot before submitting a mapping. Do not derive UUIDs from names or email.

The RPC acquires the shared account and roster locks, checks current active Admin authorization, validates every mapping and collision, then saves codes, aliases and audit entries atomically. It returns `changed` and `unchanged` counts. An identical retry changes nothing; a stale or conflicting mapping fails the entire transaction. Existing reviewed roster drafts become stale and must be previewed again.

For the initial owner roster, the separately prepared private mapping artifact records the approved 34 code pairs and backup hash, without personal details. Bind those exact old codes to current UUIDs in the same database transaction; require 34 matches and no target-code conflicts. Do not renumber sample records or include additional rows discovered later without review. Verify unchanged account links, season count, measurement count, values and provenance after applying.

## Imports and backups

Shared roster and performance imports resolve an exact recorded previous code before their existing validation, conflict, duplicate and review checks. A file containing both an old code and its PAC code cannot create two athletes. A previously saved measurement imported through either code remains the same observation. An unknown old code cannot create a new roster identity.

Roster corrections remain possible: a matching email supports a name correction, and matching names support an email correction. Changing both to a different identity on an occupied PAC ID fails review. This protects against two independently prepared workspaces reusing a PAC number. Administrators still review every proposed change.

Browser workspaces migrate roster IDs, seasonal references and measurement athlete codes together in one IndexedDB transaction, increasing the revision so stale tabs cannot overwrite it. JSON backups retain `athlete_code_aliases`; aliases must be valid, unique across the roster, and separate from every current code. Restore of an older JSON backup uses the same deterministic migration. Old local profile links and Player preview selections resolve only recorded aliases. The shared-measurement file chooser also normalizes an old JSON backup before matching the hosted roster.

New code-less athletes receive the next PAC number above all current, previous and proposed IDs in the reviewed master roster. Numbers are not recycled to fill gaps. This is a sequence within that master workspace, not a coordinated allocation across offline devices; shared collisions fail review. Preserve the master JSON backup with aliases. A CSV contains only the current canonical ID, so an old CSV with unknown `LOCAL-` IDs must be matched against its original restored JSON roster rather than treated as a new roster.

## Validation

`tests/athlete-code-database.test.ts` runs the real migrations in fictional PGlite fixtures. It verifies current Admin/review guards, exact UUID binding, atomic collision/audit-failure rollback, unchanged links/seasons/performance, alias privacy and namespace reuse protection, repeat safety, stale previews, corrections and old/new import equivalence.

`tests/athlete-codes.test.ts` verifies deterministic local migration, preserved measurement provenance and zero values, alias collisions, monotonic allocation, old profile/view links, roster/measurement reimports and preparation of old backups for sharing. These tests do not claim a hosted migration or a full Supabase Auth/PostgREST session test.
