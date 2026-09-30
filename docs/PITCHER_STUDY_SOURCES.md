# MLB pitcher study references

`lib/pitcher-study-references.ts` is a public-only snapshot retrieved on **September 29, 2026**. It contains 2025 MLB season pitch-type means and current MLB-listed height, weight, and throwing hand. It makes no runtime requests and contains no Pacific athlete data.

The complete verified reference cohort contains **368 pitchers: 267 right-handed and 101 left-handed**, with **1,519 supported pitch-type rows**. The editorial watch list selects **100 familiar names: 75 right-handed and 25 left-handed**. Familiarity is an editorial selection, not a performance ranking. Compute MLB body-size percentile positions from the complete 368-person cohort before filtering the watch list or throwing hand. Do not describe this restricted cohort as every MLB pitcher.

## Official sources and exact requests

All sources are public MLB services. The committed source metadata contains these URLs and SHA-256 digests of each response used.

| Data | Official source / exact request |
| --- | --- |
| Velocity means, mph | [Pitch Arsenals velocity CSV](https://baseballsavant.mlb.com/leaderboard/pitch-arsenals?type=avg_speed&year=2025&team=&min=500&csv=true) |
| Total spin means, RPM | [Pitch Arsenals spin CSV](https://baseballsavant.mlb.com/leaderboard/pitch-arsenals?type=avg_spin&year=2025&team=&min=500&csv=true) |
| Pitch usage percentages | [Pitch Arsenals usage CSV](https://baseballsavant.mlb.com/leaderboard/pitch-arsenals?type=n_&year=2025&team=&min=500&csv=true) |
| Classified pitch counts and independent usage check | [Pitch Arsenal Stats CSV](https://baseballsavant.mlb.com/leaderboard/pitch-arsenal-stats?type=pitcher&pitchType=&year=2025&team=&min=0&csv=true) |
| Savant season total `n` and source hand | Public `var data` JSON in the [same Pitch Arsenals page](https://baseballsavant.mlb.com/leaderboard/pitch-arsenals?type=avg_speed&year=2025&team=&min=500), parsed as JSON, never executed |
| Independent count/velocity check | [Pitch Movement CSV, four-seam example](https://baseballsavant.mlb.com/leaderboard/pitch-movement?year=2025&team=&p_throws=&pitch_type=FF&ze=z_score&inputs=1&min=0&csv=true); replace `FF` with each supported code below |
| Official regular-season total | [MLB season pitching stats](https://statsapi.mlb.com/api/v1/stats?stats=season&group=pitching&season=2025&gameType=R&limit=1500&playerPool=ALL), `numberOfPitches`, exact `gameType=R` |
| Listed size/name/hand | [MLB StatsAPI people](https://statsapi.mlb.com/api/v1/people), `?personIds=` followed by batches of at most 100 source IDs; fields `fullName`, `height`, `weight`, and `pitchHand.code` |
| Metric definitions | [Statcast CSV documentation](https://baseballsavant.mlb.com/csv-docs) and [MLB spin rate](https://www.mlb.com/glossary/statcast/spin-rate) |

Savant's season leaderboard requests use `year=2025`; their exposed form does not offer a game-type argument. Do not invent one and imply it was honored. The snapshot is restricted to the completed 2025 season and validates every retained pitcher's Savant season total against MLB's explicitly regular-season (`gameType=R`) total. Spring training, postseason, and 2026 data are not added.

MLB defines post-2017 Statcast velocity as out-of-hand pitch velocity in mph. Spin is total tracked spin rate in revolutions per minute; it is not active spin, movement, spin axis, or an effectiveness measure. Savant exports these means to one decimal mph and whole RPM. The snapshot preserves that published precision; it does not claim unrounded event precision.

## Inclusion and consistency checks

The velocity, spin, usage, and page-data queries each returned the same **478 unique pitcher IDs** at `min=500`. This is a season-total threshold, not a minimum per pitch type. The explicit `min=0` count and movement queries avoid relying on their default qualifiers; the local type-specific threshold is **50 pitches**.

For each source pitcher:

1. Join all sources by MLB person ID and verify the returned season is 2025. Reject duplicate pitcher IDs or duplicate pitcher/type count rows.
2. Require Savant's total `n` to equal both the official regular-season `numberOfPitches` and the sum of **all** classified pitch counts in Pitch Arsenal Stats, including types not retained for matching. Do not sum a filtered arsenal to manufacture a season total.
3. Require a parseable MLB-listed height and positive weight; keep `R` and `L` throwing hands only, checked against Savant's recorded throwing hand. Do not infer unknown handedness.
4. For each supported exact type with at least 50 classified pitches, require a positive published velocity. Verify that Pitch Movement's count and season total equal the count and total above, and its mean velocity exactly equals the Pitch Arsenals mean. Require the two usage percentages to agree within 0.051 percentage points, allowing their published one-decimal rounding.
5. Retain spin when present; absent spin is `null`, never zero or an estimate. Require at least one retained supported pitch per pitcher.

The source-total rule excluded **110 pitchers**, including some familiar names. Differences sometimes involved only one pitch; some were larger. Their cause was not assumed or repaired. Six otherwise eligible pitch/type rows failed the additional cross-source checks and were omitted. The final 368 pitchers all had valid listed size and hand. All 1,519 retained rows happened to have a published spin mean; nullable spin remains part of the contract for future snapshots.

`pitchCount` is a **classified pitch count**, not the number of valid velocity or spin readings. These aggregate endpoints do not publish independent valid-reading denominators for the two means. Count/usage agreement supports the source join but does not establish that every pitch had both metrics. `totalPitches` includes sparse and unsupported pitch types. `usagePercent` keeps the original all-pitch denominator and is not renormalized over the retained rows. The reference arsenal is therefore a supported study subset, not a claim that omitted pitches were never thrown.

## Exact type mapping

| Statcast code | Application pitch type |
| --- | --- |
| FF | Four-Seam Fastball |
| SI | Sinker |
| FC | Cutter |
| SL | Slider |
| ST | Sweeper |
| CU | Curveball |
| CH | Changeup |
| FS | Splitter |
| KN | Knuckleball |

No knuckleball row meets the final sample rule. Slurve (`SV`), forkball (`FO`), and screwball (`SC`) are excluded because the application has no exact corresponding label. Do not translate a generic `Fastball`, `Breaking Ball`, `Two-Seam Fastball`, or `Other` into a supported Statcast type. A sinker is not silently treated as a recorded two-seam fastball, and a sweeper is not silently treated as a slider.

## Interpretation boundaries

- Match the athlete's recorded throwing hand. There is no opposite-hand fallback.
- Body matching uses relative height and weight only. Current MLB roster listings are not 2025 measured sizes, body composition, limb proportions, or delivery mechanics. Pacific ranks must retain their existing source/unit/period-specific eligibility rules and minimum comparable sample; missing ranks stay absent.
- College Full Swing averages and MLB Statcast game averages come from different systems, populations, and samples. Raw velocity/spin distance is not a calibrated skill or player-similarity score. Any within-arsenal speed-gap or spin-pattern comparison is a descriptive custom study rule, not validated mechanical equivalence.
- Total spin alone does not identify pitch shape, effectiveness, intent, or a recommended grip. Do not manufacture movement, release metrics, mechanics, or training advice from this snapshot.
- Use the entire declared reference cohort for relative MLB size ranks, then apply exact handedness and featured-name selection. Missing or unsupported own-athlete pitches do not authorize inferred matches.
- Current MLB video searches can contain other seasons or interviews; links are study starting points, not verified 2025 examples of a particular pitch.

## Refreshing the snapshot

Use only the URLs above, and retrieve public people records for the source IDs. Some Savant requests required a normal `User-Agent` header to return their public CSV export. Parse CSV including the UTF-8 BOM. The people batch response hashes in the TypeScript metadata identify batches at source offsets 0, 100, 200, 300, and 400, in the returned velocity CSV order.

Run the same identity, season, total, per-type, range, missingness, and uniqueness checks before replacing data. Recalculate the declared counts and update dates, response hashes, and exclusions together. Assert all featured IDs occur exactly once in the complete pool. Do not keep a featured pitcher by filling failed data from memory, another year, another source's unmatched sample, or a different pitch type. Review any changed featured list as an editorial choice.

The committed snapshot was additionally checked for unique IDs, all 100 featured memberships, valid same-source throwing hands, positive sizes/counts, source-appropriate numeric ranges, unique types within each pitcher, and intact source totals. These data checks are separate from the application's matching and authorization tests.

## Dashboard interpretation and access

`/pitch-design` uses the same trusted render access and selected-athlete numerical reader as Swing Design. Players and Player View open only their linked profile; Admin/Coach may select an existing player from the minimal staff search projection. Position-only athletes have an empty state. No new database grants, reads of peer measurements, data writes, or account changes are introduced.

The server builds `lib/pitch-design.ts` from that single athlete's saved readings and canonical body cards. Mixed-athlete input fails closed. The Pacific current-day cutoff applies to both pitch and body readings. Game, Intrasquad, and Practice remain separate. `fallArsenalPitches` supplies existing complete-count Fall averages, explicitly labeled latest-average fallbacks, and Fall maxima with separate speed/spin sample counts. No pitch type is inferred or renamed by this feature.

Study suggestions use exact stored pitch types, confirmed throwing hand, and the 100 featured IDs. Require at least two shared types when the athlete has two or more specifically classified types; a one-pitch record can match on that one type. Shared-type count determines the first ordering. A custom tie refinement compares average-speed gaps (absolute gap difference / 10 mph, capped at 1) and log spin ratios (absolute log-ratio difference, capped at 1), averaged across comparable shared-pitch pairs. These pairs require complete-count Fall averages and the same source/date window; missing or latest-fallback averages cannot contribute. Velocity and spin each keep their own sampling windows. All available speed/spin relationship distances are averaged equally.

Size is descriptive: the player's protected canonical height/weight percentiles are ranks among the measured Pacific roster, while each MLB rank is the midrank within all 368 source-consistent references, before hand/featured filtering. Body composition and mechanical traits are not inferred from listed height/weight. Mean absolute percentile distance / 100 refines suggestions only when verified own ranks exist (minimum five comparable players). When both relationship and size evidence are available, the tie refinement uses 60% relationships and 40% size; otherwise it uses only available evidence. This ordering is a transparent custom study aid, not a calibrated similarity percentage, validated scouting grade, or projection. The client receives only three selected public reference cards, never the full cohort or raw private source rows/hashes.

`lib/pitch-grip-references.ts` links ten verified entries in Nate Rasmussen's [Pitch Grip Database](https://rasmussenbaseball.com/tools/pitch-grips), plus the original technique sources credited there. Catalog names and Shape filters identify entries because no stable per-entry anchors were verified. Short cues are original paraphrases; no source images or numeric grip-effect targets are reproduced. Grips are coach-reviewed experiments. Recorded spin rate does not establish active spin, movement, release, arm slot, current grip, or an ideal grip.
