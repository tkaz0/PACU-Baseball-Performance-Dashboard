-- Keep dominant/non-dominant hand protocols separate. Existing generic grip stays unchanged.
insert into private.performance_metric_catalog(metric_key,metric_label,direction,body_metric,profile_metric,positive_only,percentage) values
('grip_dominant','Dominant Grip','higher',true,true,true,false),
('grip_non_dominant','Non-Dominant Grip','higher',true,true,true,false);
insert into private.performance_metric_units(metric_key,unit) values
('grip_dominant','lb'),('grip_dominant','kg'),('grip_dominant','N'),
('grip_non_dominant','lb'),('grip_non_dominant','kg'),('grip_non_dominant','N');
