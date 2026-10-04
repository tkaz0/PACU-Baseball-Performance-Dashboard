begin;

-- JSON field names have a fixed bytewise contract. A database's locale must
-- not reorder assignments before assignmentVersion and reject valid reviews.
-- Replace only this comparison; retain validation, grants and atomic writes.
do $$
declare
  definition text := pg_catalog.pg_get_functiondef('private.validate_full_swing_publication(jsonb)'::regprocedure);
  original text := 'array_agg(k order by k) from jsonb_object_keys(p) k';
  canonical text := 'array_agg(k order by k collate "C") from jsonb_object_keys(p) k';
begin
  if position(canonical in definition) > 0 then return; end if;
  if position(original in definition) = 0 then
    raise exception 'Full Swing field validation changed; review before applying this repair';
  end if;
  execute replace(definition, original, canonical);
end $$;

commit;
