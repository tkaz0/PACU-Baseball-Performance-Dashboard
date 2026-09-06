# Import Center

For direct shared profile uploads, open **Information Imports** from the dashboard sidebar; see [INFORMATION_IMPORTS](INFORMATION_IMPORTS.md). This document covers **Advanced Browser Imports** at `/preview/import`, which requires an active Admin or Coach, including interactive Coach View as; Player View as is blocked. The first Admin roster import replaces the fictional starter roster in that browser. Roster changes, backup restore/export and workspace reset remain Admin-only. A fresh Coach browser should use the shared hub and its live roster for imports.

## Roster

1. Export the roster sheet as CSV or Excel XLSX and choose **Master roster**.
2. Select its worksheet and header row. The ten observed roster headings (FirstName through Class), their observed spaced versions and snake_case template fields are recognized. The [local template](../public/templates/local-roster.csv) adds optional `renpho_id` as its 17th field. Other headings require explicit mapping; the protected administrator template remains unchanged.
3. Enter the season and review every mapped field. New athletes need first and last names. An existing permanent code is the strongest identifier; otherwise a unique roster email can match. New identities receive permanent `PAC-` codes. Names and jersey numbers never merge roster identities. Reviewed former `LOCAL-` aliases are retained for compatibility.
4. Select **Validate and preview**. Fix every rejected row, review field changes, check the approval box, and apply.
5. Export the roster with its athlete codes. Preserve those codes in future updates, especially for athletes without email. Repeating identical file bytes/sheet/season is blocked; changed files with neither codes nor emails can create new athletes.

Blank updates preserve existing values. Jersey zero is retained. In browser-local roster imports only, the observed `/` jersey placeholder means unassigned: new athletes get a blank jersey and existing jerseys are preserved. The placeholder does not apply to other numeric fields or the protected administrator CSV. Omitted athletes are not deleted. Roster rows never create login accounts, roles, or account links. Local codes are not automatically migrated to the private Supabase roster.

Optional RENPHO IDs are trimmed, uppercased and matched exactly. Use only 1–80 letters, digits, underscores or hyphens. Each ID can belong to one player; conflicts need explicit correction. Preserve permanent athlete codes even when names, emails or device report IDs change.

## RENPHO reports

1. Choose **RENPHO report** and select a full portrait PNG/JPG or one-page PDF, up to 10 MiB. Use the Body Composition Analysis Report layout supplied for this project, without cropping, rotation or camera perspective. Other layouts are not claimed as supported. The PDF/image reader and OCR run in this browser; the file is not uploaded.
2. Review the displayed report ID and test date. A uniquely saved exact RENPHO ID can propose a player; an unknown ID requires your selection. Check the selected player even for a match. Optionally remember that report ID in this browser for the selected player. IDs never create login accounts or change permanent athlete codes.
3. Compare every selected reading and unit with the original. Correct numeric OCR errors or uncheck readings you do not want. The reader supports Weight, Body Fat Mass, Bone Mass, Protein Mass, Body Water Mass, Muscle Mass, Skeletal Muscle Mass, BMI, Body Fat Percentage, Visceral Fat, BMR, Fat-Free Mass, Subcutaneous Fat, SMI, Metabolic Age and WHR. It excludes optimal ranges, classifications, device scores/targets and segmental charts.
4. Composition mass units come from the isolated measurement-column header. Other units must be printed in the reading or explicitly supported by the recognized layout: BMI uses kg/m², metabolic age uses years, visceral fat is a device index and WHR is a ratio. If the SMI superscript cannot be read and OCR returns only `kg/m`, the recognized layout can propose `kg/m²`, but you must check the separate unit confirmation against the original or uncheck SMI. A clearly isolated Fat-Free Mass `Ib`/`1b` OCR unit glyph may be normalized to `lb` with review evidence; numeric digits are not changed. Percentage values remain percentage points (for example, synthetic `15%` saves numeric `15` with unit `%`). No values are converted or interpreted.
5. Choose **Review import**, check the player/date/units/values confirmation, then save. Ambiguous duplicate metrics, invalid dates, unexpected column contents, missing layout anchors and unit conflicts block saving. Use a clearer export or explicit CSV/XLSX mapping if the reader cannot verify the layout. Editing an input invalidates the previous preview.

The first OCR load may take time. Original images/PDFs and extracted text are temporary review data; approved measurements and explicitly remembered IDs are saved in IndexedDB. No report images/text are included in a workspace backup. Each saved reading retains file/page/source-line provenance and its fixed metric column. Deselecting readings preserves observation IDs, and importing identical file bytes again does not create duplicates. A changed file may contain the same real-world test and still needs owner review.

The adapter is grounded in the supplied portrait report and [RENPHO's published report metric list](https://renpho.com/products/morphoscan-nova-body-composition-analyzer). RENPHO's [Health app FAQ](https://renpho.com/pages/faq-for-renpho-health-app) documents exporting records and unit settings, but does not provide a stable PDF/CSV schema. Synthetic parser tests establish validation behavior; they do not establish compatibility with every device/app version. Actual-sample browser verification is recorded separately in the testing receipt.

## Measurements

1. Choose **Other measurements**, select CSV/TSV/XLSX, then the correct worksheet and header row.
2. Choose a source tag: RENPHO, Blast, Rapsodo, Full Swing, Player Metrics, or Other. These are source labels, not promises of verified vendor-specific parsers. Use actual export columns and units from your device/report.
3. Match by permanent code, roster email, or exact full roster name. Review all name matches; manually select an athlete for unmatched/ambiguous identities only after verifying the source.
4. Select a date column and its explicit format (ISO, MM/DD/YYYY, or DD/MM/YYYY), or enter one known test date for the whole batch. Excel date cells are read using workbook date-system metadata. Dates are never inferred from a filename or sheet order.
5. Add each numeric metric, its name, and unit. Repeated trials/swings on separate rows remain separate observations. Blank measurement cells are skipped. Text, spreadsheet errors, formulas, inequalities, and percentage-formatted values require cleanup; do not treat them as zero.
6. Validate, inspect proposed values/matches/issues, approve, and save. Profiles show date, metric, value, unit, source file, worksheet, and source row. Filters separate metrics including their units; no unit conversion or fabricated trends occur.

A measurement observation is identified by file SHA-256, worksheet, original source row, and source column. Exact reimports add no duplicate values. Changing an existing observation's athlete/date/source/metric/unit/value requires removal of its earlier measurement batch. A modified file has a new hash: overlapping exports from different files may contain the same real-world event and require owner review. Verified vendor event IDs can improve this once actual exports are supplied.

The inspected Player Metrics workbook has trial tables, a summary, and rankings. Select raw trial measurements, exclude derived summary/ranking/average fields, and explicitly provide missing dates/units. Mixed-format height cells need normalization by the owner; no height conversion is guessed.

## Storage and transfer

Imports use IndexedDB on the dashboard's exact origin. They remain in this browser profile; another device or browser starts separately. Export the JSON backup from Import Center, keep it somewhere you control, then select **Restore workspace JSON backup** in the destination browser. Restoring replaces that browser's roster, measurements, and history after confirmation. A reset returns to fictional samples. Removing a measurement batch removes only its observations; roster history is retained.

Table limits: 2 MiB input, 5,000 records including headers, 100 columns and 30 XLSX sheets. The RENPHO image/PDF workflow has its own 10 MiB, one-page input limit and a 100,000-character/100-candidate parser cap. Workspace limits remain 1,000 local athletes, 20,000 measurement values and 1,000 batches. Workbooks are bounded before parsing; formula evaluation/macros are not executed. XLSX formulas are rejected in selected numeric fields rather than using stale caches. Source strings are rendered as text.

Shared numerical measurements and direct reviewed uploads are now implemented separately from this local workspace; see [INFORMATION_IMPORTS](INFORMATION_IMPORTS.md). Fall 2026 Google sheet snapshots are covered by [GAME_STATS](GAME_STATS.md). Additional report layouts and automatic vendor presets still require actual sample exports; no unverified vendor schema is assumed.

## Dependencies and verification

XLSX uses SheetJS CE 0.20.3 from its [official distribution](https://docs.sheetjs.com/docs/getting-started/installation/frameworks/), pinned with lockfile integrity. The npm registry's older xlsx package is not used. The browser loads the XLSX module only when needed; files are never sent to a remote parser. [Parsing options](https://docs.sheetjs.com/docs/api/parse-options/) informed the bounded reader.

Unit tests cover parsing/mapping, identities, enums, dates, units, missing/zero/error values, duplicate/repeat handling, capacities, backup validation, and generated XLSX fixtures. Browser tests cover reviewed imports, reload persistence, invalid rows/name review, repeat imports, backup/restore, isolated contexts, and continued denial of protected routes. See [TESTING.md](TESTING.md).
