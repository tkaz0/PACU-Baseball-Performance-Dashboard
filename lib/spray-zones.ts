export const INFIELD_DISTANCE_FEET = 150;
export const MIDDLE_DIRECTION_DEGREES = 15;

export type SprayReading = { direction: number | null; distance: number | null };
export type SpraySide = "third" | "middle" | "first";

export function spraySummary(rows: readonly SprayReading[], bats: string | null | undefined) {
  const valid = rows.filter((row): row is { direction: number; distance: number } =>
    row.direction !== null && Number.isFinite(row.direction) && Math.abs(row.direction) <= 90 &&
    row.distance !== null && Number.isFinite(row.distance) && row.distance >= 0 && row.distance <= 1000);
  const battingSide = bats?.trim().toUpperCase() === "L" ? "L" : bats?.trim().toUpperCase() === "R" ? "R" : null;
  const fields = (["infield", "outfield"] as const).map(field => {
    const selected = valid.filter(row => field === "infield" ? row.distance < INFIELD_DISTANCE_FEET : row.distance >= INFIELD_DISTANCE_FEET);
    const sides: Record<SpraySide, number> = { third: 0, middle: 0, first: 0 };
    for (const row of selected) {
      const side: SpraySide = row.direction < -MIDDLE_DIRECTION_DEGREES ? "third" : row.direction > MIDDLE_DIRECTION_DEGREES ? "first" : "middle";
      sides[side]++;
    }
    const zones = battingSide === "R"
      ? [{ label: "Pull", count: sides.third }, { label: "Middle", count: sides.middle }, { label: "Opposite", count: sides.first }]
      : battingSide === "L"
        ? [{ label: "Pull", count: sides.first }, { label: "Middle", count: sides.middle }, { label: "Opposite", count: sides.third }]
        : [{ label: "Third-base side", count: sides.third }, { label: "Middle", count: sides.middle }, { label: "First-base side", count: sides.first }];
    return {
      field, count: selected.length, percentOfTotal: valid.length ? 100 * selected.length / valid.length : 0,
      zones: zones.map(zone => ({ ...zone, percentWithinField: selected.length ? 100 * zone.count / selected.length : 0 })),
    };
  });
  return { count: valid.length, missing: rows.length - valid.length, battingSide, fields };
}
