/** The owner confirmed that legacy QPA AB totals already include subsequently added SF.
 * Recognize that exact accounting pattern; do not subtract SF again from official AB.
 * Source observations remain immutable. Sheet HH% keeps its reviewed raw E-column rule.
 */
const sourceAB = "_qpa_sheet_ab";
export function qpaBattingCounts(values: ReadonlyMap<string, number>): Map<string, number> {
  const result = new Map(values);
  if (result.has(sourceAB)) return result;
  const ab = values.get("ab"), pa = values.get("pa"), bb = values.get("bb"), hbp = values.get("hbp"), sf = values.get("sac_fly");
  if (ab !== undefined) result.set(sourceAB, ab);
  if ([ab, pa, bb, hbp, sf].every(value => value !== undefined && Number.isSafeInteger(value) && value >= 0) && sf! > 0 && sf! <= ab! && ab! + bb! + hbp! === pa!) result.set("ab", ab! - sf!);
  return result;
}
export function qpaSheetAB(values: ReadonlyMap<string, number>): number | undefined {
  return values.get(sourceAB) ?? values.get("ab");
}
