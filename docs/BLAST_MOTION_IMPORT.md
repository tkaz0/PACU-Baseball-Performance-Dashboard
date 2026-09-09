# Blast Motion CSV imports

Staff can select **Information Imports → Blast Motion** to upload reviewed session summaries. This first adapter accepts maximum and average bat speed, preserves the recorded speed unit, and saves through the existing Admin/Coach measurement action. Coach View has the same importer; Player View remains read-only.

No actual team Blast export has been supplied yet. The importer does not assume a vendor header layout, infer individual-swing averages, or support raw swing exports. The downloadable PACU template is our own blank summary format, not a claimed Blast export schema. Verify the first real export before adding any vendor-specific preset or raw-event aggregation.

Choose the header row, player identifier column (name, PAC code, or email), test date, metric columns, and units. Exact unique names can be reviewed; alternative names require an explicit roster selection. Dates are limited to Fall 2026. Duplicate player/date/metric summaries, invalid units/values, and averages above same-unit maxima block saving. Empty cells remain missing. Review and confirm every reading before saving.

Source is `Blast Motion · Hitting`, separate from Full Swing. File hash, sheet, source row, source column in observation ID, test date, and recorded values are retained. Existing atomic import, immutable-conflict and retry protections apply. No migration or new privileged credential is required.

Blast describes bat speed as sweet-spot speed at impact: [Blast metric reference](https://blastmotion.com/faq/). This defines the stat, not an assumed export schema. Definitions shown by the information icons describe the measures; they do not introduce training targets or health ratings.
