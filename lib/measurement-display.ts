/** Display only: stored values, import units and comparison cohorts stay unchanged. */
export function formatHeight(value: number, unit: string): string | null {
  if (!Number.isFinite(value) || value <= 0 || !["in", "cm"].includes(unit)) return null;
  const inches = unit === "cm" ? value / 2.54 : value;
  // Round before splitting so a rounded 12 inches carries into the next foot.
  const tenths = Math.round(inches * 10);
  if (!Number.isSafeInteger(tenths)) return null;
  const feet = Math.floor(tenths / 120);
  const remainder = (tenths % 120) / 10;
  return `${feet}′ ${remainder}″`;
}
