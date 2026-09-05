# PACU access levels and View as

The owner requested Admin controls with the ability to inspect Coach and Player perspectives, using NW Baseball Stats as the UI reference. The observed pattern was a View as menu, current-view indicator, a visible preview banner, and Exit preview. PACU uses these interactions with its existing roles; no NWBB account or subscription state is changed.

| Capability | Admin | Coach | Player |
| --- | --- | --- | --- |
| Team roster and profiles | All | All | Own linked athlete |
| Shared performance cards/charts | Team | Team | Own linked athlete |
| Import or change records | Yes | No | No |
| Backup/export browser workspace | Yes | No | No |
| Configure trusted accounts | Yes, after private sign-in | No | No |
| View as another role | Admin inspection | No | No |

## Two separate surfaces

`/preview` is the existing unsigned browser-local workspace. Its View as is explicitly a layout preview, accessible without account authentication. The owner's inspection controls remain visible so they can choose another player or exit. Actual roster and RENPHO readings remain in that browser; the deployed source still uses fictional starter data. Switching views neither uploads nor changes saved data.

`/overview`, `/roster`, `/athletes`, and `/admin` are the private Supabase workspace. Existing Auth and RLS enforce roles. Only a live active administrator can start its Coach/Player preview. The selected athlete must exist. A preview never changes trusted account roles, account links, Auth sessions or JWT claims. Protected overview/profile/API paths and performance adapters scope output using the effective view; roster, account, shared-measurement and coach-preparation mutations reject while previewing. Malformed, mismatched, stale or expired preferences stop on a recovery page with Exit preview.

Shared measurement storage and the approved import workflow are now implemented for private profiles. Signing in or switching View as never uploads browser data: an Admin must separately review and approve Shared measurements. That workflow uploads numerical observations and provenance only. See [PLAYER_PROFILES](PLAYER_PROFILES.md).

## Shared metrics and account preparation

Private Players see their own reviewed measurements and permitted aggregate comparisons; Coaches/Admins see team profiles. Percentiles use the fixed measured cohort and require at least five comparable athletes. The player-facing summary contains no raw peer measurements and accepts no arbitrary thresholds.

Admin-only **Team account preparation** saves coach contacts and displays roster/account readiness. It does not create login accounts, grant roles or send emails. Invitations require their separate approved send workflow.

## Account management

An administrator can search configured accounts by exact UUID, linked athlete/name/code, role or status, then select one to prefill its settings. Configure existing user retains the explicit Auth UUID workflow. Roles, active status and athlete link are replaced atomically by the existing audited RPC after explicit confirmation. Any form edit clears confirmation. Own-account edits remain blocked; no profile is claimed based on email or user metadata. An unlinked Player account cannot view an athlete.

## Verification

Unit and route tests cover role projections, malformed/expired/other-actor preferences, forbidden mutations, API isolation and direct route checks. Fictional browser tests cover Coach/Player transitions, reload persistence, direct-route restrictions, read-only controls, mobile fit and unchanged backups after Exit preview. The existing database authorization suite remains applicable. Separate live Supabase test identities are still required for full Auth/API integration testing.
