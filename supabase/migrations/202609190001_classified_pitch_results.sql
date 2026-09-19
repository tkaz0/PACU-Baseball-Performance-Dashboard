-- Reviewed Full Swing per-type summaries use existing staff import and own-athlete RLS.
-- Keep separate from overall velocity and fastball-only profile/leaderboard metrics.
insert into private.performance_metric_catalog(metric_key,metric_label,direction,body_metric,profile_metric,positive_only,percentage) values
('classified_max_velocity','Pitch Type Max Velocity','neutral',false,false,false,false),
('classified_avg_velocity','Pitch Type Average Velocity','neutral',false,false,false,false),
('classified_max_spin','Pitch Type Max Spin','neutral',false,false,false,false),
('classified_avg_spin','Pitch Type Average Spin','neutral',false,false,false,false),
('classified_pitch_count','Pitch Type Count','neutral',false,false,false,false),
('classified_velocity_count','Pitch Type Velocity Readings','neutral',false,false,false,false),
('classified_spin_count','Pitch Type Spin Readings','neutral',false,false,false,false);
insert into private.performance_metric_units(metric_key,unit) values
('classified_max_velocity','mph'),('classified_avg_velocity','mph'),
('classified_max_spin','rpm'),('classified_avg_spin','rpm'),
('classified_pitch_count','count'),('classified_velocity_count','count'),('classified_spin_count','count');
