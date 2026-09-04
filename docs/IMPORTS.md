# Import Center

Open **Import Center** from the dashboard sidebar. The first roster import replaces the fictional starter roster in this browser. No password is needed for this browser-local workflow.

## Roster

1. Export the roster sheet as CSV or Excel XLSX and choose **Master roster**.
2. Select its worksheet and header row. The ten observed roster headings (FirstName through Class) and the existing 16-field snake_case template are recognized. Other headings require explicit mapping.
3. Enter the season and review every mapped field. New athletes need first and last names. An existing permanent code is the strongest identifier; otherwise a unique roster email can match. New identities receive permanent `LOCAL-` codes. Names and jersey numbers never merge roster identities.
4. Select **Validate and preview**. Fix every rejected row, review field changes, check the approval box, and apply.
5. Export the roster with its athlete codes. Preserve those codes in future updates, especially for athletes without email. Repeating identical file bytes/sheet/season is blocked; changed files with neither codes nor emails can create new athletes.

Blank updates preserve existing values. Jersey zero is retained. Omitted athletes are not deleted. Roster rows never create login accounts, roles, or account links. Local codes are not automatically migrated to the private Supabase roster.

## Measurements

1. Choose **Measurements**, select CSV/TSV/XLSX, then the correct worksheet and header row.
2. Choose a source tag: RENPHO, Blast, Rapsodo, Full Swing, Player Metrics, or Other. These are source labels, not promises of verified vendor-specific parsers. Use actual export columns and units from your device/report.
3. Match by permanent code, roster email, or exact full roster name. Review all name matches; manually select an athlete for unmatched/ambiguous identities only after verifying the source.
4. Select a date column and its explicit format (ISO, MM/DD/YYYY, or DD/MM/YYYY), or enter one known test date for the whole batch. Excel date cells are read using workbook date-system metadata. Dates are never inferred from a filename or sheet order.
5. Add each numeric metric, its name, and unit. Repeated trials/swings on separate rows remain separate observations. Blank measurement cells are skipped. Text, spreadsheet errors, formulas, inequalities, and percentage-formatted values require cleanup; do not treat them as zero.
6. Validate, inspect proposed values/matches/issues, approve, and save. Profiles show date, metric, value, unit, source file, worksheet, and source row. Filters separate metrics including their units; no unit conversion or fabricated trends occur.

A measurement observation is identified by file SHA-256, worksheet, original source row, and source column. Exact reimports add no duplicate values. Changing an existing observation's athlete/date/source/metric/unit/value requires removal of its earlier measurement batch. A modified file has a new hash: overlapping exports from different files may contain the same real-world event and require owner review. Verified vendor event IDs can improve this once actual exports are supplied.

The inspected Player Metrics workbook has trial tables, a summary, and rankings. Select raw trial measurements, exclude derived summary/ranking/average fields, and explicitly provide missing dates/units. Mixed-format height cells need normalization by the owner; no height conversion is guessed.

## Storage and transfer

Imports use IndexedDB on the dashboard's exact origin. They remain in this browser profile; another device or browser starts separately. Export the JSON backup from Import Center, keep it somewhere you control, then select **Restore workspace JSON backup** in the destination browser. Restoring replaces that browser's roster, measurements, and history after confirmation. A reset returns to fictional samples. Removing a measurement batch removes only its observations; roster history is retained.

Limits: 2 MiB input, 5,000 records including headers, 100 columns, 30 XLSX sheets, 1,000 local athletes, 20,000 measurement values, 1,000 batches. Workbooks are bounded before parsing; formula evaluation/macros are not executed. XLSX formulas are rejected in selected numeric fields rather than using stale caches. All source data is rendered as text.

PDF extraction, automatic vendor schema presets, direct Google Sheets sync, cloud measurement persistence, and team sharing are not implemented. Actual vendor sample exports are needed to verify specialized importers without inventing schemas.

## Dependencies and verification

XLSX uses SheetJS CE 0.20.3 from its [official distribution](https://docs.sheetjs.com/docs/getting-started/installation/frameworks/), pinned with lockfile integrity. The npm registry's older xlsx package is not used. The browser loads the XLSX module only when needed; files are never sent to a remote parser. [Parsing options](https://docs.sheetjs.com/docs/api/parse-options/) informed the bounded reader.

Unit tests cover parsing/mapping, identities, enums, dates, units, missing/zero/error values, duplicate/repeat handling, capacities, backup validation, and generated XLSX fixtures. Browser tests cover reviewed imports, reload persistence, invalid rows/name review, repeat imports, backup/restore, isolated contexts, and continued denial of protected routes. See [TESTING.md](TESTING.md).
