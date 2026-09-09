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
