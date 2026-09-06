-- OCR engines may group the same report field onto different source lines.
-- Canonical report fields are identified by file, page and fixed metric column.
-- Enforce that identity during the write itself, including stale/concurrent reviews.
-- Existing conflicting rows must be reviewed separately; this migration removes none.
create unique index performance_renpho_report_position_unique
on public.performance_measurements(file_hash, source_sheet, source_column)
where source = 'RENPHO' and source_sheet ~ '^RENPHO report · Page [1-9][0-9]*$';
