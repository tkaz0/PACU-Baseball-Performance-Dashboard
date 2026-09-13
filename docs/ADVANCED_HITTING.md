# Advanced hitting metrics

## Available now: SB/PA

Personal and staff team Game Stats show stolen bases divided by plate appearances, to three decimals, with the recorded PA count and a stat-info definition. Four steals in 40 PA displays 0.100. This measures steal frequency, not stolen-base success or opportunity efficiency. Multiple steals can follow one PA, and pinch running can add steals without a PA; do not cap the ratio at one. Success rate would require caught stealing.

The individual ratio requires unique nonnegative counts from one athlete's current QPA snapshot and PA > 0. A missing denominator stays absent. Team SB/PA uses summed SB / summed PA, not an average of individual ratios, and requires complete constituent counts. No new stored measurements or database migration are introduced. The eight requested Analytics metrics and curated leaderboard/comparison RPCs remain unchanged; SB/PA currently has no new percentile projection.

## Reviewed but not yet calculated

The NWBB Stats glossary and Stat Leaders presentation were reviewed on September 13, 2026. Its division-calibrated weights, concise metric labels, and contextual explanations are useful references; its league/park calibration cannot simply be applied to Pacific Fall/intrasquad data.

| Metric | Additional source requirements |
| --- | --- |
| ISO / SLG / OPS | Complete doubles and triples; total hits and HR alone do not determine total bases. |
| wOBA | Complete 1B/2B/3B/HR outcomes, BB/HBP and denominators, an intentional-walk convention, and documented weights appropriate to the chosen reference context. |
| wOBAcon | Complete contact outcomes and a documented contact denominator/weights. It excludes walks and strikeouts; it cannot be inferred from hard-hit categories. |
| wRC+ | Valid weighted offense plus a suitable comparison league/run environment and a documented park/context adjustment. A team-relative index would need a distinct name and explicit methodology. |

QPA's Base Hit is all hits, Pumps is HR, and the hard-hit columns overlap hitting outcomes. None may be reinterpreted as complete singles/doubles/triples. The added Sac Fly column supports OBP under the existing count-consistency check but does not fill missing hit types. No guessed weighted metric is shown in the app.

References:

- [NWBB Stats glossary](https://nwbaseballstats.com/about#glossary)
- [NWBB Stat Leaders](https://nwbaseballstats.com/stat-leaders)
- [FanGraphs wOBA definition](https://library.fangraphs.com/offense/woba/)
- [FanGraphs wRC and wRC+ definition](https://library.fangraphs.com/offense/wrc/)
