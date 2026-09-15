# Fall game statistics

The protected **Game Stats** page (`/game-stats`) shows Coaches/Admins overall team batting and pitching totals, with a compact expandable player breakdown. Players and Admin Player View see only their own Game Stats, using explicitly scoped reads. Team rates divide summed counts by summed opportunities, never average player rates. Every contributing player must have complete, consistent inputs for that rate; an inconsistent individual OBP denominator cannot be hidden by another player’s extra PA. Missing counts remain unavailable, and unmapped source players are excluded with a visible scope note. Sources and current snapshots remain separate; manual dated logs are never added to sheet totals. Each authorized player profile now includes its own Game Stats tab. The route checks athlete access before querying that exact player; staff retain the separate team Game Stats page. Admins and Coaches, including interactive Coach View as, may review and save a prepared source snapshot at `/imports/game-stats`. Players read only their linked athlete. The Game Stats panel shows primary QPA totals and one pitching row per reviewed week or game; additional recorded fields stay in **More Stats**. Unrecorded rows remain unavailable.

Only these user-selected tabs are supported:

| Source | Exact tab | Source extent and meaning |
| --- | --- | --- |
| QPA % | `2026 - Fall` | Cumulative Fall totals; reviewed detail rows 2–38. September 12 source review confirmed row 37 is now an individual player row with row-local formulas, not a summary. Every included row requires a reviewed identity. |
| Pitching Stats 2026-27 | `FALL` | Raw blocks 40–70, 76–106, 113–143, 150–180 and 187–217, with header rows 39, 75, 112, 149 and 186. Season summaries, block aggregates and footers are excluded. |

Source IDs, exact sheet IDs and full bounded capture ranges are in `lib/game-source-config.ts`. Daily capture first verifies metadata, then reads only the authorized tab: QPA `A1:AG968`, pitching `A1:AE1025`. Full known-grid coverage catches newly entered statistics outside the existing blocks. Changes to the tab, headers, grid dimensions, raw inputs outside reviewed rows or previously unused columns stop automatic saving for review. This is bounded selected-tab access, never a whole-workbook export.

## Metric boundaries

QPA accepts explicitly entered counts from columns B, C, E, I–T, W, AA (SB), AB (GDP) and AC (Sac Fly). Its QPA percentage is derived only from entered QPAs / PAs, with a positive denominator. These cumulative observations replace the previous current snapshot; daily differences are never invented as games.

Pitching accepts explicitly entered counts from C, D, F, G, I, J, L, M, O, P and S–W, plus reviewed optional X/Y contact counts. The source label `K%` in E means **Strikes / Pitches**, so the dashboard labels it **Strike %**. I and U are separate `BB (pitch family)` and `BB` outcome fields. BAF, FPS and source-specific pitch/QPA labels retain their recorded meanings without invented definitions. `Inn` uses owner-confirmed baseball notation and is stored as exact outs. K/9 and BB/9 use 27 × count / outs. R is all runs; ERA requires a separately recorded ER count. WHIP, strikeout/walk percentages and game dates are not inferred. Existing source summary/checker formula inconsistencies are not treated as raw data.

Only finite nonnegative integer counts (maximum 1 billion) are imported. Plain digit strings stored as text are accepted; formulas, formatted/exponent guesses and invalid raw entries block saving. The owner confirmed QPA blank count cells mean zero when that row has a recorded PA or AB total. Entirely blank rows, pitching blanks, and QPA rows without either recorded total stay missing. Formula zeros and division errors never establish a recorded row. The two supported percentages retain raw numerator/denominator column evidence; zero denominators produce no percentage.

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
4. Review exact full-name-to-PAC mappings against the current roster. Suggestions need confirmation; partial names, row positions and jerseys never assign identity. Each populated pitching block needs either an explicitly reviewed weekly label with no game date, or an actual reviewed Fall game date, September 1–December 31. The September 12 daily-read start does not change the game-date window. Save a **reviewed mapping file** from the import page after checking its separate confirmation. An explicitly reviewed `athleteCode: "exclude"` mapping omits a named source player without creating or guessing an athlete. Unknown later names or new blocks stay pending; no new athlete or Auth link is created.
5. On a changed, valid source with retained reviewed mappings, the authorized daily run opens `/imports/game-stats`, loads the prepared file, checks the source and preview against those mappings, confirms the review and saves through the signed-in staff session. Confirm the database-backed receipt and resulting Game Stats before advancing the last-successful snapshot. Keep incomplete or failed candidates separately. An uncertain save is checked by receipt/current state before retrying; no blind repeat.
6. If access expires, the layout changes, an identity/period is unresolved or old observations disappear, preserve the previous shared statistics and private pending file. Notify only for meaningful changes, failures or required action. Stay quiet for unchanged/empty sources and unchanged known template issues. Never edit source Sheets/sharing or send invitations as part of this automation.

## Storage and authorization

Apply `supabase/migrations/202609060007_game_stat_snapshots.sql` after migration 006, then `202609060009_fall_game_dates.sql` after migration 008. Migration 009 preserves all import authorization and replacement rules while allowing actual Fall game dates from September 1; capture/sync still begins September 12. Migration 007 adds `game_stat_snapshots` (reviewed numeric archive), `game_sync_state` (current source pointer), and `game_stats` (current source observations). No roster, Auth account, role, UUID or performance-measurement data is changed. All three tables use RLS; only staff read full snapshot archives, and Player game rows remain own-athlete only. Direct authenticated table writes are denied.

`import_game_snapshot` takes the normal staff session, locks using the existing authorization lock, rechecks current roles, validates every observation, and writes one transaction. It requires a real capture time on/after the September 12 start and no more than five minutes in the future. The content hash is SHA-256 of source identity and normalized cells, excluding fetch time. An identical source version with identical mappings is unchanged; remapping the same version is rejected. A new version must be newer than the saved current version. Previously saved athlete/event/metric entries cannot disappear silently: the source requires review if any are absent. There is no destructive replacement override in this release.

`read_game_stats` is an ordinary SECURITY INVOKER read, keeps RLS and precise JSON float serialization, and exposes an exact numeric/provenance whitelist. Player preview applies the effective athlete before calling it, even while the underlying account is an Admin. Profiles never receive peer game rows. Source names, emails, full Sheet cells and raw capture files are not sent by the save action.

## Verification

Synthetic source, capture, action, server projection and embedded database tests cover explicit zero versus missing data, full-grid coverage and changed headers, new raw rows, exact reviewed identities, pitching dates, count/rate evidence, payload bounds, current roles, Player isolation, stricter RLS/revoked SELECT, atomic replacement, idempotency, precision and stale/future captures. Profile route tests verify game reads happen only after own-athlete authorization. PGlite is not hosted Supabase/API verification.

On September 5 local time, full bounded reads of both actual approved tabs passed the preparation command with **zero populated raw rows, zero observations, zero errors and zero review issues**. This verifies the current empty templates, not future populated games or unattended end-to-end saving. No fictional game statistics were uploaded to production.

Synthetic browser QA checked 24 light/dark states at 1440 and 390 pixels, including empty and populated game panels, expanded additional statistics, both prepared source previews and mapping/date edits. There was no document overflow, browser error or POST. Changing a player match cleared both approvals; an undated populated pitching block could not sync. The temporary fixture route was removed.

## Confirmed batting metrics (September 12)

The owner confirmed **Base Hit** is all hits, **HH Base Hit / HH Extra Base Hit** overlap those hits, and **Pumps** means home runs. AVG uses Base Hit / AB; BB% uses BB / PA; batting K% uses Punchies / PA. These are computed from one player's one current snapshot, with positive denominators and no double-counting of hard hits. HR, RBI, SB and GDP retain raw counts. The appended Sac Fly column enables OBP = (hits + BB + HBP) / (AB + BB + HBP + SF). Sacrifice bunts are excluded. ISO, SLG and OPS remain unavailable without doubles/triples. Do not estimate the missing components.

Migration `202609120001_qpa_baserunning.sql` adds only SB and GDP to the private metric-column whitelist. Deploy the compatible app before applying it. Ownership, ordinary-session imports and own-player RLS remain unchanged.

Staff Analytics uses only AVG, GDP, BB%, HR, K%, QPA%, HH% and SB. Their date is the source capture date in America/Los_Angeles, explicitly labeled as a snapshot date rather than a game or testing date. Physicality choices are limited to height, weight, recorded RENPHO Body Score, total muscle mass and body fat percentage.

The September 12 HH% source formula is `(I+M+J+K)/(E-T-Q)` for each detail row. The parser checks this formula before sync; numeric derivation requires all recorded inputs and a positive denominator, and omits ratios above 100%. This team sheet definition is explicitly distinguished from Statcast hard-hit rate. Migration `202609120002_game_rankings.sql` adds Sac Fly support and fixed game ranking projections. See PLAYER_PROFILES and LEADERBOARDS for scopes and privacy.

Migration `202609120003_obp_count_review.sql` withholds OBP if recorded PA is smaller than AB+BB+HBP+SF. All raw values stay saved. Profiles label this as pending source count review; the dashboard does not guess whether SF was included in AB or PA was not updated. Synthetic checks cover this guard in JavaScript and SQL.

Home Run Rate (HR%) uses recorded Pumps / PA × 100, with a positive denominator and HR no greater than PA or recorded hits. Profiles and the signed-in Game Stats leaderboard use the same exact-cohort percentiles. This measures home-run frequency; ISO/SLG/OPS still require doubles and triples. Analytics retains its eight requested QPA variables. Deploy the compatible app before migration `202609120004_game_power.sql`; it changes no table data, account privileges or own-player access. Synthetic checks cover zero/missing/inconsistent inputs, SQL/JS agreement, ties and stale comparison rejection.

## Weekly Fall pitching (September 14)

The owner confirmed `FALL BALL WEEK 1 PITCHING STATS` contains whole-week totals. Reviewed mappings use the reserved ID `fall-2026-week-1` and `playedOn: null`; weeks 1–5 must match the exact source block title. A week never acquires a game date from the capture timestamp. Dated games retain their existing date checks. Profiles, leaderboards and review tables show the week; percentiles stay within the same period. Overview selects the latest week within weekly data; mixed undated weeks and dated games are withheld there rather than guessing their order.

Optional X/Y headers `Wk` / `Hrd` mean weak-contact / hard-contact counts, confirmed by the owner. Preserve recorded integers and blank missing values; do not invent a contact percentage or assume the two counts cover every ball in play. Original A:W meanings remain unchanged, including K% = strikes/pitches and unconfirmed Inn excluded.

Scheduled checks now run once daily at 9 p.m. America/Los_Angeles for QPA `2026 - Fall` and Pitching `FALL` only. Roster scraping and RENPHO-ID scans are stopped. Existing approved local identities may be consulted; new/ambiguous pitching names require owner review. This Mac and an active staff session are still required to save. Apply `202609140001_weekly_pitching.sql` after deploying the compatible app, before saving weekly data.

September 14 verification: 1,606 synthetic tests across 99 files, lint, typecheck and production build passed. Browser checks verified weekly labels, contact details, mobile document overflow and a complete source-to-preview comparison. The compatible deployment and hosted migration succeeded; the normal staff import produced a database-backed receipt. No roster scraping occurred.


## Pitching rates and split leaderboards

The owner confirmed Inn uses baseball innings notation (.1 = one out, .2 = two outs) and R means **all runs allowed**. Store `innings_outs` at source column 18 with `derivedFrom: [18]`; display innings using outs/3 notation. Rates are undefined at zero or missing innings. K/9 = K × 27 / outs; BB/9 = walks-outcome BB × 27 / outs. Team rates use combined counts and outs, never an average of player rates.

ERA = ER × 27 / outs. The optional new **ER** header belongs in Z/26 after Hrd on a reviewed detail block. Missing ER stays missing, explicit zero stays zero, and ER > R is invalid. No source-sheet editing is done by this feature. Until ER is recorded, show an honest pending card and no ERA rank. Existing R data is unchanged.

Pitch splits show Fastball, Breaking Ball and Changeup usage (family pitches / all pitches) and strike percentage (family strikes / family pitches). Blank or inconsistent family counts do not become zeros; unclassified pitches are not distributed across families. Raw pitch-type counts are not mixed with walk outcomes. No slider/curveball split is fabricated from combined breaking-ball data.

Game leaderboards retain `group=games` with separate `discipline=hitting` and `discipline=pitching` links. Pitching ranks include K/9 descending and BB/9/ERA ascending, within the same reviewed period and existing eligible cohort. Player-own access and the minimal signed-in leaderboard projection remain unchanged. Per-nine opportunities display IP from exact outs, not batting sample labels.

Pitching preparation now includes `contractRevision: pitching-innings-outs-v2` in its content digest so the same captured cells can add the newly authorized outs/ER interpretation as a reviewed new snapshot. QPA hashes are unchanged. Preserve every prior observation and verify the upgrade only adds newly supported fields before saving; never use revision changes to silently remap athletes or alter existing counts. Deploy the compatible app, apply migration 002, then sync a fresh complete capture with retained owner-approved identities and periods.

The owner also confirmed the Sheet’s alternate .33/.67 endings mean one/two outs. Accept both .1/.2 and .33/.67 exactly; do not round arbitrary decimals into outs.

September 15 owner update: use **Runs/9 = R × 27 / innings_outs** throughout profiles, team summaries, comparisons, Analytics and pitching rankings. R includes all runs; do not display ERA or relabel it. Retain any historical ER observations unchanged. **Weak Contact % = Wk / (Wk + Hrd) × 100** and **Hard Contact % = Hrd / (Wk + Hrd) × 100**, using complete recorded counts from the same player, source snapshot and period. Missing counts remain missing; a zero total has no percentage. Team percentages divide combined counts, never average player rates. Contact percentiles show the same period and at least five eligible players; lower hard contact and Runs/9 rank higher.

Deploy the compatible app before `202609150001_pitching_contact_runs.sql`. This replaces derived ranking functions only; source snapshots, import rules, account grants and RLS remain intact. Pitching Analytics keeps each week/game as a distinct source; undated weeks use an explicitly labeled snapshot date. No games or source dates are invented. Comparison rows align two players around one metric and highlight only comparable directional results; neutral body measurements remain descriptive. Profiles use compact percentile rows beside highlights on wide screens and stack on phones.

September 15 launch simplification supersedes individual pitching-period displays: profiles, comparisons, Analytics and pitching leaderboards now use cumulative Fall 2026 counts from the current source snapshot. Recompute percentages and per-nine rates from complete summed components across each player's participating periods; missing components withhold that metric. Never add successive snapshots or mix overlapping weekly totals with dated games. Historical source rows stay unchanged. `fall-2026-cumulative` is a display-only identifier, never a source import period. Apply `202609150002_cumulative_pitching.sql` after the compatible app.

Analytics offers pitch-family Strike % only, with no Usage % choices. Comparisons restrict sources by roster roles: pitcher-only → Pitching, position-only → QPA, explicit two-way → both; a pair can select only a shared source. Actual Player and Player View profiles hide full RENPHO reports, measurement history, source/method detail sections and game-log/detail expansions, while staff retain review access. No access grants or roster changes occur.
