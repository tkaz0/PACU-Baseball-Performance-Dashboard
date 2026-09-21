# Player performance profiles

This change adds shared private measurements, profile cards/history, and team comparisons. Missing data stays missing. The dashboard does not manufacture measurements or infer game results from empty sheets.

## Periods and latest readings

- **Fall 2026:** September 1–December 31, inclusive, for body, hitting, field-throwing and pitching metrics.
- **Earlier body testing:** June 1–August 31, inclusive, for body metrics only. It remains separate from Fall; baseball summer statistics are excluded.

Profiles display **Last Tested** with the actual latest date and show the requested **Athlete ID**. They do not use summer-baseline labels or duplicate older readings in the snapshot; older observations remain in measurement history.

These are calendar windows, not a claim that every date has occurred or has measurements. Each reading keeps its actual test date. Latest selection uses date descending, import time descending at millisecond precision, then file hash and observation ID ascending. History uses the reverse order. Different units and source protocols are not converted or pooled.

Shared measurement pages and comparison summaries both retain round-trip floating-point precision in JSON, including values with more than 15 significant digits. A summary attaches only to the exact athlete, metric, date, value, unit, source and period shown on the profile; raw values and derived percentages are not rounded for matching. Display rounding does not change the underlying measurements or cohort counts.

## Profile tabs

**Overview** opens first with relative team Strengths, Weaknesses and Biggest Jumps when reviewed tests support them. **Physicality** follows: Weight, Height and Grip Strength are the main values. Body Composition contains Body Fat % and total Muscle Mass, with full RENPHO charts below. Speed & Agility appears only for position and explicit two-way players; pitcher-only profiles omit these cards, insights and history rows without deleting saved measurements. **Hitting** leads with Max EV, Average EV, Max Bat Speed, Average Bat Speed, Smash Factor and Max Distance; it is hidden for pitcher-only profiles and retained for explicitly two-way players. **Throwing** uses explicit primary/secondary positions to show infield or outfield velocity, plus pitching metrics for pitchers and two-way players. An unknown position does not invent a throwing discipline. Game stats live in their separate team section and are not duplicated in player profile tabs. Longer measurement history remains optional.

The main display emphasizes the measured value, original unit and **Last Tested** date. Repeated import/provenance and unavailable-percentile messages are removed from the main canvas; optional source/method details remain inspectable. Status is hidden from the staff roster table without changing stored status or comparison eligibility. Staff name searches suggest matching current players as they type; Player views receive no staff directory search.

## Overview insight method

The Overview uses only the permitted, role-relevant metric cards already supplied to that profile. It does not fetch other players' observations, invent training advice or turn game-sheet totals into testing measurements.

- **Strengths:** up to three directional metrics at or above the 75th favorable team percentile, highest percentile first.
- **Weaknesses:** up to three directional metrics at or below the 25th favorable team percentile, lowest percentile first. These describe the player's position among the comparable measured teammates, not an absolute assessment of ability.
- **Biggest Jumps:** up to three favorable changes from the most recent earlier, distinct testing date for the same athlete, metric, source/protocol, unit and comparison period. They are ordered by relative improvement: favorable change divided by the earlier value, multiplied by 100. Raw before/after values and dates remain available; changes to percentage metrics use percentage points (`pp`). This ordering describes proportional changes and does not imply that unlike tests have equal athletic importance.

Strengths and Weaknesses require an available exact-cohort percentile with at least five comparable athletes, using the existing percentile method below. Height, weight, body fat, total muscle mass and fastball spin remain neutral numerical measurements; they never become Strengths, Weaknesses or Biggest Jumps. Directional grip strength, speed/agility, hitting and throwing tests can qualify when included in the profile's role layout. Results in the middle half of the team remain unclassified. The model also returns the number of metrics with valid team comparisons, so the empty state can distinguish insufficient team testing from no qualifying strengths or weaknesses.

Biggest Jumps describe personal change and do not require a team cohort. Higher-is-better metrics must increase; lower-is-better times and walk percentage must decrease. An unchanged or unfavorable latest result is not a jump. The earlier value must be finite and strictly positive; a zero or decline is never skipped in favor of an older favorable comparison. Same-date reimports are not improvements: the existing latest selection and date/import-time/file-hash/observation-ID tie-breaks determine the one reading used for each date. Different testing periods, sources and units never mix, even when values could be converted. Equal insight scores use the canonical metric order, and an insight appears only once per metric.

When these conditions are not met, the corresponding list stays empty. One body-composition report alone cannot establish a player's athletic strengths, weaknesses or progress.

## Profile metrics

| Group | Metric | Definition / input | Units | Comparison direction |
| --- | --- | --- | --- | --- |
| Body | Height | Reviewed measured height | in, cm | Neutral |
| Body | Weight | Reviewed body weight | lb, kg, st | Neutral |
| Body | Grip strength | Explicitly reviewed dynamometer value and protocol | lb, kg, N | Higher |
| Body | Body fat % | Reported body-fat percentage | % | Neutral |
| Body | Muscle mass | Recorded total muscle mass; never skeletal muscle or a relabeled percentage | lb, kg | Neutral |
| Hitting | Max EV | Source's reviewed maximum exit velocity for its stated session/sample | mph, km/h, m/s | Higher |
| Hitting | Average EV | Source's reviewed mean exit velocity for its stated session/sample | mph, km/h, m/s | Higher |
| Hitting | Bat speed | Legacy generic source reading; never relabeled as a maximum or average | mph, km/h, m/s | Higher |
| Hitting | Max / Average bat speed | Separately reviewed session summaries | mph, km/h, m/s | Higher |
| Hitting | Smash factor | Explicit source-reported ratio; no calculation from unrelated averages | ratio | Higher |
| Hitting | Max distance | Reviewed session maximum hit distance | ft, m | Higher |
| Hitting | Home to 1st / Home to 2nd | Elapsed times under the named testing protocol | s | Lower |
| Hitting | Steal break / Boxer T | Elapsed times under the named testing protocol | s | Lower |
| Field throwing | Infield / Outfield velocity | Separate reviewed throwing protocols; never substituted for pitch velocity | mph, km/h, m/s | Higher |
| Pitching | Average velocity | Reviewed mean pitch velocity for its stated session/sample | mph, km/h, m/s | Higher |
| Pitching | Max velocity | Source's reviewed maximum pitch velocity for its stated session/sample | mph, km/h, m/s | Higher |
| Pitching | Average fastball spin | Source's reviewed mean fastball spin for its stated sample | rpm | Neutral |
| Pitching | Strike % | Strikes ÷ pitches × 100 | % | Higher |
| Pitching | K % | Strikeouts ÷ batters faced × 100 | % | Higher |
| Pitching | BB % | Walks ÷ batters faced × 100 | % | Lower |

Max/average labels describe approved source summaries; the importer does not calculate them from arbitrary event rows or average precomputed percentages. Strike/K/BB denominators must be verified by the source adapter. Percentage inputs are percentage points: `50` means 50%, while `0.5` means 0.5%; no automatic fraction scaling occurs. Height, weight and elapsed times must be positive; other readings must be finite and nonnegative, and percentages must be 0–100. No athletic or medical reference ceilings are invented.

**Pitching-sheet naming exception:** the existing Pitching Stats `FALL` sheet labels strikes/pitches as **K%**. The game adapter maps verified strikes/pitches to `strike_pct`. PACU's profile **K %** means strikeouts/batters faced and must come from verified strikeout and batters-faced counts. A generic header match must not reinterpret the source column. The selected QPA source remains only `2026 - Fall`; its cumulative snapshots and recorded pitching events appear in the separate [game-stat workflow](GAME_STATS.md), not as daily physical/testing observations.

## Percentile bars

The explicit cohort is athletes with an `athlete_seasons` row for `2026-27` and status null, active or redshirt. Inactive, alumni and other-season entries are excluded. A player type is not required when a comparable metric exists.

Use one latest observation per measured cohort athlete for the exact metric, unit, period and source/protocol. Source comparison trims/collapses whitespace and ignores case; distinct protocols must have distinct source labels. Body June–August and September–December observations never share a cohort calculation. The target athlete must belong to the cohort. A percentile appears only when at least **five** comparable athletes are measured; otherwise no percentile bar is shown. The method detail explains the minimum without repeating it on each card.

For `n` comparable athletes, ascending tied rank is `100 × (below + (equal − 1) / 2) / (n − 1)`, including the target. Lower-direction metrics and Body Fat % invert this value. Body Fat % therefore ranks lower readings higher, matching the leaderboard. Its metric direction stays neutral for insight eligibility. The hosted neutral body-fat summary returns ascending rank; the profile adapter reverses it once, while local cohorts calculate the same descending rank directly. Neutral body metrics and fastball spin show numerical position only: a larger percentile is not a health target, a better body composition or inherently better pitching.

The private summary RPC accepts only the authorized athlete UUID. Its periods, metrics and cohort are fixed. For this profile RPC, Players receive their own values and aggregate comparison results, never raw peer measurements; they cannot supply thresholds to probe peers. Admin View as also restricts the returned athlete before invoking the RPC.

## Team leaderboards

The owner separately authorized **all active signed-in players and staff** to see team leaderboard values, including physicality. The dedicated leaderboard RPC exposes a minimal latest-result projection and does not expand normal peer profile/history/contact access. Leaders use one latest comparable reading per eligible athlete, exact metric/unit/source/period choices, tied places and actual measurement dates. Neutral body/spin tables show numerical comparisons without a good/bad score. A leaderboard can show recorded results before five players have tested; the five-player minimum still applies to percentile bars. See [LEADERBOARDS](LEADERBOARDS.md).

## RENPHO details and retained percentage calculations

The existing supported raw RENPHO readings remain available for report bars, indicators and history, including mass values, BMI, BMR, visceral fat, SMI, metabolic age and waist-to-hip ratio. They do not all become main profile cards or receive percentiles.

Muscle mass percentage may be calculated as `muscle mass / weight × 100` only from exactly one valid weight and one valid muscle-mass reading belonging to the same athlete, file hash and date, with canonical RENPHO report-page provenance and matching lb or kg units. Muscle mass must not exceed weight. A reported muscle percentage in that report takes precedence; ambiguous pairs produce no derived reading. This calculation is labeled and retains both source readings. It does not write a synthetic observation to the database or substitute skeletal muscle mass.

## From browser review to shared profiles

The main **Information Imports** hub at `/imports` accepts supported RENPHO reports and explicitly mapped summary CSVs, uses the live roster, and saves reviewed readings directly to profiles. Admins and Coaches can use it, including an active Admin in Coach View as. Player View as cannot import. See [INFORMATION_IMPORTS](INFORMATION_IMPORTS.md).

Existing browser backups can still be shared separately:

1. An active Admin outside private View as reviews the original report locally, approves its athlete/date/values/units, and exports a private browser-workspace backup. Backup export remains Admin-only.
2. As an active Admin or Coach, including interactive Coach View as, open **Shared measurements** (`/admin/performance`) and choose the reviewed backup. The file is parsed on the device; the UI accepts up to 2 MiB.
3. Inspect exact shared-athlete matches, supported readings and explicitly listed unsupported metrics. Invalid recognized metrics/units/values/provenance block sharing. A reviewed transaction supports 1–500 observations. Both the posted Measurement JSON and normalized database JSON must fit within 1 MiB.
4. Approve **Share with team**. Only the eleven whitelisted Measurement fields are serialized; images, OCR/report text, unknown backup properties, local report IDs and the full backup are excluded.
5. The server rechecks active Admin/Coach access and input, then imports through the ordinary user's session. SQL matches permanent athlete codes, checks canonical metrics/units and dates, preserves source observation IDs, and saves the batch atomically. Identical repeats are unchanged; conflicting observations reject the whole transaction. A renamed-file retry preserves the original filename and import provenance.

Private players read only their linked profile; coaches/admins can read the team. Shared observations are immutable through normal app writes. Clearing a browser workspace does not remove shared data, and restoring a browser backup does not automatically publish it.

## Account preparation is separate

**Team account preparation** (`/admin/rollout`) displays player readiness and stores reviewed coach names/contact emails. A preparation record is not an Auth user, does not grant a Coach role, and sends no invitation. **Account connected** verifies the trusted link/status, not completed password setup. The owner has said not yet to team emails. Keep sends disabled and unsent until explicit approval through the separate Account access workflow. See [INVITATIONS](INVITATIONS.md).

## Coach presentation

Height cards and height leaderboard results display feet and inches, rounded to one tenth of an inch (for example, 71 in displays as 5′ 11″). The saved reading and unit remain unchanged in sources; calculations, ordering and comparison cohorts still use the original values and units. Missing main metrics display a dash and Not Yet Tested.

## Percentile presentation and corrections

Percentile bars use a blue-to-red scale, a numbered marker and a midpoint tick at 50. Blue means lower percentile and red means higher percentile, not a universal good/bad rating. The Overview shows the same verified, role-filtered comparisons and actual measurements/test dates. Missing and sub-five cohorts remain uncharted. Body and spin measurements remain descriptive and excluded from strengths, weaknesses and jumps.

Administrators outside View as can choose **Correct Recorded Weight** below a profile. Select the original reading, enter the replacement in its existing unit, review the player/date/value, and save. The database preserves the original observation privately and changes only its value; derived displays recompute. A retried save uses the same request and cannot apply twice. A stale reading is rejected. Reimporting an uncorrected source remains conflict-rejecting.

Profiles now display recorded total Muscle Mass in Body Composition and Overview. Its percentiles use only matching metric, unit, source and period with at least five eligible athletes. Legacy percentage calculations remain available internally and in existing stored history, but do not replace total mass or appear as a profile summary card. No unit conversion is introduced.

Game cards now reuse PercentileBar. Main QPA rates are AVG, OBP, QPA%, HH%, BB%, K%; count cards follow below, then additional raw counts. Comparisons are one current Fall cumulative QPA snapshot or the same pitching event, never pooled unrelated games. Matching value and snapshot evidence is checked before rendering. Batting BB% ranks higher first; batting K%/GDP rank lower first. Opportunity counts are descriptive and count rankings depend on playing opportunities. Hitting and throwing already share the Physicality percentile component; recorded results with fewer than five comparable players now explain when their bar will become available.

Home Run Rate (HR%) uses recorded Pumps / PA × 100, with a positive denominator and HR no greater than PA or recorded hits. Profiles and the signed-in Game Stats leaderboard use the same exact-cohort percentiles. This measures home-run frequency; ISO/SLG/OPS still require doubles and triples. Analytics retains its eight requested QPA variables. Deploy the compatible app before migration `202609120004_game_power.sql`; it changes no table data, account privileges or own-player access. Synthetic checks cover zero/missing/inconsistent inputs, SQL/JS agreement, ties and stale comparison rejection.

## Overview testing and game comparisons (September 13)

Overview groups Pacific percentile bars into Physicality, Game Stats, and available role-relevant Hitting/Athletic Testing and Throwing results. Physicality is exactly total Muscle Mass, printed RENPHO Body Score, and Body Fat %. Height and Weight remain in the Physicality tab but have no Overview percentile rows. The Body Score is no longer duplicated above the Overview summary. Existing personal RENPHO percentage changes remain beside the three physicality results.

Game comparisons reuse the already-authorized own-athlete rows and aggregate summaries. Each bar must match metric, source, event, current snapshot and value, have a finite 0–100 percentile and at least five comparable players. Missing/invalid comparisons never become bars. QPA uses current cumulative Fall results; pitching shows the latest dated event with an explicit date, never an invented combined percentile. SB/PA remains a recorded ratio without a percentile projection. Game update dates are distinct from Last Tested.

Strengths and weaknesses combine supported testing with batting rates (AVG, OBP, QPA%, HH%, HR%, BB%, K%) and pitching Strike %. These retain the 75th/25th percentile cutoffs, at most three items per section, denominator counts and limited-sample labels. Raw count ranks do not establish strengths/weaknesses because they depend on playing opportunities. Body metrics stay descriptive. Cumulative snapshots do not establish Biggest Jumps; that section still requires repeat comparable testing.

Personal game displays remove standalone batting Hits and AB cards, including the expanded additional totals. Dated batting rows replace their AB/H columns with AVG and its recorded AB sample size. Underlying counts, coach editing/review, team summaries, calculations, permissions and stored data remain unchanged.

## First-visit guide

Linked players receive a three-step profile guide on their first workspace visit in a browser. It explains profile tabs, blue/red percentile ranks, comparable sample sizes and test/update dates. A Guide button reopens it; Escape, Close or Got It dismiss it. The versioned per-account browser preference stores only `seen`, does not affect authorization, and does not sync across devices. Player View as offers the guide manually without automatically opening or dismissing the actual player's guide. Coaches/admins do not receive an automatic walkthrough.

### Visual test history and recorded game rates

Profiles show a compact Testing Progress chart on Overview and the matching Physicality, Hitting or Throwing tab when at least two distinct comparable dates exist. A measurement selector keeps the panel compact. Each series uses the latest result's exact athlete, metric, source, unit and testing period; no summer/Fall blending, derived readings, or conflicting same-day values. The date axis reflects elapsed time, the labeled vertical scale zooms to the recorded range, and expandable Chart Data provides exact dates and results. Single-test series stay hidden. Role filtering and own-player authorization remain unchanged. Only chart labels, source, period, dates and values enter the chart component, without file provenance.

Player and team game cards now show recorded AVG/OBP on a 0–1 scale and percentage rates on a 0–100% scale. These solid red rate tracks are explicitly labeled separately from blue/red percentile bars. Pending results, counts and unbounded SB/PA do not get rate tracks. Game snapshots remain cumulative totals, never inferred game histories. No data model, account or import changes are required.

### Overview presentation (September 16)

Strengths, Weaknesses and Biggest Jumps share a compact highlight row above the detailed percentile sections. Highlights use the same red/blue percentile colors with labeled badges and keep cohort and game opportunity counts; actual test dates and source-update dates remain in the detailed rows. Physicality and role-relevant testing stack together beside Game Stats on wide screens and become one column on phones. Insight eligibility, comparison cohorts and access rules are unchanged. The overview Last Tested summary includes the latest recorded timed trial, even when the fastest trial was earlier.

Two-way profiles label overview highlights by Hitting, Pitching, Athletic Testing and Position Throwing. The top-three selection and percentile eligibility are unchanged. Overview game percentiles use separate Hitting and Pitching panels with their own cumulative period and update date; measured pitching, position throwing, hitting and timed testing also have separate sections. The Game Stats tab separates cumulative hitting and pitching into distinct bordered sections.

September 16 running/grip update: profiles display only recorded metrics; unavailable metric cards are omitted and empty tabs use a short message. Steal Break, Steal Reaction and the 12–42 ft split are temporarily hidden from profile cards, insights, history and leaderboards; stored observations remain unchanged. The recorded 12 ft Steal Start remains visible. Dominant Grip and Non-Dominant Grip are separate physicality metrics and comparison cohorts, never inferred from generic grip or throwing hand. Leaderboards omit awaiting-testing lists.

### September 17: In-game and Practice
Every profile now has Overview, Physicality, In-game and Practice tabs. In-game contains separately labeled Full Swing Game/Intrasquad readings and the existing cumulative Fall game statistics. Practice & Testing contains other measurement sources under their original labels. Unknown labels are not inferred to be game sessions. Physicality and timed tests remain in Physicality. Pitcher-only profiles still omit hitting and timed tests, and two-way profiles separate hitting from pitching within each context.

Each source/unit has its own latest card, trend and exact-cohort percentile; a newer practice value cannot hide an earlier intrasquad value. The overview continues its compact latest-result summary. No raw events are combined with official cumulative game statistics, and no additional player access or database writes are introduced.


The In-game tab includes **Pitch Types · Velocity & Spin** from reviewed Full Swing summaries, displaying max/average mph and RPM with recorded sample sizes. It shows the latest recorded testing date, keeping separate files on that date distinct. These readings use the profile’s existing own-athlete access and are separate from cumulative game-sheet statistics. All Full Swing numerical result displays use one decimal; stored values and calculations retain original precision.


Classified pitch tables now respect their recorded Game/Intrasquad versus Practice source and appear only in the corresponding tab. Team leaderboards use the same context boundary; regular Hitting/Pitching/Blast testing stays Practice. Four-seam and two-seam fastballs retain distinct pitch types rather than being pooled under a generic fastball average.


## Fall Practice Summaries — September 20 Update

The owner chose a cumulative Fall Practice view, with bat speed, hand speed (the export’s Peak Hand Speed metric), attack angle, early connection and vertical bat angle as the five main measures. Weekly exports should contain only new swings with non-overlapping dates. `lib/blast-fall.ts` computes a display-only weighted average: sum of weekly average × reported swing count, divided by included swing counts. It never pools Full Swing with Blast, counts the paired P95 export again, or averages percentiles. Missing a metric in any included average report withholds that metric’s Fall average. Missing counts, duplicate reports, mixed athletes or overlapping average periods withhold the rollup for review. Original observations remain unchanged.

Own-player Overview shows five compact Fall-average cards. Practice shows those five cumulative averages beside the latest available week’s P95 values, with the peak reporting dates explicit. A Fall P95 cannot be reconstructed from weekly P95 summaries. Other Blast measurements remain saved for staff history but are no longer main profile cards. Weekly Blast percentile cards are replaced on profiles by the cumulative summary; no unverified cumulative team percentile is inferred from a weekly percentile. Existing leaderboard source partitions remain weekly reports. In-game and Practice bat-speed labels are explicit in profile cards, overview comparisons, highlights and trend labels.

Apply `202609200002_blast_period_guard.sql` after the compatible app. It blocks new overlapping report ranges for the same athlete and summary type via the existing ordinary staff save. Average and P95 paired ranges are allowed; identical retries keep existing behavior. It creates no account grants and changes no stored measurements. Dates are inclusive: the next report after September 13–20 should start September 21 or later.


Launch layout: the five Blast metrics use individual cards in Overview/Practice. Each prominently shows the weighted Fall average and unit; expanded Practice cards place the latest-week Peak (95th) separately below a divider with its report dates. Unsupported Fall peaks/percentiles remain absent. The signed-in Home is now an entry point; My Profile still opens the complete authorized player card.


September 20 hitting team averages: profile cards and Overview show source/unit-specific Full Swing comparisons (mean of each eligible player’s latest Fall result, including for maximum metrics). The five main Blast Practice comparisons pool non-overlapping average reports weighted by swing count, excluding incomplete player-metric rollups and paired P95 reports. Sample players/swings and covered dates are available under each comparison. The aggregate-only `hitting_team_averages` RPC checks active Player/Coach/Admin access and returns no identities or raw observations. Apply additive migration `202609200003_hitting_team_averages.sql` before deploying the consuming profile page. Tests cover context/unit separation, latest selection, weighted samples, negative angles, incomplete/overlapping periods, cohort eligibility and own-player RLS.

## Capstone movement screening (September 21)
Physicality includes the latest reviewed Capstone screening for the selected athlete. September 15, 2026 is the owner-confirmed screening date; shoulder and hip range of motion is in degrees; ankle flexion and extension use the 1–5 rating scale. Other numeric checks use the owner's 1–5 scale (5 best). Explicit source red/amber/green flags take priority; unflagged 1–2 ratings are Watch, 3 Middle, and 4–5 Good. Unflagged ROM remains neutral. Color is paired with a text label. This is an assessor-recorded screening, not a RENPHO metric, team percentile, diagnosis or generated program. Staff can expand source references. Own-player access applies to every stored report; no peer leaderboard projection is added.

September 21 ankle correction: all four ankle values display in a separate paired Ankle Ratings table, never with degree symbols. Existing raw values, source flags and hashes are unchanged. Compact identity and measurement cards, grouped shoulder/hip tables, and larger overview labels improve profile scanning.
