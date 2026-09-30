import { expect, it } from "vitest";
import { PLAYER_METRICS } from "@/lib/player-performance";
import { STAT_DEFINITIONS, statDefinition } from "@/lib/stat-definitions";

it("defines every profile metric consistently by key and display label",()=>{
  for(const metric of PLAYER_METRICS){expect(STAT_DEFINITIONS[metric.key]?.length).toBeGreaterThan(25);expect(statDefinition(metric.label)).toBe(statDefinition(metric.key));}
});
it("distinguishes strikeouts, strikes, total muscle mass and skeletal muscle",()=>{
  expect(statDefinition("strike_pct")).toContain("total pitches");
  expect(statDefinition("k_pct")).toContain("batters faced");
  expect(statDefinition("muscle_mass")).toContain("separate from skeletal muscle");
  expect(statDefinition("Unconfirmed Team Field")).toContain("has not been confirmed");
});

it("resolves original report labels to the same definitions",()=>{expect(statDefinition("Body Fat Percentage")).toBe(statDefinition("body_fat_pct"));expect(statDefinition("Max Exit Velocity")).toBe(statDefinition("max_exit_velocity"));});

it("explains correlation and chart scope without confusing hitter and pitcher contact rules",()=>{
  expect(statDefinition("pearson_r")).toContain("−1");
  expect(statDefinition("r_squared")).toContain("second stat");
  expect(statDefinition("spray_chart")).toContain("150-foot");
  expect(statDefinition("pitch_arsenal_chart")).toContain("assigned by the staff");
  expect(statDefinition("pitching_contact_chart")).toContain("do not use the hitter chart’s 90 mph");
});

it("covers all imported game, Blast and classified pitch fields without a generic fallback",async()=>{
 const { GAME_METRIC_COLUMNS }=await import("@/lib/game-import");
 const { GAME_METRIC_LABELS }=await import("@/lib/game-metrics");
 const { BLAST_ALL_METRICS }=await import("@/lib/blast-metrics");
 const { CLASSIFIED_METRICS }=await import("@/lib/imports/classified-pitch-results");
 const { RENPHO_SEGMENTS }=await import("@/lib/renpho-segments");
 const keys=[...Object.values(GAME_METRIC_COLUMNS).flatMap(Object.keys),...Object.keys(GAME_METRIC_LABELS),...BLAST_ALL_METRICS.map(m=>m.key),...CLASSIFIED_METRICS.map(m=>m.key),...RENPHO_SEGMENTS.flatMap(m=>[m.key,m.label])];
 for(const key of keys){expect(statDefinition(key),key).not.toContain("This is a recorded field");expect(statDefinition(key).length,key).toBeGreaterThan(25);}
 for(const m of BLAST_ALL_METRICS)expect(statDefinition(m.label),m.label).toBe(statDefinition(m.key));
});
it("resolves RENPHO report aliases and analytics pitch-family labels without changing the stored fields",()=>{
 for(const key of ["body_fat_mass","bone_mass","protein_mass","body_water_mass","fat_free_mass","subcutaneous_fat_pct","skeletal_muscle_pct","body_water_pct","protein_pct","bone_mass_pct","smi","whr","BMR","Metabolic Age","Visceral Fat","fb_strike_pct","bb_pitch_family_strike_pct","ch_strike_pct"])
  expect(statDefinition(key),key).not.toContain("This is a recorded field");
 expect(statDefinition("fb_strike_pct")).toContain("family");
 expect(statDefinition("baf")).toContain("has not been confirmed");
});
