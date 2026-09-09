-- Enable existing recorded total muscle mass in exact-cohort profile summaries.
-- Deploy the compatible profile metric catalog before applying this migration.
-- Stored observations, units, ownership, table grants and RLS stay unchanged.
update private.performance_metric_catalog set profile_metric = true where metric_key = 'muscle_mass';
