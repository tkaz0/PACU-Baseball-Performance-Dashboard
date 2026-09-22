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
