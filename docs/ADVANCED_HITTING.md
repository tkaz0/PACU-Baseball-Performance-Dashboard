# Advanced hitting metrics

## Available now: SB/PA

Personal and staff team Game Stats show stolen bases divided by plate appearances, to three decimals, with the recorded PA count and a stat-info definition. Four steals in 40 PA displays 0.100. This measures steal frequency, not stolen-base success or opportunity efficiency. Multiple steals can follow one PA, and pinch running can add steals without a PA; do not cap the ratio at one. Success rate would require caught stealing.

The individual ratio requires unique nonnegative counts from one athlete's current QPA snapshot and PA > 0. A missing denominator stays absent. Team SB/PA uses summed SB / summed PA, not an average of individual ratios, and requires complete constituent counts. No new stored measurements or database migration are introduced. The eight requested Analytics metrics and curated leaderboard/comparison RPCs remain unchanged; SB/PA currently has no new percentile projection.

## Available estimates and team-relative production

The September 28 owner clarification establishes HH Extra Base Hit as all doubles/triples, excluding Pumps (home runs). Base Hit includes every hit. The app now provides conservative **Est. SLG**, **Est. ISO**, **Est. wOBAcon**, and **PAC Production+ (Est.)**, with formulas, reference weights, validity guards and source permissions in [DATA_MODEL](DATA_MODEL.md#september-28-estimated-hitting-value-and-pitching-efficiency).

These metrics lead Overview, Home summaries and game rankings. The team-relative index uses a pooled eligible-team reference of 100, not a calibrated runs-created model. Combined doubles/triples are treated as doubles; no triple share is invented. Est. wOBAcon measures recorded contact outcomes, not expected contact quality or luck adjustment. Existing Full Swing exit velocity, hard-hit and launch-angle charts provide separate evidence about contact.

Exact SLG/ISO/OPS and wOBA need the double/triple split and verified outcome conventions. True wRC+ additionally needs appropriate league/run/park context. No local expected-contact model is implied. The NWBB Stats glossary and Stat Leaders remain presentation references; their division calibration cannot simply be copied into Pacific Fall/intrasquad data.

References:

- [NWBB Stats glossary](https://nwbaseballstats.com/about#glossary)
- [NWBB Stat Leaders](https://nwbaseballstats.com/stat-leaders)
- [FanGraphs wOBA definition](https://library.fangraphs.com/offense/woba/)
- [FanGraphs wRC and wRC+ definition](https://library.fangraphs.com/offense/wrc/)
