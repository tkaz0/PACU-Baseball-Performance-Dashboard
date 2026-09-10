# Skeletal muscle and muscle balance

The owner subsequently removed Skeletal Muscle Mass from main profile cards, leaderboards and Testing choices. Recorded lb/kg values remain in the full report/history and Analytics; it is never relabeled total muscle mass, percentage, or a strength measure. Neutral percentile semantics and exact source/unit/period comparison remain unchanged.

A compact Muscle Balance section appears below Body Composition on private player profiles. It uses only the latest RENPHO report for that athlete. Arms and legs are separate paired zero-based bars with exact labels/values and a common scale within each pair. Trunk is a separate reading. Older readings are not silently substituted when the latest report lacks segments. No blank, invalid, duplicate, cross-player, cross-report or cross-unit values are compared.

The owner selected a 10% review setting on September 10, 2026. Difference = (larger − smaller) / larger × 100. At or above 10%, an amber Review Difference notice asks staff/player to verify and repeat under consistent conditions. This is a dashboard review flag, not a clinical cutoff, diagnosis, strength deficit, injury prediction or a training prescription. No good/bad colors or body targets are inferred.

The portrait reader isolates the Muscle Balance heading and five labeled subregions. A closer read isolates native label/mass pixels, removes colored annotations, and requires matching numeric text from two image scales (with only explicit Ib/space-separated 1b unit-glyph normalization). It reads only each first mass line with its explicit lb/kg unit, never the subsequent percentage or standard mass. Unreadable fields are omitted without blocking other measurements; the optional missing-fields form allows explicit staff transcription and unit selection before the ordinary review/save. Positions append at columns 23–27 and rows 5001–5005; all old positions remain stable. Reopening an original report can add only missing readings. Images and OCR remain browser-local.

Migration 202609100001 enables the existing skeletal-mass profile metric and registers five private segmental fields in the existing numeric import catalog. No new roles, grants or RLS access. Segmental fields remain outside the shared peer leaderboard projection. No notification emails.

Sources: https://renpho.com/pages/renpho-health-upgrade and https://renpho.com/products/morphoscan-nova-body-composition-analyzer document the segment fields; the layout is based on owner-supplied original reports. The 10% rule is owner-selected, not supplied by RENPHO.

Validation: parser/provenance/partial saves, reviewed transcription, missing/duplicate/mixed-unit exclusions, boundary and symmetric difference calculations, independent skeletal/total mass, coach imports and minimal player leaderboard/RLS coverage. Visual checks use fictional data only.
