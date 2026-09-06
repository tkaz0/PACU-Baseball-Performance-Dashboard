# PACU access levels and View as

The owner requested Admin controls with the ability to inspect Coach and Player perspectives, using NW Baseball Stats as the UI reference. The observed pattern was a View as menu, current-view indicator, a visible preview banner, and Exit preview. PACU uses these interactions with its existing roles; no NWBB account or subscription state is changed.

| Capability | Admin | Coach | Player |
| --- | --- | --- | --- |
| Team roster and profiles | All | All | Own linked athlete |
| Shared performance cards/charts | Team | Team | Own linked athlete |
| Import reviewed performance information | Yes | Yes | No |
| Manage rosters and permanent IDs | Yes | No | No |
| Backup/export browser workspace | Yes | No | No |
| Configure trusted accounts | Yes | No | No |
| View as another role | Admin inspection | No | No |

## Two separate surfaces

Every dashboard surface requires sign-in. `/preview` is the browser-local import workspace and requires a currently active Admin or Coach; interactive Coach View as is allowed and Player View as is denied. Its layout and every page perform the trusted server check; the proxy no longer skips authentication for this path. Before mounting IndexedDB, a client boundary checks current authorization with a private no-store endpoint, bound to the exact user, actual staff role and path. It rechecks on navigation, focus, page restoration and visible-page intervals, and removes local content when access is denied or cannot be verified. A Player, inactive or unconfigured account cannot open this workspace. Actual Coaches get performance import controls; roster, identity, account, backup, restore and reset controls remain Admin-only.

The browser workspace still offers Admin inspection of local Coach/Player layouts. Switching views neither grants account access nor changes saved data. Coach view can then review and save performance imports; Player view stays read-only. Local roster and RENPHO readings stay on that device; login gating does not encrypt or erase IndexedDB or previously exported backups. A previously open page is revalidated when revisited or during the periodic check, rather than remotely retracting data already held by that browser. An Admin using the Coach layout can import performance measurements with Coach-level controls. Roster, backup and account management stay unavailable. This uses the existing account and does not stand in for onboarding a separate Coach login. Local imports require a working connection for authorization, although report processing itself stays on the device.

`/overview`, `/roster`, `/athletes`, `/imports`, and `/admin` are the private Supabase workspace. Existing Auth and RLS enforce roles. Only a live active administrator can start its Coach/Player preview. The selected athlete must exist. A preview never changes trusted account roles, account links, Auth sessions or JWT claims. Protected overview/profile/API paths and performance adapters scope output using the effective view; roster, account and coach-preparation mutations reject in both selected views. Coach view allows reviewed performance imports and game-stat snapshots; Player view denies all such mutations. Saves retain the real user identity, and Coach-view import history is scoped to that user. Malformed, mismatched, stale or expired preferences stop on a recovery page with Exit preview.

Shared measurement storage and the approved import workflow are now implemented for private profiles. Signing in or switching View as never uploads browser data: an Admin or Coach must separately review and approve the numerical import. That workflow uploads numerical observations and provenance only. See [PLAYER_PROFILES](PLAYER_PROFILES.md).

## Shared metrics and account preparation

Private Players see their own reviewed measurements and permitted aggregate comparisons; Coaches/Admins see team profiles. Percentiles use the fixed measured cohort and require at least five comparable athletes. The player-facing summary contains no raw peer measurements and accepts no arbitrary thresholds.

Admin-only **Team account preparation** saves coach contacts and displays roster/account readiness. It does not create login accounts, grant roles or send emails. Invitations require their separate approved send workflow.

## Account management

An administrator can search configured accounts by exact UUID, linked athlete/name/code, role or status, then select one to prefill its settings. Configure existing user retains the explicit Auth UUID workflow. Roles, active status and athlete link are replaced atomically by the existing audited RPC after explicit confirmation. Any form edit clears confirmation. Own-account edits remain blocked; no profile is claimed based on email or user metadata. An unlinked Player account cannot view an athlete.

## Verification

Unit and route tests cover role projections, malformed/expired/other-actor preferences, forbidden mutations, API isolation, every browser-workspace page guard and current-session authorization responses. Anonymous browser tests verify that `/preview` routes redirect to login without opening IndexedDB. Import/OCR/local-view browser tests now require a separately authorized local Admin session; earlier anonymous-browser results do not validate the new gate. Staff import tests additionally verify real Coach writes, own-only receipts, no management grants, disabled or revoked roles, immutable conflicts and the precise bounded report lookup. Separate live Supabase test identities are still required for full Auth/API integration testing.
