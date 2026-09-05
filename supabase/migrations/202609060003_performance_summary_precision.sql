-- Keep float8 observations round-trip exact when the summary builds JSON.
-- Some API sessions use extra_float_digits=0, which rounds derived muscle
-- percentages and prevents their exact-value match to the player's reading.
-- This function-local setting preserves its existing search_path, privileges
-- and authorization checks and restores the caller's setting on return.
alter function private.performance_summary(uuid) set extra_float_digits = 3;
