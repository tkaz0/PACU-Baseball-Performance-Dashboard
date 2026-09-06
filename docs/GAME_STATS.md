# Fall game statistics

The protected **Game Stats** page (`/game-stats`) displays reviewed shared game statistics. Player profiles do not duplicate this section or request its data. Admins and Coaches, including interactive Coach View as, may review and save a prepared source snapshot at `/imports/game-stats`. Players read only their linked athlete. The Game Stats panel shows primary QPA totals and one pitching row per game; additional recorded fields stay in **More Stats**. Missing inputs remain unavailable.

Only these user-selected tabs are supported:

| Source | Exact tab | Source extent and meaning |
| --- | --- | --- |
| QPA % | `2026 - Fall` | Cumulative Fall totals; detail rows 2–36 and 38. Row 37 is an excluded summary. A populated row 38 requires an exact reviewed identity just like other detail rows. |
| Pitching Stats 2026-27 | `FALL` | Raw blocks 40–70, 76–106, 113–143, 150–180 and 187–217, with header rows 39, 75, 112, 149 and 186. Season summaries, block aggregates and footers are excluded. |

Source IDs, exact sheet IDs and full bounded capture ranges are in `lib/game-source-config.ts`. Daily capture first verifies metadata, then reads only the authorized tab: QPA `A1:AG968`, pitching `A1:AE1025`. Full known-grid coverage catches newly entered statistics outside the existing blocks. Changes to the tab, headers, grid dimensions, raw inputs outside reviewed rows or previously unused columns stop automatic saving for review. This is bounded selected-tab access, never a whole-workbook export.

## Metric boundaries

QPA accepts explicitly entered counts from columns B, C, E, I–T and W. Its QPA percentage is derived only from entered QPAs / PAs, with a positive denominator. These cumulative observations replace the previous current snapshot; daily differences are never invented as games.

Pitching accepts explicitly entered counts from C, D, F, G, I, J, L, M, O, P and S–W. The source label `K%` in E means **Strikes / Pitches**, so the dashboard labels it **Strike %**. I and U are separate `BB (pitch family)` and `BB` outcome fields. BAF, FPS and source-specific pitch/QPA labels retain their recorded meanings without invented definitions. `Inn` stays excluded until the innings convention is confirmed. No ERA, WHIP, strikeout percentage, walk percentage or event date is inferred from these inputs. Existing source summary/checker formula inconsistencies are not treated as raw data.

Only entered finite nonnegative integer counts (maximum 1 billion) are imported. An entered zero is real; a blank, formula zero or division error is not. Formula/text/invalid raw counts block saving. The two supported percentages retain raw numerator/denominator column evidence; zero denominators produce no percentage.

## Review and daily operation

The owner's daily Codex automation begins game checks on **September 12, 2026, America/Los_Angeles**. It depends on this Mac/Codex being available, the Drive connection, and a valid signed-in Admin or Coach browser session. It is not an independent Vercel/cloud scheduler. The ordinary user session and database RLS authorize each save; no service-role database client or stored password is used.

1. Read the latest source metadata and the complete exact range using the Google Sheets connector. Keep its result in tool memory. The capture envelope is `{ source, range, fetchedAt, response }`, where `response` is the connector's structured CellData result for exactly one tab. `fetchedAt` records the actual read time. Read `userEnteredValue,effectiveValue` so raw entries, formulas and errors remain distinct.
2. Stream one JSON line into `scripts/write-private-game-capture.mjs /absolute/private/capture.json` through stdin. Do not interpolate source rows into shell code or print them. If the tool closes non-TTY stdin, start a PTY with `stty -echo -icanon` before executing the writer; echo stays disabled for the private stream. The writer accepts at most 5 MiB, writes exclusively with mode `0600`, and refuses a path inside Git. Keep its directory mode `0700`.
3. Using **Node 24** (the bundled runtime has been tested), prepare a new file:

   ```sh
   node scripts/prepare-game-snapshot.mjs \
     --source qpa_fall_2026 \
     --input /absolute/private/capture.json \
     --output /absolute/private/prepared.json \
     --mappings /absolute/private/reviewed-mappings.json
   ```

   Use `pitching_fall_2026` for the pitching source. Omit `--mappings` to prepare a review draft. The output is a new exclusive `0600` file outside Git; existing files are never overwritten. Standard output contains only provenance hashes, counts and readiness, not names or statistics. The local snapshot limit is 40,000 cells / 5 MiB; the shared normalized action payload is at most 1 MiB.
4. Review exact full-name-to-PAC mappings against the current roster. Suggestions need confirmation; partial names, row positions and jerseys never assign identity. Each populated pitching block also needs an actual reviewed Fall game date, September 1–December 31. The September 12 daily-read start does not change the game-date window. Save a **reviewed mapping file** from the import page after checking its separate confirmation. Unknown later names or new blocks stay pending; no new athlete or Auth link is created.
5. On a changed, valid source with retained reviewed mappings, the authorized daily run opens `/imports/game-stats`, loads the prepared file, checks the source and preview against those mappings, confirms the review and saves through the signed-in staff session. Confirm the database-backed receipt and resulting Game Stats before advancing the last-successful snapshot. Keep incomplete or failed candidates separately. An uncertain save is checked by receipt/current state before retrying; no blind repeat.
6. If access expires, the layout changes, an identity/date is unresolved or old observations disappear, preserve the previous shared statistics and private pending file. Notify only for meaningful changes, failures or required action. Stay quiet for unchanged/empty sources and unchanged known template issues. Never edit source Sheets/sharing or send invitations as part of this automation.

## Storage and authorization

Apply `supabase/migrations/202609060007_game_stat_snapshots.sql` after migration 006, then `202609060009_fall_game_dates.sql` after migration 008. Migration 009 preserves all import authorization and replacement rules while allowing actual Fall game dates from September 1; capture/sync still begins September 12. Migration 007 adds `game_stat_snapshots` (reviewed numeric archive), `game_sync_state` (current source pointer), and `game_stats` (current source observations). No roster, Auth account, role, UUID or performance-measurement data is changed. All three tables use RLS; only staff read full snapshot archives, and Player game rows remain own-athlete only. Direct authenticated table writes are denied.

`import_game_snapshot` takes the normal staff session, locks using the existing authorization lock, rechecks current roles, validates every observation, and writes one transaction. It requires a real capture time on/after the September 12 start and no more than five minutes in the future. The content hash is SHA-256 of source identity and normalized cells, excluding fetch time. An identical source version with identical mappings is unchanged; remapping the same version is rejected. A new version must be newer than the saved current version. Previously saved athlete/event/metric entries cannot disappear silently: the source requires review if any are absent. There is no destructive replacement override in this release.

`read_game_stats` is an ordinary SECURITY INVOKER read, keeps RLS and precise JSON float serialization, and exposes an exact numeric/provenance whitelist. Player preview applies the effective athlete before calling it, even while the underlying account is an Admin. Profiles never receive peer game rows. Source names, emails, full Sheet cells and raw capture files are not sent by the save action.

## Verification

Synthetic source, capture, action, server projection and embedded database tests cover explicit zero versus missing data, full-grid coverage and changed headers, new raw rows, exact reviewed identities, pitching dates, count/rate evidence, payload bounds, current roles, Player isolation, stricter RLS/revoked SELECT, atomic replacement, idempotency, precision and stale/future captures. Profile route tests verify game reads happen only after own-athlete authorization. PGlite is not hosted Supabase/API verification.

On September 5 local time, full bounded reads of both actual approved tabs passed the preparation command with **zero populated raw rows, zero observations, zero errors and zero review issues**. This verifies the current empty templates, not future populated games or unattended end-to-end saving. No fictional game statistics were uploaded to production.

Synthetic browser QA checked 24 light/dark states at 1440 and 390 pixels, including empty and populated game panels, expanded additional statistics, both prepared source previews and mapping/date edits. There was no document overflow, browser error or POST. Changing a player match cleared both approvals; an undated populated pitching block could not sync. The temporary fixture route was removed.
