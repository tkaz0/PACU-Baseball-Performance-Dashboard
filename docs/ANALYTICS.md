# Coaching analytics

The existing PACU React dashboard owns this chart's rendering. `/analytics` is read-only and restricted by fresh ordinary-session Admin/Coach authorization, including Coach View. Player View is denied before team reads. No database migration or elevated key is used.

Chart contract: compare two dated numerical testing measures across eligible 2026–27 players; one point per player, with a scatterplot, original-unit numeric axes, and one least-squares line for visible points. No preset takeaway is asserted. Users choose the metric/source/unit independently for each axis. Variables populate from saved canonical measurements, including all RENPHO details and reviewed hitting/throwing/manual imports. Game-sheet cumulative totals are intentionally separate from dated tests.

Sources are read with exact-count bounded pages (1,000 roster entries and 20,000 observations maximum), deterministic ordering, duplicate detection, and strict parsing. Errors and provider truncation fail visibly rather than appearing as missing testing. Only active/redshirt/null-status roster members are included, with no emails, Auth links, RENPHO IDs, report images, or file names serialized to this screen.

Pairing: latest date per player/metric/source/unit within the chosen period; same-day ties use imported timestamp then immutable observation ID. Pair those two latest readings and apply the explicit maximum date gap, default 30 days. No older reading is substituted to force a match. Fall is September–December 2026; the separate June–August period permits body measures only. No unit conversion, cross-source pooling, fabricated zero, automatic outlier removal, or health target.

Color groups: class, primary position, player type, bats, throws, or whole team. Explicit blue/gold/orange/olive/pink palette, with circle/square/triangle distinctions for larger category sets. Labels, accessible point descriptions and exact-value tables supplement color. Missing group values appear as Not Listed. Class/position selectors and legend visibility recalculate the pooled fit and counts. Shapes/colors stay tied to the full roster's sorted group labels as filters change.

Math: centered/scaled ordinary least squares with an intercept and Pearson r; R² = r². Require at least five pairs and nonconstant X before fitting; constant Y gets a horizontal line with undefined r/R². Fewer than eight pairs carry an early-data note. Fit is drawn only over observed X and clipped to the plot, with a dashed neutral stroke. Padded focused axes are explicitly labeled. Correlation is exploratory, not causal or a performance/health rating. Related body-composition quantities may correlate mechanically.

QA: synthetic known positive/negative/zero-correlation relationships, unit invariance, constant axes, missing values, date-gap boundaries, source partitions, stable latest-selection, paging failures and authorization. Visual review uses a fictional dataset in the dashboard's own chart component at laptop and phone sizes. Hosted checks must not record real player measurements in screenshots or logs.

References: [NIST scatterplot guidance](https://www.itl.nist.gov/div898/handbook/eda/section3/scatterp.htm), [NIST correlation reference](https://www.itl.nist.gov/div898/software/dataplot/refman2/ch2/correlat.pdf).

September 12 scope: physicality selectors contain only height, weight, recorded RENPHO Body Score, total Muscle Mass and Body Fat %. Original detailed measurements remain stored. Current QPA counts and supported AVG/BB%/K% are separate game variables. QPA cumulative observations use Pacific snapshot dates with visible source/date disclosure; the selected date-gap rule still applies.

Current QPA list is exactly AVG, GDP count, batting BB%, HR, batting K%, QPA%, sheet HH%, and SB. OBP stays on profiles/leaderboards, as the owner requested this exact Analytics list. PA, AB, hits and RBI remain recorded but are not Analytics choices. Manual-testing height is omitted; canonical RENPHO height remains available. HH% follows the inspected QPA formula, with undefined or impossible ratios omitted.
