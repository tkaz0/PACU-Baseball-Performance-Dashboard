# Phase 1 data model

## Identities and ownership

An athlete is a baseball identity, not a login account. Its internal UUID and permanent, unique `athlete_code` survive name, jersey, season, and contact changes. The application never matches identities by name or jersey. It never links an account from CSV email or editable Auth email/user metadata.

| Table | Purpose | Key / important constraints |
| --- | --- | --- |
| `auth.users` | Supabase-managed authentication credentials and sessions | Auth UUID; managed separately by the owner |
| `app_accounts` | Trusted application enable/disable status | Auth UUID FK; inactive by default |
| `account_roles` | Multiple roles per account | `(user_id, role)`; `admin`, `coach`, `player` |
| `account_athletes` | Administrator-approved identity link | One athlete per account and one account per athlete; linked actor/time |
| `athletes` | Permanent identity plus name, contact, photo URL | Generated UUID; unique immutable-in-app athlete code; unique lowercase nonblank email |
| `athlete_seasons` | Roster information for a season | `(athlete_id, season)`; jersey `0` valid; optional values NULL |
| `roster_imports` | Staged source rows, authoritative preview and application status | Draft UUID, season, source SHA-256, actor, timestamps |
| `audit_events` | Append-only application audit | Actor, event, target/import UUID, before/after or summary, timestamp |

Application users cannot directly write or delete these tables. PostgreSQL owner access remains privileged and must be used deliberately. No views bypass RLS. Foreign keys prevent silently deleting accounts/athletes with history. No automatic Auth trigger provisions application accounts.

```mermaid
erDiagram
    AUTH_USERS ||--o| APP_ACCOUNTS : "explicitly provisioned"
    APP_ACCOUNTS ||--o{ ACCOUNT_ROLES : has
    APP_ACCOUNTS ||--o| ACCOUNT_ATHLETES : "trusted link"
    ATHLETES ||--o| ACCOUNT_ATHLETES : linked
    ATHLETES ||--o{ ATHLETE_SEASONS : "season roster"
    AUTH_USERS ||--o{ ROSTER_IMPORTS : stages
    ROSTER_IMPORTS ||--o{ AUDIT_EVENTS : records
```

## Authorization

All public application tables have RLS enabled, anonymous grants revoked, and no direct write grants/policies for authenticated users. Read policies require **current trusted active status**. Private functions avoid recursive RLS lookups, pin `search_path=''`, fully qualify tables, and have default PUBLIC execution revoked. Only the necessary helpers can execute for authenticated users. The `private` schema is not exposed by the Data API.

| Identity | Athlete/season reads | Import preview/history/audit | Account administration |
| --- | --- | --- | --- |
| Anonymous | Denied | Denied | Denied |
| Unconfigured, role-free or disabled account | No athlete rows | Denied | Denied |
| Player, no trusted athlete link | No athlete rows | Denied | Denied |
| Active Player | Only linked athlete and its seasons | Denied | Denied |
| Active Coach | Entire roster and profiles | Denied | Denied |
| Active Admin | Entire roster and profiles | Allowed; only uploader approves its draft | Allowed for other accounts, with explicit approval/audit |
| Active Admin + Player | Union of roles: administrative access plus own link | Admin access | Admin access |

An account's roles and status are queried live, not copied into editable metadata or trusted solely from a JWT. A disabled account loses database access on subsequent statements even when it still has a valid access token. Data already displayed or a request already completed cannot be recalled. All server pages/actions/API routes also verify authenticated identity and live access. Protected responses are private/no-store; no shared data cache is used.

Normal app reads and RPC calls use the public publishable key and the signed-in user's session. The narrow administrative RPCs are SECURITY INVOKER wrappers around private definer functions that explicitly check current active-admin status. These database operations require no privileged app key and intentionally perform only the allowed audited writes. Optional Auth user invitations use a separate server-only secret for Auth directory lookup and email invitations, never for application table access.

Account mutations and approvals acquire the account advisory lock first, then the roster lock if needed, and authorize after waiting. No administrator may modify its own account through the app. This avoids self-lockout and ensures another active administrator remains when one is disabled/demoted. Owner scripts use explicitly chosen Auth UUIDs and audit their changes.

## Invited account provisioning

The third migration, `202609050003_invited_account_provisioning.sql`, adds `public.admin_provision_invited_account(target_user uuid, account_role text, linked_athlete uuid)`, returning `void`. It creates no tables, Auth users or emails. Its private definer function pins an empty search path, shares advisory lock `72104001` with the existing account writer, and performs all checks after acquiring the lock:

- The caller must currently be an active administrator. Coach, Player, unconfigured, role-free and disabled callers are denied.
- The target must have no `app_accounts` row. Existing active, disabled and role-free accounts are all preserved; invitation provisioning cannot replace their roles or links.
- The role must be exactly `coach` or `player`. Player requires an explicit existing athlete link; Coach requires a null link. The invitation path cannot create an administrator or combine roles.
- The existing `private.configure_account` function validates Auth user existence, athlete existence/unique ownership and self-modification, then atomically saves active status, the single role, optional link and one `account_configured` audit event.

The new RPC rejects existing accounts with SQLSTATE `23505`, invalid role/link/null-target inputs with `22023`, and unauthorized callers with `42501`. Other existing configuration constraints retain their existing errors. A failure anywhere in the database operation rolls back all account/role/link/audit writes. Default PUBLIC and anonymous execution are revoked; only authenticated callers can reach the checked wrapper. This does not grant direct table writes or expose the private schema.

`lib/supabase/auth-admin.ts` is a separate server-only module. With both `PACU_INVITATIONS_ENABLED=true` and `SUPABASE_AUTH_ADMIN_SECRET` configured, it exposes only Supabase's Auth administrator interface. The invitation action uses `listUsers` to reject existing email accounts and `inviteUserByEmail` for one reviewed recipient. The directory stays on the server. The actual returned Auth UUID and explicitly selected athlete are then passed to the provisioning RPC using the freshly checked administrator's **ordinary session**. No roster email, user metadata or recipient-supplied athlete claim creates authorization.

Email delivery and database provisioning are separate operations, not one transaction. A rejected or incomplete directory scan sends nothing. An uncertain provider result is reported without an automatic retry. If an invitation is sent but provisioning is unconfirmed, the administrator must inspect the Auth user and review existing access; the application does not automatically resend, delete users or overwrite an existing account. The shared database lock protects the final absence and link checks when another administrator acts during delivery.

Invitation acceptance is a separate public authentication flow: a GET only displays a confirmation; explicit POST verifies the token as `invite` or `recovery`, then opens a fixed password destination. It does not grant application roles. Private display-preview restrictions remain enforced in the app before invitation sends; the database continues to authorize the real actor. Browser-local data is not uploaded, shared or migrated by creating accounts. Sending stays disabled until the migration, SMTP, templates and recipient flow have been verified. See [INVITATIONS](INVITATIONS.md).

## Master roster CSV contract

Encoding: UTF-8, comma-delimited, with the following **exact 16 headers in this order**. Quoted commas and escaped quotes are supported. Keep one athlete per physical line; interior blank lines and multiline cells are rejected so displayed CSV row numbers are reliable. A trailing newline and UTF-8 BOM are accepted.

```csv
athlete_code,first_name,preferred_name,last_name,pacific_email,jersey_number,primary_position,secondary_position,player_type,bats,throws,academic_class,eligibility_year,graduation_year,roster_status,profile_photo_url
```

| Field | Location | Accepted value |
| --- | --- | --- |
| `athlete_code` | Identity | Required; 3–40 uppercase letters/digits/underscore/hyphen, starting with a letter/digit; trimmed and uppercased by CSV parser |
| `first_name`, `last_name` | Identity | Required on every row; 1–80 characters |
| `preferred_name` | Identity | Optional; up to 80 characters |
| `pacific_email` | Identity | Optional; lowercase normalized valid email, up to 254 characters; globally unique among athletes |
| `jersey_number` | Season | Optional integer `0`–`99`; never used for identity matching |
| `primary_position`, `secondary_position` | Season | Optional: `P`, `C`, `1B`, `2B`, `3B`, `SS`, `LF`, `CF`, `RF`, `OF`, `IF`, `DH`, `UT` |
| `player_type` | Season | Optional: `pitcher`, `position`, `two_way` |
| `bats`, `throws` | Season | Optional: `L`, `R`, `S` (switch/both) |
| `academic_class` | Season | Optional: `freshman`, `sophomore`, `junior`, `senior`, `graduate` |
| `eligibility_year` | Season | Optional integer `1`–`6`; a roster label, not an eligibility determination |
| `graduation_year` | Season | Optional integer `2000`–`2100` |
| `roster_status` | Season | Optional: `active`, `inactive`, `redshirt`, `alumni` |
| `profile_photo_url` | Identity | Optional HTTPS URL on a DNS hostname; up to 2,048 characters; no credentials/port/control characters. Stored for later display; this phase uses initials and does not fetch it. |

All fields reject control characters; other categorical tokens are case-sensitive as listed. These are this project's explicit roster conventions, not inferred vendor fields. Missing optional data stays NULL/blank; the UI represents empty roster cells with an em dash. No measurements, body composition, velocity, force-plate, sprint, or performance values belong in these tables.

The selected season is outside the CSV, entered by the administrator as `YYYY` or `YYYY-YY`. Jersey/position/class/status and bats/throws are snapshots for that season. Identity/name/contact changes apply to the same permanent athlete across seasons, and the preview shows those changes.

## Import lifecycle and guarantees

1. **Upload:** only an active Admin can submit. Server Action verifies Auth and trusted role, extension, nonempty UTF-8 file, 1 MiB raw limit, header order, exactly 16 cells, and 1–500 rows. The source-byte SHA-256 is provenance only; it is not a permanent uniqueness rule.
2. **Stage:** SQL independently validates the JSON shape, exact allowed keys, text cells, value ranges, and conflicts. It caps expanded JSON at 3 MiB to allow CSV-to-JSON expansion. Invalid records get `reject` and explanations. Duplicate normalized codes flag all duplicates; duplicate nonblank incoming emails and emails already owned by a different code are rejected. Simultaneous email swaps must be resolved explicitly; the importer does not infer them.
3. **Preview:** persisted by the database with uploader, season, source rows, before/after values, and `create`, `update`, `unchanged`, `reject` counts. A new season on an existing athlete is an update. Preview is displayed from this trusted draft, never from client-provided status/diffs.
4. **Approve:** the server accepts only draft UUID plus a confirmation. SQL locks and verifies active admin/uploader, draft state and 24-hour expiry, then recomputes the full preview. If anything relevant changed, the batch is rejected as stale. Every rejected row blocks the entire batch.
5. **Apply:** one database RPC/transaction upserts by permanent code and athlete+season, logs row changes and batch summary, and marks the draft applied. Any row or audit failure rolls everything back. Re-approving an applied draft returns its prior summary without writing again. Re-importing an unchanged CSV produces unchanged rows.

Blank optional input never overwrites an existing populated value; explicit clearing is not part of this CSV workflow. Omitted athletes are never deleted or deactivated. Uploading a new code creates a new identity, so administrators must preserve assigned codes. Unchanged rows are not rewritten. No import creates Auth users, roles, account links, or invitations, including when the CSV email changes.

Audit records contain sensitive roster details once real data is introduced. Only active administrators can read them, and application users cannot edit/delete them. Retention/purge procedures are owner operations to define before collecting real data; this phase implements no automatic purge or raw-file storage.

## Long-term import architecture — design only

Future sources will use the master roster as the identity registry:

- Additional RENPHO formats and shared persistence (the supported portrait reader below is browser-local)
- Blast exports
- Rapsodo hitting and pitching exports
- Full Swing exports
- Game statistics maintained in Google Sheets
- Physical/sprint testing maintained in Google Sheets
- Force-plate exports when equipment is available

Before implementation, obtain actual source files, export versions, field definitions, units, time conventions, ownership/access requirements, and representative edge cases. Do not invent parser schemas or connect services based on product names.

The intended future flow is **source receipt → versioned source-specific adapter → validation → explicit identity resolution → human preview/approval → transactional domain records with provenance → authorized reporting**. Unknown or ambiguous athlete references are queued for administrator resolution, never fuzzy-linked from name/email/jersey. Future import jobs should record source fingerprint, adapter version, units/time provenance, errors, approval, and idempotency rules. Measurements belong in separate time-stamped domain tables tied to athlete UUIDs, not in roster identity or seasonal membership.

This shared-domain architecture is a roadmap only. The browser-local RENPHO reader described below does not add Supabase tables or implement a shared import pipeline. Google Sheets connectors, analytics calculations, force-plate schemas, AI interpretation and training recommendations remain outside this implementation.

## Browser-local import workspace (September 4 scope expansion)

`lib/local-workspace.ts` defines a versioned IndexedDB record containing roster, measurements, batch history, mode, and a revision number. It is separate from every Supabase table and requires no migration. Roster identities use permanent local athlete codes; measurement records preserve date-only ISO dates, explicit metric/unit/value/source, source file/sheet/row/hash, and batch ownership. Writes compare the saved revision within the same transaction. Restores validate the complete graph before saving. No browser import creates an Auth account or trusted database role. See [IMPORTS.md](IMPORTS.md).

### RENPHO reports and local identifiers

Local roster records may carry an optional canonical `renpho_id` and `renpho_ids` containing manually confirmed report IDs. Both use trimmed uppercase exact identifiers, 1–80 letters/digits/underscores/hyphens. Identifiers must be unique across the roster; ambiguous ownership blocks import/restore. These are external device/report identifiers, not permanent athlete codes or Auth UUIDs. A new or unknown report ID requires explicit player selection. The app never derives identity from name, identifier prefixes or date fragments.

The local roster template extends the 16 snake_case roster fields with optional `renpho_id`; the protected CSV/SQL contract above remains exactly 16 fields. Roster imports never clear a saved identifier merely because an incoming cell is blank. A remembered report ID is stored with its explicitly selected athlete during the same revision-checked IndexedDB transaction as the approved measurement batch. Invalid IDs, conflicting ownership, measurement errors or stale revisions prevent that combined save.

The portrait RENPHO adapter consumes disjoint OCR regions. It reads seven composition measurements using the isolated `Measurement(lb)`/`Measurement(kg)` header, two assessment values and seven Other Indicators. It ignores optimal ranges, classification text, scores, targets and segmental charts. Title, explicit report ID, explicit English-month Test Date and seven exact composition labels gate recognized-layout unit conventions. Only in that recognized layout, SMI's exact numeric reading plus `kg/m` can produce a proposed `kg/m²` candidate with immutable `unitNeedsConfirmation`; the preview requires its canonical key in explicit `confirmedUnits` or the reading must be excluded. An isolated Fat-Free Mass `Ib`/whitespace-separated `1b` suffix can be corrected to `lb`, tagged `ocr-unit-correction` and retained verbatim in source evidence. Neither path changes numeric digits, and the generic text parser remains strict. Calendar validation supports full English month names and their three-letter abbreviations; time is validated then omitted from the stored date-only value. Report IDs never supply dates.

Candidate metadata includes canonical metric key/fixed column, page/source line, unit evidence and extracted source text for temporary review. Only approved normalized `Measurement` objects are persisted. They use source `RENPHO`, sheet `RENPHO report · Page N`, original source line and fixed metric column in the existing hash/sheet/row/column observation identity. Deselecting/reordering metrics does not renumber observations. A RENPHO-only reconciliation check also compares exact file hash/page/fixed column when OCR line grouping changes: identical semantics are unchanged, conflicts are rejected, and saved provenance is never rewritten. Changed athlete/date/unit/value semantics for an existing observation require removing its earlier batch. A different file hash can still represent the same real-world test and needs review.

Images, PDF contents, OCR text and unconfirmed ID evidence remain in memory, without server uploads or backup serialization. Backups do include approved readings, source filenames and explicitly saved IDs. Parsing is not a health interpretation, and recognized layout does not certify OCR accuracy. Every import requires visual review and confirmation.

### RENPHO chart projections

Charts are read-only projections of existing browser measurements; they add no persisted fields or migration. Grouping requires the selected athlete code, source `RENPHO`, reviewed-report page provenance, file hash and test date. Distinct files on one date stay distinct, and missing values never backfill from a different report. Only unambiguous supported metric/unit pairs with finite, nonnegative values are charted; percentages also require 0–100. Excluded rows remain in the original history and backup. Units are never converted, and overlapping mass/percentage measurements are never summed. See [RENPHO_CHARTS.md](RENPHO_CHARTS.md) for chart and scale definitions.

### Access views (September 5 scope expansion)

No new tables or role grants are added. Protected display previews require an existing active administrator on each request. The actor-bound, HTTP-only, same-site session cookie selects Coach or an explicitly verified athlete for Player and carries a server-checked four-hour expiry. It can only reduce the displayed access. The real Auth identity and database roles stay unchanged; RLS continues to constrain that identity. Because admin RLS is broader than a player preview, every profile/API entry and overview query additionally applies the effective athlete restriction before returning data. All roster/account server mutations require actual admin access with no active preview.

The separate browser-local `sessionStorage` preference stores only role and optional local athlete code; it is not part of the IndexedDB workspace or JSON backup and is not authorization. Its player data projection includes only the selected athlete and readings. The owner's preview menu can still choose another player. Coach/player views hide imports, backups and account controls; local write/export handlers also reject calls while previewing. Existing measurements and permanent codes are never rewritten by switching views.
