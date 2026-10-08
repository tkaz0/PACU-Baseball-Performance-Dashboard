# PACU Baseball Performance

Pacific Baseball's independent performance workspace provides private player profiles, team access for coaches, and administrator controls. It is a personal project by **Trevor Kazahaya**, not an official university application.

The home route opens the role-aware Pacific Baseball dashboard for signed-in staff and players, and the sign-in page for visitors. Staff can continue to roster and imports; players can open their own profiles and game stats. Every dashboard requires login. [Information Imports](https://pacubaseballperformance.com/imports) gives active Admins and Coaches labeled upload areas, including Blast Motion session summaries that save reviewed readings directly to private profiles. The advanced browser workspace remains local until readings are explicitly shared. Admin **View as Coach** includes the same performance import tools; reviewed saves use the signed-in administrator account. Player View as remains read-only.

**Graphics** turns authorized saved results into player cards, one-stat posts, percentiles, pitch arsenals, progress, team leaders, comparisons, and an About PACU card. Choose a graphic and a player from the searchable dropdown, use an Instagram 4:5, Story 9:16 or X 16:9 preset, then **Save Image** or **Copy Caption** above the preview. Customize holds optional styling, stat selection, Square size and editable SVG. Images use compact context and sample labels without a bottom information block; the short social caption and optional full stat details preserve the relevant evidence. Players use their own results; staff have team options. Nothing is posted automatically. See [Graphics Studio](docs/GRAPHICS.md).

Built with Next.js 16, React 19, TypeScript, Tailwind 4, Supabase Auth/PostgreSQL and Vercel. Consult [HOSTED-SETUP](docs/HOSTED-SETUP.md) for completed environment receipts.

## Start here

1. Follow [SETUP](docs/SETUP.md), install the pinned dependencies, and create `.env.local` from `.env.example`.
2. Apply the unapplied tracked migrations in order after inspecting the target database's history. Provision the first administrator deliberately; roster imports never create accounts.
3. Run `pnpm dev`. Access uses the project's publishable key plus the signed-in user's session. `/preview` also requires Supabase configuration and an active Admin or Coach; there is no public or development authentication bypass.
4. Review the protected roster, add approved readings at **Information Imports**, choose **Light / Dark / System** in Settings, and prepare players/coaches at **Team account preparation**.

## Available workflows

- **[Exit Meetings](docs/EXIT_MEETINGS.md):** choose a player, review a concise meeting summary (or choose the detailed report) and download a branded private PDF with stats, verified percentiles, strengths/development areas, and optional meeting talking points. Staff only; no email or persistent report storage.
- **Visual workspace:** refreshed player/staff Home, role-specific profile comparison cards, source-backed rate/coverage/ranking graphics, compact team-average references, and a staff Correlation Map with exact paired-player counts and scatterplot drill-down. Existing data and metric policies remain intact.

- **Coaching Analytics:** compare saved testing and game measures with a scatterplot, best-fit line, Pearson r, class/position filters and color groups. Full Swing uses the same verified Fall maximums and reading-weighted averages as the leaderboards; count-incomplete averages are marked Latest Session. Admin/Coach only; see [ANALYTICS](docs/ANALYTICS.md).

- **Admin:** roster and measurement imports, account configuration, coach preparation, and **View as Coach** with working performance imports and read-only **View as Player** with explicit athlete selection and **Exit preview**.
- **Coach:** team roster, shared profiles and performance imports. **Player:** the explicitly linked profile plus the owner-authorized team leaderboard. Live account status and PostgreSQL RLS enforce access.
- **Appearance:** Light, Dark or System, saved in the current browser; System follows device appearance. Every account can change it in Settings or the header.
- **Player profiles:** Overview, Physicality, Hitting and Throwing tabs with main values/units and actual Last Tested dates. Overview shows data-supported strengths, weaknesses and biggest jumps; pitcher-only profiles omit Hitting, while two-way players retain it. RENPHO and history remain secondary views; each profile also includes its own Game Stats tab, with the team view retained for staff. Baseball uses **Fall 2026**; body measurements retain their actual testing dates and separate comparison periods. Height displays in feet and inches; untested measurements show a simple placeholder. See [PLAYER_PROFILES](docs/PLAYER_PROFILES.md).
- **Leaderboards:** all active signed-in players and staff can compare the eligible current team's latest reviewed testing results by Physicality, Hitting and Throwing. Numbered rankings appear automatically as compact stat cards, with category navigation and no filter form. Height and muscle mass % sort highest first; body fat % sorts lowest first. Ties share a rank. Metric, source, unit and testing period stay separate; normal peer profile/history access remains restricted. See [LEADERBOARDS](docs/LEADERBOARDS.md).
- **Staff search:** names and PAC IDs suggest matching player profiles while typing in the header or roster search. Ordinary roster tables omit status while retaining stored eligibility.
- **Workspace layout:** Pacific-branded roster header with the selected season and actual player count; grouped team, staff and administration navigation; consistent profile tabs and ranking cards. The header shows the active role and appearance controls. Light and dark appearances use the same page structure.
- **Testing:** active Admins and Coaches can see which current players still need each Fall test and enter reviewed results without a file. Player search, feet/inches, explicit protocol/date/unit review and safe identical retries use the existing shared import path. See [TESTING_WORKFLOW](docs/TESTING_WORKFLOW.md).
- **Information Imports:** Physicality (RENPHO), Hitting (Full Swing CSV), Pitching (Full Swing CSV), and Games / Intrasquad (Full Swing CSV). Live roster matching and explicit review precede sharing. Full Swing currently supports manually mapped session summaries; an actual export is still needed to validate automatic parsing of raw swing/pitch logs.
- **RENPHO review:** browser-local OCR for the supported portrait report layout automatically selects a player by an exact shared roster RENPHO ID. Unknown IDs require player selection. The reader retries tiny SMI unit text at higher resolution and identifies the measurement if a reading still fails. Clearly printed feet-and-inches header height is included for review and saved to profiles and the Height leaderboard. Reopen original files to add missing heights while preserving existing readings. Staff still review the name, date, values and units before saving. Admins update the shared ID registry through a reviewed roster ID file; earlier aliases remain linked. Existing mass bars, percentage bars and report history use approved numerical readings.
- **Report corrections:** an Admin outside View as can move one misassigned RENPHO report to any existing player, including someone without prior reports, or exchange two reports. Optional exact report-ID corrections require independent confirmation. The narrow `202609070001_renpho_report_corrections.sql` and `202609070002_renpho_report_reassignment.sql` upgrades preserve player identities, values and original import provenance; fresh checks and saved receipts make identical retries safe. Normal imports cannot overwrite ownership. See [SETUP](docs/SETUP.md).
- **Shared measurements:** select a reviewed browser backup, inspect supported readings and exclusions, then approve uploading only whitelisted numerical observations and source provenance. Images, OCR text, report IDs and the full backup are not uploaded by this flow.
- **Team account preparation:** review player readiness and save coach names/contact emails. A prepared coach is not an Auth account and has received no invitation from this page.
- **Individual invitations:** implemented separately and disabled by default. Sending requires verified sender/templates, enabled server configuration and explicit recipient approval. The owner has said not yet to team emails; keep sending disabled and unsent until explicit approval.

The advanced local Import Center reads explicitly mapped CSV, TSV and XLSX. Vendor names are source labels, not promises of unverified parser support. Supported RENPHO PNG/JPG and one-page PDF reading stays on the device. The Fall 2026 game-sheet workflow is documented in [GAME_STATS](docs/GAME_STATS.md). Additional unverified vendor layouts, force plates, AI interpretation and training recommendations remain deferred.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Run the development app |
| `pnpm lint` | Check code style |
| `pnpm typecheck` | Check TypeScript |
| `pnpm test` | Run unit, adapter and embedded PostgreSQL tests |
| `pnpm test:ui` | Run browser tests against a local app |
| `pnpm build` | Build for production |
| `pnpm start` | Serve a local production build |

On the owner's Mac, **Start PACU.command** starts the local app; keep its Terminal open while using it. It does not provision accounts or change the database.

## Project guide

- [SETUP](docs/SETUP.md): environments, migrations, account setup, sharing and deployment.
- [TESTING_WORKFLOW](docs/TESTING_WORKFLOW.md): manual test entry, Fall checklist and save receipts.
- [INFORMATION_IMPORTS](docs/INFORMATION_IMPORTS.md), [GAME_STATS](docs/GAME_STATS.md) and [APPEARANCE](docs/APPEARANCE.md): current upload, source-update and appearance workflows.
- [PLAYER_PROFILES](docs/PLAYER_PROFILES.md) and [LEADERBOARDS](docs/LEADERBOARDS.md): profile tabs, metric definitions, periods, comparisons and read boundaries.
- [BRANDING](docs/BRANDING.md): official asset sources and presentation rules.
- [ATHLETE_IDS](docs/ATHLETE_IDS.md): stable PAC IDs, old-import compatibility and reviewed migration.
- [DATA_MODEL](docs/DATA_MODEL.md): identities, roles, measurements, provenance and database controls.
- [ACCESS_VIEWS](docs/ACCESS_VIEWS.md): real permissions and administrator display previews.
- [INVITATIONS](docs/INVITATIONS.md): coach preparation, approved sends, recipient setup and verification limits.
- [IMPORTS](docs/IMPORTS.md) and [RENPHO_CHARTS](docs/RENPHO_CHARTS.md): local file review and report charts.
- [TESTING](docs/TESTING.md), [VERIFICATION](docs/VERIFICATION.md), [HOSTED-SETUP](docs/HOSTED-SETUP.md): repeatable checks and historical receipts.
- [AGENTS](AGENTS.md): development boundaries and private-data handling.

RENPHO partial review: an isolated unreadable or ambiguous metric in the recognized portrait layout is left out without blocking other selected, reviewed readings. The review names omitted metrics; selected metric errors and report layout/ID/date/unit-anchor errors still block saving. Existing observation identities remain unchanged, allowing later missing-field backfill without duplicates. No OCR value or unit is guessed. `tests/renpho-preview.test.ts` covers omission, explicit exclusion, strict report blockers and partial-save retries.

The leaderboard uses total recorded Muscle Mass (lb/kg) instead of Muscle Mass %. Compact cards show five ranked players initially with the complete remaining ranking expandable. Migration `202609080001_leaderboard_muscle_mass.sql` adds total mass only to the existing minimal signed-in leaderboard projection; profile metrics, measurement values, table RLS and account permissions are unchanged. Deploy the compatible app before enabling the migration so older strict response validators do not encounter the new metric. Source/unit/period cohorts remain separate.

Profiles include blue-to-red Pacific percentile markers and an Overview comparison summary. Administrators can review and correct a recorded weight from its player profile while retaining the original test date and provenance.

Player Body Composition and Overview now use recorded total Muscle Mass, consistent with team leaderboards.

- RENPHO Body Score uses only the printed top-right report score, with no custom composite. See `docs/RENPHO_BODY_SCORE.md`.

See [RENPHO skeletal muscle and muscle balance](docs/RENPHO_MUSCLE_BALANCE.md) for retained skeletal-mass report data, private segment readings, the 10% review flag, and migration 202609100001. Skeletal mass is hidden from main profile cards, leaderboards and Testing choices. Deploy the compatible app before enabling the catalog migration.

Game Stats now includes shared-style blue/red percentiles and a separate signed-in leaderboard section. QPA supports confirmed sacrifice flies for OBP and the sheet-defined HH%. Analytics exposes only the eight owner-selected game variables, with manual-testing height omitted.

Home Run Rate (HR%) uses recorded Pumps / PA × 100, with a positive denominator and HR no greater than PA or recorded hits. Profiles and the signed-in Game Stats leaderboard use the same exact-cohort percentiles. This measures home-run frequency; ISO/SLG/OPS still require doubles and triples. Analytics retains its eight requested QPA variables. Deploy the compatible app before migration `202609120004_game_power.sql`; it changes no table data, account privileges or own-player access. Synthetic checks cover zero/missing/inconsistent inputs, SQL/JS agreement, ties and stale comparison rejection.

Game rates now show their recorded opportunity counts beneath the result, separate from the percentile cohort size. AVG uses AB; OBP uses AB+BB+HBP+SF; HH% uses the verified team denominator; other batting rates use PA; pitching Strike% uses pitches from the same event. Missing counts remain absent. Deploy the compatible app before `202609120005_game_opportunities.sql`, which adds only a nullable opportunity count to each authorized leaderboard row. Tests cover denominator selection, event isolation, missing data and response validation.

Dated **Game Log**, recent-five-game summaries, **Limited sample** labels, and staff **Data Review** are documented in [docs/GAME_LOG.md](docs/GAME_LOG.md). Apply additive migration `202609120006_dated_game_logs.sql` before the app. Existing QPA snapshots, Analytics selections, account permissions and daily imports stay separate from manually logged games.

Game Stats now opens a team summary for Coaches/Admins and a private personal summary for Players. Data Review stays in Coaching Tools; Game Log is removed from the menu.

RENPHO repeat tests show signed percentage changes, previous values/dates, and the owner's green/red/neutral preferences. Personal and team Game Stats include SB/PA with PA counts. See [RENPHO changes](docs/RENPHO_CHANGES.md) and [advanced hitting readiness](docs/ADVANCED_HITTING.md); estimated power/contact metrics and PAC Production+ now use the reviewed September 28 definitions below; exact weighted offense and wRC+ still require further source/reference context.

Profile Overview now separates Physicality (Muscle Mass, printed Body Score, Body Fat %) from Game Stats and role-relevant testing percentiles. Current game rates can populate Strengths/Weaknesses with visible sample sizes. Standalone batting Hits/AB are removed from personal displays; AVG retains its AB denominator. See [profile presentation](docs/PLAYER_PROFILES.md).

Staff now have [Team Progress and Compare Players](docs/COACHING_TOOLS.md): compact testing-change bars, adjustable retest queues, and two-player measurement/game comparisons with dates and sample sizes. Profile Overview percentiles use a tighter responsive layout.

Compare Players now offers an explicit searchable dropdown for every current-season roster identity, including players without measurements. Launch presentation uses smaller headers/cards, compact import lanes, and expandable secondary team totals.

Testing now opens a compact staff Data Coverage checklist for RENPHO, hitting and throwing; expand a player's status to see missing metrics and test dates. Confirmed direct imports show matched player links, reviewed measurement names, dates, new/existing counts and left-out values. A short first-visit guide helps players read their profile and can be reopened using Guide. These additions use the existing permissions and do not send invitations or provision accounts.

Profiles include selectable test-history charts after two comparable test dates. Player/team game rates use labeled value-scale bars alongside existing percentile comparisons; mobile profile tabs wrap cleanly. See [PLAYER_PROFILES](docs/PLAYER_PROFILES.md).

Weekly Fall pitching now uses reviewed week IDs with null game dates and separately recorded Wk/Hrd contact counts. See [Game Stats](docs/GAME_STATS.md) and migration `202609140001_weekly_pitching.sql`. Daily source checks exclude the roster.

Pitching rates use exact recorded outs; K/9 and BB/9 use 27 × count / outs. ERA requires separate earned runs and never substitutes total R. Migration `202609140002_pitching_rates.sql` adds outs/ER and the existing narrow ranking projections. Game leaderboards have separate Hitting/Pitching views.

September 15 owner update: use **Runs/9 = R × 27 / innings_outs** throughout profiles, team summaries, comparisons, Analytics and pitching rankings. R includes all runs; do not display ERA or relabel it. Retain any historical ER observations unchanged. **Weak Contact % = Wk / (Wk + Hrd) × 100** and **Hard Contact % = Hrd / (Wk + Hrd) × 100**, using complete recorded counts from the same player, source snapshot and period. Missing counts remain missing; a zero total has no percentage. Team percentages divide combined counts, never average player rates. Contact percentiles show the same period and at least five eligible players; lower hard contact and Runs/9 rank higher.

Deploy the compatible app before `202609150001_pitching_contact_runs.sql`. This replaces derived ranking functions only; source snapshots, import rules, account grants and RLS remain intact. Pitching Analytics keeps each week/game as a distinct source; undated weeks use an explicitly labeled snapshot date. No games or source dates are invented. Comparison rows align two players around one metric and highlight only comparable directional results; neutral body measurements remain descriptive. Profiles use compact percentile rows beside highlights on wide screens and stack on phones.

September 15 launch simplification supersedes individual pitching-period displays: profiles, comparisons, Analytics and pitching leaderboards now use cumulative Fall 2026 counts from the current source snapshot. Recompute percentages and per-nine rates from complete summed components across each player's participating periods; missing components withhold that metric. Never add successive snapshots or mix overlapping weekly totals with dated games. Historical source rows stay unchanged. `fall-2026-cumulative` is a display-only identifier, never a source import period. Apply `202609150002_cumulative_pitching.sql` after the compatible app.

Analytics offers pitch-family Strike % only, with no Usage % choices. Comparisons restrict sources by roster roles: pitcher-only → Pitching, position-only → QPA, explicit two-way → both; a pair can select only a shared source. Actual Player and Player View profiles hide full RENPHO reports, measurement history, source/method detail sections and game-log/detail expansions, while staff retain review access. No access grants or roster changes occur.


September 16 Player Metrics: the owner authorized the existing Drive workbook `Player Metrics 2026-27.xlsx` (141dl_DBW0UwIXRcvt572e04AMLxqQuk6). Import raw timed trials from `Test Day Results` only with the owner-confirmed September 15, 2026 date and seconds. Position-player Arruda is Aukai; pitching Arruda is AJ. Row 39 is excluded by the owner. Preserve exact reviewed roster identities and earlier exclusions; no roster Sheet scan or new accounts. Keep raw files and prepared readings private outside Git. No recurring Player Metrics scan is configured by this one-time request.

Timed profiles show the fastest trial and arithmetic average of valid recorded trials in the same source/unit/Fall period, with trial count and last testing date. Blanks are missing, never zero. Timed leaderboards and percentiles rank best times only. Separate the 12 ft start, reaction, and 12–42 ft split; never map them all to generic Steal Break. Other measurements remain latest-reading views. Pitcher-only speed visibility stays unchanged. Migration `202609160001_player_metrics_trials.sql` adds the three precise protocols and changes derived best-time selections without deleting source readings or expanding access. Apply after the compatible app. Re-importing an updated workbook must check existing source coordinates and dates to avoid counting the same trials twice; this release is not an unattended workbook updater.

Player Metrics now imports separately confirmed Home to 1st/2nd and dominant/non-dominant grip readings. Profiles and leaderboards display only available metrics; paused steal protocols stay saved but hidden.


September 17 Full Swing update: Games / Intrasquad supports the exact reviewed Field / Live at Bat CSV layout with confirmed mph/ft, per-player maximums/averages and metric sample counts. Other raw layouts remain pending. See docs/INFORMATION_IMPORTS.md for limitations and derived-summary provenance. The private 142-event sample produced 94 summaries matching independent calculations; synthetic tests cover missing readings, duplicate pitches, dates, identity conflicts and summary import validation. Browser QA used only fictional players and a mock save; no real sample results were saved.

September 17 session review update: all Full Swing players are visible with metric sample sizes, searchable summaries and adjustable per-pitcher velocity/spin ranges. Profiles now separate In-game from Practice & Testing, retaining distinct source/unit readings and percentiles. No migration is required, and no raw pitch groups or sample imports are automatically saved. See `docs/INFORMATION_IMPORTS.md` and `docs/PLAYER_PROFILES.md`. Regression coverage includes range boundaries, missing spin, all-player review, and context/cohort separation.

Reviewed pitch types: apply `202609170001_pitch_assignments.sql` before deploying the staff annotation UI. Active Admins/Coaches can save per-row pitch labels for the exact Full Swing CSV and reuse them across staff sessions. Suggestions use editable per-pitcher speed/spin guidelines and remain review-only until explicitly applied and saved. Profiles and summary-import payloads are unchanged. Tests cover classification ambiguity, pitcher-specific overrides, group/individual assignment, staff access, stale revisions, exact retries and malformed payloads. See `docs/INFORMATION_IMPORTS.md`.

Full Swing/Blast imports skip unmatched names by default. Staff can match or exclude names before review; only selected roster players receive readings. See `docs/INFORMATION_IMPORTS.md`.


Full Swing values display to one decimal across imports, profiles, comparisons and charts while original precision is retained. Reviewed pitch labels can now publish max/average velocity and spin by pitch type to the player’s In-game tab.


Hitting and Pitching & Throwing leaderboards now separate In-game and Practice. Recorded classified pitches have average/max velocity and spin rankings, grouped by pitch type; existing Game Stats rankings remain separate cumulative sheet results.


Pitching leaderboards now use a recorded Pitch Type selector with average/max velocity and spin together. Position Throwing has separate infield/outfield velocity rankings. In-game and Practice remain distinct, and compact magnitude bars make hitting/throwing ranks easier to scan.


Full Swing pitch review now groups nearby velocities until a 3 mph gap, with fixed bins still optional. Player matching visibly offers No player / Skip these stats. Admin profiles include Correct CSV Assignments for reversible removal of one mistaken Full Swing file assignment.

The September 19 visual refresh adds the complete Pacific Boxer mark to the roster and navigation, consistent page headings and stat panels, and compact phone tabs in both appearance modes. See [Branding](docs/BRANDING.md).


Blast Motion supports weekly Average Performance and Peak (95th Percentile) CSV reports with reviewed dates/player matching and side-by-side Practice summaries. See `docs/INFORMATION_IMPORTS.md` and the September 20 migration in `docs/SETUP.md`.

Practice profiles now focus on five Blast measurements with cumulative Fall averages weighted by reported swing counts. Weekly P95 results remain separately labeled. Use weekly exports of new swings with non-overlapping date ranges.


Launch design: signed-in Home offers a role-aware season snapshot, compact expandable team leaderboards, Fall coverage, recent updates, game snapshots and useful shortcuts. Hitting displays use five Blast cards with Fall averages and separately labeled weekly P95. Shared navigation, profiles, tables and sign-in styling are refreshed across light/dark/mobile layouts. Ordinary role/RLS checks, import review and invitation settings are unchanged.


September 20 hitting team averages: profile cards and Overview show source/unit-specific Full Swing comparisons (mean of each eligible player’s latest Fall result, including for maximum metrics). The five main Blast Practice comparisons pool non-overlapping average reports weighted by swing count, excluding incomplete player-metric rollups and paired P95 reports. Sample players/swings and covered dates are available under each comparison. The aggregate-only `hitting_team_averages` RPC checks active Player/Coach/Admin access and returns no identities or raw observations. Apply additive migration `202609200003_hitting_team_averages.sql` before deploying the consuming profile page. Tests cover context/unit separation, latest selection, weighted samples, negative angles, incomplete/overlapping periods, cohort eligibility and own-player RLS.

Current source checks run weekly on Monday at 9 p.m. Pacific for the approved Fall game sheets and Player Metrics workbook. Scheduled roster/RENPHO-ID scanning remains off. See [Game Stats](docs/GAME_STATS.md) for review and save requirements.

Capstone movement screenings appear under Physicality with 1–5 ratings, source color flags, and paired range-of-motion results in degrees. Staff review imports at `/imports/movement`; players see only their own assessment.


September 21 bulk invitations: an active Admin outside View as can review remaining eligible players at `/admin/access/bulk`, deselect recipients, explicitly confirm each displayed email/profile match as a batch, and start sequential individual invitations. This extends the individual-review interface; it does not authorize unattended sends. Exact live roster emails and eligibility are rechecked under locks. The Auth-only administrator client checks existing sign-ins and sends invites; ordinary-session RPCs reserve unique player/email attempts, configure fixed Player access and record completion. Uncertain attempts remain reserved and pause the batch without automatic resend. Loading the page sends nothing. Apply `202609210003_bulk_player_invitations.sql` before deploying the page. No accounts or emails are created by the migration.

### Invitation status
Admins can open Account Access → Invitation Status to search/filter configured accounts by acceptance, password setup, role and disabled access. Refresh Status reads current status without sending emails or changing access.
## Session publishing

Staff can review saved Full Swing and Blast reports in **Import Center → Session Library**. Raw Full Swing sessions publish player summaries, classified pitch results, sample counts and contact charts together. Admins can re-review an original tracked CSV to correct misreads and restore a previous revision. See [Session Library](docs/SESSION_LIBRARY.md) for legacy-file limits and rollout requirements.

Read-page loads share authorization checks only within one server render, run independent readers concurrently, and avoid unused pitcher/Home comparisons. Mutations and PDF downloads always recheck live access. See [performance notes](docs/PERFORMANCE.md).


Full pitching arsenals now appear in profiles, staff player comparison and the default All Pitches leaderboards. Every recorded pitch keeps its own average/max velocity and spin, metric-specific samples and dates, with Game, Intrasquad and Practice separated. Fall averages use verified reading counts; missing counts retain a labeled latest-session average. No stored readings or access rules change.

## Personal tools and development progress

Staff can save named Analytics views, set numeric goals on a player’s Overview, and save a read-only meeting summary in Exit Meetings. Player Home and staff Home show results added since the previous visit. The full pitching arsenal now includes a fastball-reference speed-separation chart. Existing source partitions and own-player permissions remain in force. See [Personal Dashboard](docs/PERSONAL_DASHBOARD.md), [Player Goals](docs/PLAYER_GOALS.md), [Pitch Arsenal](docs/PITCH_ARSENAL.md) and [Exit Meetings](docs/EXIT_MEETINGS.md).

Pitch assignments now use specific pitch types. Older generic labels remain visible as **Unspecified Pitch** until reviewed; Admins can verify the original CSV and correct a saved legacy group to **4-Seam Fastball**, with guarded restoration in Pitch Label History. See [Session Library](docs/SESSION_LIBRARY.md).


## September 28: estimated hitting value and pitching efficiency

The owner clarified that **HH Extra Base Hit is every double/triple, excluding Pumps**; Base Hit includes all hits and Pumps is HR. This supersedes prior missing-XBH assumptions, without changing captured source observations, hashes or import mappings. Singles = H − XBH − HR. Estimated TB = H + XBH + 3×HR. **SLG** = estimated TB / AB; **ISO** = (XBH + 3×HR) / AB. Combined doubles/triples are treated as doubles, so these are conservative estimates, not exact SLG/ISO. Actual triples add one base each. Exact OPS and wRC+ remain unsupported.

**wOBAcon** = (.882×singles + 1.252×XBH + 2.037×HR) / (AB − K + SF). These are fixed, completed-season 2025 MLB reference weights from [FanGraphs Guts](https://www.fangraphs.com/tools/guts?type=cn), not locally calibrated run values. Walks/HBP are excluded from contact opportunities. **PAC Production+** = 100 × ((estimated TB + BB + HBP) / PA) / pooled eligible-team rate. The reference pools numerator and PA, rather than averaging individual rates; at least five complete valid same-snapshot lines and a positive baseline are required. It is a custom recorded-production index, not wRC+ or runs created.

**WHIP** = 3×(hits + outcome walks) / exact outs, excluding HBP. **K/BB** = strikeouts / outcome walks, withheld at zero walks rather than represented as infinity. All pitching projections sum complete counts from distinct reviewed periods, preserving the existing weekly/dates overlap guard. Missing or inconsistent inputs withhold affected rates. Estimated power rates may exceed 1; never clip them to a 0–1 progress bar. Team summaries pool counts, staff comparisons use the eligible source projection, and players receive only their own summaries plus the existing narrow ranking projection. Percentiles need five comparable players; rankings remain inclusive with existing sample labels.

Deploy compatible application readers **before** applying `supabase/migrations/202609280005_advanced_game_rates.sql`. It replaces read-only rank functions; no source data, RLS, account grants or import permissions change. Profiles, overviews, comparisons, exit reports and rankings share the same definitions. Pitching Analytics includes WHIP and K/BB; the owner's eight QPA Analytics choices stay unchanged. FIP remains withheld because HR allowed and a verified local run-scale constant are unavailable.


## Advanced performance presentation

Advanced Performance now leads player Overview: PAC Production+, SLG, ISO and wOBAcon for hitters; K/BB, K/9, BB/9 and WHIP for pitchers. Two-way players get separate groups. Home features advanced team/own summaries and Production+/K/BB leaders, with classic leaders as a missing-data fallback. Game leaderboards put advanced rankings first; team Game Stats puts power estimates in the main cards. Values retain real opportunity counts and verified red/blue percentiles. These are recorded-result measures, not luck-adjusted predictions; existing contact-quality and pitch-trait views supply complementary evidence.

QPA calculations now account for sacrifice flies that were added after the older AB totals. Data Review shows official hitting lines and the SF adjustment; already corrected AB totals are not adjusted again. See [Game Stats](docs/GAME_STATS.md).

Team game-summary status: valid recorded zero-AB lines contribute zero to pooled SLG/ISO/contact totals; they never block teammates or create an individual zero-opportunity rate. Missing inputs show “Awaiting counts”; conflicting totals retain “Counts need review.” No source values or ranking rules change.

## Player development tools

Profiles now include coach-assigned Weekly Plans on Overview, Swing Replay attachments on the paired contact/spray chart, and a Progress tab with training-block comparisons and dated coaching notes. Shared plans also appear on the linked player's Home. These features preserve own-player access and separate practice from in-game results. See [Weekly Plans](docs/DEVELOPMENT_PLANS.md), [Swing Replay](docs/SWING_VIDEOS.md), [Training Blocks](docs/TRAINING_BLOCKS.md), and [Coaching Notes](docs/TREND_ANNOTATIONS.md).

Bulk invitation recovery: `202610010001_invitation_rate_limit_recovery.sql` adds a retained `rate_limited` status. Only a confirmed Supabase 429 `over_email_send_rate_limit` response returns a current reservation to later review automatically; unknown errors/timeouts stay held. Historical provider rejections require explicit administrator confirmation plus a complete Auth-directory check showing no existing sign-in. Recovery uses the ordinary session, exact attempt/player/email and actor, changes no accounts, and sends no email. Every retry requires a new review/Send action and rotates the reservation UUID so a stale result cannot release a newer attempt. Do not raise provider limits or automatically retry. A rate-limited reservation sent no email, so the next reviewed claim may use the player's corrected live roster email (never another player's attempted email). Only the administrator who started an attempt can mark it rejected; others see an explicit message.


October 1 owner review updates: RBI is no longer shown or entered anywhere (team totals, profiles, exit reports, manual game logs); saved RBI values and the QPA source mapping stay intact, and previously saved logs remain valid. Height comes only from RENPHO: manual Testing entry no longer offers height and Team Progress hides earlier manual height readings without deleting them. Team Progress treats changes under 1% of the previous result as Steady (neutral color, separate count). Leaderboards stay inclusive with no sample minimums; an optional Everyone/Pitchers/Position Players filter and name/jersey search narrow visible rows while ranks, bars and team averages still use the full board. Analytics numbers same-named weekly Blast sources as Blast Week 1, 2… (no report dates). Pitch Design lists only pitchers/two-way players and Swing Design only position/two-way players, through one searchable picker. Spin displays as whole RPM everywhere (calculations keep full precision); other Full Swing values keep one decimal. Sample labels are singular for one (1 walk). Home "Saved Fall Results" counts any saved result and is distinct from Data Coverage checklist tests; staff profile views use player-neutral wording.


October 1 visual refresh: player headshots come from the public goboxers.com baseball roster. Migration `202610010002_athlete_headshots.sql` stores only reviewed athlete → site-relative image paths (no names or URLs in Git; rows are added by the owner in the SQL Editor after reviewing name matches, including nicknames). Players without a roster photo show initials. Profiles read their own row under existing athlete RLS; boards use the `team_headshots()` code → path projection for active accounts, and pages request it only when the viewer can already see a team board (never for unlinked accounts). Images load from goboxers.com with no referrer. Visual changes are presentation only: hero tiles with percentile rings (gray for neutral body/spin) and repeat-test sparklines, a blue→red scale legend, bolder benchmark bands, a staff Home headline row with a coverage ring and two columns (needs attention / leaders), no staff shortcut tiles, compact empty states, 12px minimum text, brighter secondary text, a desktop icon-only sidebar toggle (browser-local), a light sidebar in light mode, and regrouped navigation (Team, Coaching, Data & Testing, Administration).

October 1 owner request: Coach Focus, Player Goals and Weekly Plans are hidden from profiles and Home and their readers are no longer called. Saved records, tables, RPCs and migrations stay intact so the features can return. Home "Retests Due" now counts players with no saved Fall result in 21+ days.


October 1 features: (1) `/athletes/[id]/report` is a printable one-page Fall report (browser Print → Save as PDF) using the same authorization and readers as the profile; it shows no contact details. (2) Staff Home and Team Game Stats draw team rate trend lines by rebuilding each saved `game_stat_snapshots` version with the existing team calculations (staff-only RLS, one point per sync date, pending rates skipped; snapshot rows are never modified). (3) Profile cards show "New Fall Best" when the latest Fall reading beats every earlier-dated reading of the same metric/source/unit within 21 days; neutral body/spin and timed tests are excluded. (4) `/top-performers` (staff; replaces Depth Chart) ranks current eligible hitters by PAC Production+, QPA%, OBP or ISO, and pitchers by WHIP, K/BB or Runs/9. The equal-weight team-percentile blend ranks complete same-snapshot lines, ties share ranks, missing values remain unranked, and sample sizes are shown; two-way players appear in both groups. `/depth-chart` remains a staff-guarded redirect. No testing/CSV sources are mixed into these game-stat tables. (5) Pitch Design has a printable scouting card (grip lab, MLB study and pickers are hidden in print).


October 2 design review fixes (presentation only): the Player Report is a light paper sheet in every theme with print-safe layout, real game sample labels (PA/AB/IP/pitches), Early sample tags, grouped rows, right-aligned numbers, outlined neutral badges, Pacific-time dates, a name-based PDF title and the full independent-project disclosure. Home: Roster Coverage tile, 2-column week cards on tablet, labeled phone hero button, tied leaders styled alike, PAC Production+ team tick, Early sample tags on leader rows, stacked data sources in narrow panels. Profiles: phone jersey chip, hero stripes follow the percentile, darker neutral percentile midpoint, all highlights shown, compact empty Biggest Jumps, ordinal percentiles, Import Results beside Player Report. Charts: trend lines red when improving and blue when worsening; pitch colors and marker shapes fixed per pitch type/family with matching legends and round-number ticks. Staff tools: readable Group Best badge, spaced header actions, What Changed panels, single-row view tabs, consistent heading weight and dark table headers, Team Progress scale label and faint steady bars, eyebrows matching sidebar groups (Coaching, Data & Testing).


October 2 second design review (Home, phone/tablet, accessibility/light mode, design system): every page eyebrow equals its sidebar group (Team, Coaching, Data & Testing, Administration); all stylesheets keep text at 12px or larger; the compact one-row header now applies up to 900px; the light-mode active sidebar link is solid brand red; neutral body/spin rings show a POS label and neutral percentile bars are gray; ordinals are correct in labels; trend lines announce formatted values and direction, and profile mini trends follow red-improving/blue-declining; Home drops the duplicate coverage tile, keeps week cards two across to 560px, uses one visual type per game card, flags unchecked weekly sources with a count; the sidebar highlights the exact page; leaderboard avatars share one size; legends use the marker midpoint.


October 2 review fixes: Top Performers uses current eligible (active/redshirt/null) 2026–27 roster identities and cumulative Fall game stats only; comparison still intentionally offers the full current-season roster. New Fall Best ignores weaker same-day sessions and compares only exact athlete/metric/source/unit/period. Team trends select the last source snapshot on each Pacific calendar day before calculating rates, so pending later versions cannot resurrect stale earlier points. Neutral body/spin changes use gray trend lines. Printable player reports preserve muscle mass, body fat and RENPHO Body Score, include five swing-weighted cumulative Blast practice averages (weekly P95 stays separate), and count omitted visible testing measurements. Blast bat-speed percentiles display only when their verified projection matches the report counts, dates and weighted average. The additive `202610020001_review_access_fixes.sql` restricts public team-photo projections to linked active players or active staff and the current eligible roster; own-player headshot table RLS is unchanged. It also returns the original attempted invitation email through the existing admin-only history RPC. Historical rejected-send review checks that original recipient; the next reviewed send uses the current roster email. Missing historical email disables recovery rather than substituting an address. This upgrade never sends invitations or changes accounts.

October 2 owner-requested blended Top Performers: one overall 0–100 score replaces individual-stat sorting. Hitters blend PAC Production+, QPA%, OBP and ISO at 25% each; pitchers blend WHIP, K/BB and Runs/9 at one-third each, reversing lower-is-better WHIP/Runs/9. Every component uses the same complete eligible discipline cohort and exact current source snapshot. Require at least five complete lines; tied components use the profile midrank percentile convention, and tied unrounded composites share competition ranks. Missing/duplicate/nonfinite/wrong-unit components and mixed snapshots never become zero or a partial reweighted score. K/BB remains missing at zero walks. Retain inclusive early samples, denominators and underlying stat explanations. Mobile metric selection changes the displayed stat, never the overall ranking. The method popover discloses equal weights, overlap and team-relative scope; this custom score is not a calibrated prediction or luck-adjusted talent grade. No source observations, saved rates, database access or account grants change; no migration needed.

October 4 owner-approved QPA layout update: the exact `2026 - Fall` grid is now 968 rows × 43 columns, captured in full as `A1:AQ968` (41,624 cells). Added columns AH:AQ were verified blank, and existing headers/player mappings are unchanged. Only the existing reviewed A:AC stat definitions import. Any content, formula, error or effective-only value in unused columns still requires review; any further grid change or partial capture fails. Pitching extent/limits remain unchanged. Capture hashes include the actual complete wider grid; do not rewrite prior hashes. The weekly Monday schedule remains unchanged. No source Sheet edits, new identities or access changes.


October 4 loading-speed update: profiles use a validated `?tab=` URL and load optional contacts/videos, movement screenings, annotations and history only for their visible tab. Overview remains the default; staff Measurement History is under Progress. Home reads Fall-only measurements through a request-local three-query queue, with unchanged cohorts, validation and the 20,000-row cap. Home and Team Game Stats stream optional historical trend charts after current stats. Trend readers fetch metadata first, then only each source's authoritative final Pacific-day snapshot within the existing 40-version window. Live authorization, View as restrictions, source definitions, stored readings and schedules remain unchanged; no migration or cross-request private cache is added. See [PERFORMANCE.md](docs/PERFORMANCE.md).

October 4 player scan update: profiles default to **Quick View**, with **Full Detail** beside the tabs. Full Detail retains supporting comparisons, all body indicators, movement screening and history according to the existing role rules. The hitter contact map adds a **Consistency** choice with separate exit-speed and launch-angle distributions, selected-session counts, average and middle-80% ranges. Home uses a compact ordinary-session coverage read, while detailed activity streams separately. Apply `202610040001_home_measurement_summary.sql` before this release. See [performance](docs/PERFORMANCE.md).


Full Swing EV now excludes low-speed Likely Foul contact (<70 mph, Direction beyond ±45°). Profiles offer Balls in Play / All Contact, retaining flagged readings for review without deleting source data.

Fall Blast practice metrics combine nonoverlapping weekly average reports by swing count across profiles, Analytics, staff comparisons and bat-speed rankings. Peak (95th-percentile) results remain weekly; saved source observations are unchanged.

## Private Boxer World Series Draft

Administration → Draft Board opens an owner-scoped draft room for the actual administrator, outside View as. It supports a reviewed two-team pool, separate captains and injured/student-assistant entries, position search, the sheet’s 1–2–2–1 snake order, confirmed picks, undo, print and CSV export. Progress saves to the signed-in owner only; no draft action changes athletes, accounts or performance data. See [Setup](docs/SETUP.md#private-boxer-world-series-draft) and [Data model](docs/DATA_MODEL.md#private-boxer-world-series-draft).

The private Draft Board includes two clickable baseball-field depth charts and a fully manual Big Board beside the draft. Captains and drafted players can fill starter/backup depth, including multiple spots for two-way players. Reorder ranks, filter/search players, or select directly from the board. Position fits follow the owner’s saved order. No performance scores or automatic rankings are shown or fetched. Save or discard ranking edits before making a pick.
