-- Add explicit reviewed testing metrics; preserve all prior values, identities,
-- source labels, role gates and permissions. Generic Bat Speed is not max/average.
insert into private.performance_metric_catalog
  (metric_key,metric_label,direction,body_metric,profile_metric,positive_only,percentage) values
  ('grip_strength','Grip Strength','higher',true,true,false,false),
  ('max_bat_speed','Max Bat Speed','higher',false,true,false,false),
  ('avg_bat_speed','Average Bat Speed','higher',false,true,false,false),
  ('smash_factor','Smash Factor','higher',false,true,false,false),
  ('max_distance','Max Distance','higher',false,true,false,false),
  ('infield_velocity','Infield Velocity','higher',false,true,false,false),
  ('outfield_velocity','Outfield Velocity','higher',false,true,false,false),
  ('avg_pitch_velocity','Average Pitch Velocity','higher',false,true,false,false);

insert into private.performance_metric_units(metric_key,unit) values
  ('grip_strength','lb'),('grip_strength','kg'),('grip_strength','N'),
  ('max_bat_speed','mph'),('max_bat_speed','km/h'),('max_bat_speed','m/s'),
  ('avg_bat_speed','mph'),('avg_bat_speed','km/h'),('avg_bat_speed','m/s'),
  ('smash_factor','ratio'),('max_distance','ft'),('max_distance','m'),
  ('infield_velocity','mph'),('infield_velocity','km/h'),('infield_velocity','m/s'),
  ('outfield_velocity','mph'),('outfield_velocity','km/h'),('outfield_velocity','m/s'),
  ('avg_pitch_velocity','mph'),('avg_pitch_velocity','km/h'),('avg_pitch_velocity','m/s');
