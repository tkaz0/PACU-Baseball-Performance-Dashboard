# Stat ranges and coaches’ team view

The September 28 owner request adds five interpretation bands to stat information and expands the staff Game Stats page. These are display references, not changes to saved observations or leaderboard qualification.

## D3 reference

Source: [2025 Northwest Conference overall baseball statistics](https://nwcsports.com/stats.aspx?path=baseball&year=2025), retrieved September 28, 2026. This is a D3 conference reference, **not a national D3 distribution**. The published tables contain nine teams, 73 hitters and 27 pitchers. Our individual reference uses the 71 published hitters with at least 75 AB and all 27 published pitchers with at least 20 IP. These are our declared sample rules, not a claim about official NCAA qualification. The source’s published individual table may omit other players.

`scripts/prepare-nwc-benchmarks.py` parses an archived public HTML file and validates schemas, all nine team rows, hits/base totals, and exact baseball innings. It emits only aggregate cutoffs, means and population counts in `lib/nwc-benchmarks.json`. No names or row-level data are committed. To reproduce: fetch the cited public HTML with a browser user agent, then run the script with HTML input and JSON output paths.

Bands split numerical distributions at linearly interpolated 20th, 40th, 60th and 80th percentiles. Cutoffs are rounded to the displayed precision before classification. Equality belongs to the numerical band beginning at a cutoff; lower-is-better metrics then reverse that band. Ties may leave an intermediate band empty. If every cutoff is the same, an equal result is Average; the below/above endpoints remain descriptive. Poor/Below Average/Average/Good/Elite are **dashboard coaching labels**, not official NWC evaluations. Teams use team cutoffs; players use individual cutoffs. Full-season schedules differ from Fall intrasquads; reference grades do not establish predictive talent or remove sampling variation.

AVG, OBP, BB%, K%, HR%, SB/PA, K/9, BB/9, Runs/9, WHIP and K/BB use matching count definitions. NWC plate appearances for the three hitting percentages and SB/PA are AB + BB + HBP + SF + SH. Runs/9 uses every run, never ERA. K/BB omits zero-walk denominators. SLG, ISO and wOBAcon references are recalculated with the **same dashboard assumptions**: all doubles/triples count as doubles, and contact weights .882/1.252/2.037 are fixed rather than D3-fitted. They are not official conference SLG or wOBA grades.

## Pacific and vendor references

No reliable national D3 range is asserted for QPA%, the team’s HH% scoring rule, PAC Production+, tracking-device readings or timed tests. Identical source/unit/period ranking projections with at least five players can supply Pacific numerical cutoffs. Otherwise information panels explain the 0–20, 20–40, 40–60, 60–80, 80–100 percentile bands without fabricating absolute values. Small cohorts and ties limit interpretation; rankings remain inclusive.

The protected `/api/stat-benchmarks` reads only the existing signed-in ranking projection. It returns aggregate cutoffs/counts, never identities, links or individual rows. Unlinked players are denied. No service-role access, new peer-detail access or database changes are required. Requests are exact-source and unit/period scoped; game requests also partition the event ID. Ranges load only when opening a relevant info dialog, without adding an initial-page fetch.

Body size/composition, spin and angles get numerical Low/Below Average/Average/High/Very High bands; they are not health or universal performance grades. Counting stats explain opportunities instead of false good/bad cutoffs. Blast’s [official college guidance](https://blastmotion.com/products/baseball/) appears only for compatible average Blast units, never Full Swing, maximums or weekly P95. Angle windows depend on pitch location and intent.

## Staff team aggregation

Team rates pool numerator and denominator from the same complete player-period lines. Missing counts are never zero-filled. If only some lines are complete, a calculated rate shows `Recorded Subset` and exact used/total coverage; its opportunities apply only to those lines. Missing all eligible pairs leaves a dash. True conflicts, duplicates, mixed snapshots/hashes or potentially overlapping weekly/daily pitching periods still withhold affected rates. Raw totals and the hit-mix chart require complete matching inputs; totals never silently omit missing rows.

Hit mix shows singles, combined doubles/triples and HR as shares of recorded hits. Pitch-family strike bars use the sheet’s strikes/family pitches; they do not infer specific pitch labels. Staff breakdown adds power/approach and pitching rates. Players retain their own Game Stats route and existing narrow team rankings. No imports, source writes, permission grants or sample qualification changes are part of this update.
