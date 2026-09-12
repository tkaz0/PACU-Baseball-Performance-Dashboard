-- Reviewed September 12 QPA extension. No permission or ownership changes.
insert into private.game_metric_columns(source,metric,source_column) values
 ('qpa_fall_2026','sb',27),('qpa_fall_2026','gdp',28)
on conflict (source,metric) do nothing;
