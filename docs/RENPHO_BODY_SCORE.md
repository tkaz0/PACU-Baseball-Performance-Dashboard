# RENPHO Body Score

Profiles and Physicality leaderboards show the Body Score printed at the top right of the original RENPHO report. The raw numerator is stored as `body_score`, unit `points`, and displayed on the report’s /100 scale. Scores above 100 are retained. This is not a PACU composite or team percentile; no weights or imputed values are used.

The portrait image reader extracts a separate score region and requires an explicit Body Score label and /100 denominator. An unreadable score produces a review notice and does not block other valid measurements. If the score is unclear, staff may transcribe the printed number into an optional, explicitly labeled field and review it before saving. Leaving that field blank keeps the score empty. No digit substitutions are made by the reader. Score observations use fixed column 22 and source row 4001, preserving all prior observation positions (height remains column 21). Original reports can be reopened to add only missing scores through the existing reviewed import workflow.

The score appears on Overview and Physicality without entering strengths/weaknesses or manual testing categories. Leaderboards use latest exact source/unit/period readings and numbered ranks. Migration 202609090001 registers the metric in existing minimal projections without granting broader data access.

Validation covers exact extraction, ambiguous omission, stable provenance, raw values above 100, and ordinary player/coach leaderboard access. Original report evidence and backfill receipts stay outside the public repository.
