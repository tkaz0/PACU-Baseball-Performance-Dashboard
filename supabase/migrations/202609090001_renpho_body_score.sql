-- The owner's requested score is the printed RENPHO Body Score, never a PACU composite.
-- Register a recorded numerical metric within existing reviewed imports/RLS/projections.
insert into private.performance_metric_catalog(metric_key,metric_label,direction,body_metric,profile_metric,positive_only,percentage)
values ('body_score','RENPHO Body Score','neutral',true,true,false,false)
on conflict (metric_key) do nothing;
insert into private.performance_metric_units(metric_key,unit) values ('body_score','points') on conflict do nothing;
