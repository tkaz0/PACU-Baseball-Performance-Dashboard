# Coaching notes on testing trends

Dated coaching notes add context to a player's saved testing progress. A coach or administrator can record a grip change, stance change, swing cue, training change, or general coaching note. Each note has an actual Fall 2026 date, up to 400 characters, and a chart scope: All Charts, Physicality & Testing, Hitting Practice, Hitting In-Game, Pitching Practice, or Pitching In-Game. The shared form defaults to **staff only**. Checking **Share this note with the player** allows the linked player to see that note on their own profile.

## Display

`loadTrendAnnotations(access, athleteId)` provides the authorized notes. `TrendAnnotations` renders the profile editor and note cards. It can be shown before a player has repeated testing. `ProfileTrendChart` and `SessionProgress` accept the same authorized `annotations` array and select only unarchived notes matching the chosen chart scope (or explicitly All Charts), with dates inside the currently displayed series' first and last test dates. Session charts place points by actual calendar date; sessions on the same day share a horizontal position. Blast dates remain the recorded weekly report end dates.

Markers use a dashed vertical calendar line and a triangle above the measured plot; they never acquire a result value, add a test date, move an observation, or interpolate a measurement. All notes within the selected range are available in the expandable **Coaching Notes in This Chart** list, including multiple notes on a single day. Markers add context; they do not establish that a coaching adjustment caused a change in results. Switching a chart's metric/source keeps its original measurements and source partitions intact. Legacy `Full Swing · Hitting` and `Full Swing · Pitching` source labels use Practice note scopes, matching the existing profile/session classification; only explicit Game/Intrasquad sources use In-Game scopes.

## Access and saving

Apply `supabase/migrations/202609300002_trend_annotations.sql` before enabling the editor in production. The isolated `trend_annotations` table has RLS enabled, no direct authenticated table grants, and ordinary-session RPC access. No storage, source data, roster, credentials, or account grants change.

- Active Admin and Coach accounts can read and write through the RPCs. Interactive Coach View retains this ability.
- A real player can read only their linked athlete's explicitly shared, unarchived notes and cannot write.
- The server reader repeats the own-athlete check, exact field allowlist, and shared/unarchived filter for Player View as, whose underlying JWT belongs to an administrator.
- Every action refreshes trusted access through `requireImportAccess`; Player View as is explicitly denied again.
- Dates must be valid September–December 2026 dates on or before the current Pacific calendar day. Categories, scopes, and text are validated in both application and SQL.
- A client-generated note UUID plus an expected revision prevents duplicate creation and stale overwrites. Existing notes cannot move to another athlete. Each verified save returns the same note UUID with revision incremented by one.
- Archive preserves the note while removing it from charts and actual/player-preview views. Staff can review and restore archived notes. Each athlete has a bounded history of 100 notes.
- Uncertain saves never retry automatically; the form asks the coach to refresh and inspect the current note. Audit events record only IDs, revision, sharing and archive state, never note text or measurement values.

## Verification

The dedicated tests exercise real SQL authorization, same-player restrictions, sharing, archiving, revocation, stale revisions, immutable ownership, date/category/text validation and redacted audit details using fictional fixtures. Server tests also verify Player View as filtering and strict response parsing. Chart-range tests cover matching date boundaries, dates between actual tests, multiple notes per day, and invalid/single-date windows, source/context scope, unequal calendar spacing, and multiple source sessions on one date. These database tests use PGlite and do not replace a live Supabase/Auth/UI check.
