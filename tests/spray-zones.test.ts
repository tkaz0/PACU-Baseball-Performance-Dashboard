import { expect, it } from "vitest";
import { spraySummary } from "@/lib/spray-zones";

const rows = [
  { direction: -25, distance: 149.9 },
  { direction: 15, distance: 150 },
  { direction: 16, distance: 180 },
  { direction: null, distance: null },
];

it("splits recorded distance at 150 feet and computes within-field shares", () => {
  const right = spraySummary(rows, "R");
  expect(right).toMatchObject({ count: 3, missing: 1, battingSide: "R" });
  expect(right.fields[0]).toMatchObject({ field: "infield", count: 1, percentOfTotal: 100 / 3, zones: [{ label: "Pull", count: 1, percentWithinField: 100 }, { label: "Middle", count: 0, percentWithinField: 0 }, { label: "Opposite", count: 0, percentWithinField: 0 }] });
  expect(right.fields[1]).toMatchObject({ field: "outfield", count: 2, percentOfTotal: 200 / 3, zones: [{ label: "Pull", count: 0, percentWithinField: 0 }, { label: "Middle", count: 1, percentWithinField: 50 }, { label: "Opposite", count: 1, percentWithinField: 50 }] });
});

it("reverses pull for lefties and avoids assigning a pull side to switch hitters", () => {
  expect(spraySummary(rows, "L").fields[1].zones[0]).toMatchObject({ label: "Pull", count: 1 });
  expect(spraySummary(rows, "S").fields[0].zones.map(zone => zone.label))
    .toEqual(["Third-base side", "Middle", "First-base side"]);
});
