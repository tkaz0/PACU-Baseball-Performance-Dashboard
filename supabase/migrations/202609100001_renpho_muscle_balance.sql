-- Existing recorded skeletal muscle becomes a main profile/leaderboard metric.
update private.performance_metric_catalog set profile_metric=true where metric_key='skeletal_muscle_mass';
-- Segmental estimates remain private profile details, not peer leaderboard data.
insert into private.performance_metric_catalog(metric_key,metric_label,direction,body_metric,profile_metric,positive_only,percentage) values
('left_arm_muscle_mass','Left Arm Muscle Mass','neutral',true,false,true,false),
('right_arm_muscle_mass','Right Arm Muscle Mass','neutral',true,false,true,false),
('trunk_muscle_mass','Trunk Muscle Mass','neutral',true,false,true,false),
('left_leg_muscle_mass','Left Leg Muscle Mass','neutral',true,false,true,false),
('right_leg_muscle_mass','Right Leg Muscle Mass','neutral',true,false,true,false)
on conflict (metric_key) do nothing;
insert into private.performance_metric_units(metric_key,unit)
select metric_key,unit from private.performance_metric_catalog cross join (values ('lb'),('kg')) as units(unit)
where metric_key in ('left_arm_muscle_mass','right_arm_muscle_mass','trunk_muscle_mass','left_leg_muscle_mass','right_leg_muscle_mass')
on conflict do nothing;
