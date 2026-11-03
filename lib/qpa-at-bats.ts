/** The owner confirmed that legacy QPA AB totals already include subsequently added SF.
 * Recognize that exact accounting pattern (sheet AB + BB + HBP, plus any Sac Bunt, equals PA, as the sheet's own
 * Walks + HBP + Sac Bunt column does); do not subtract SF again from official AB.
 * Source observations remain immutable. Sheet HH% keeps its reviewed raw E-column rule.
 */
const sourceAB = "_qpa_sheet_ab";
export function qpaBattingCounts(values: ReadonlyMap<string, number>): Map<string, number> {
  const result = new Map(values);
  if (result.has(sourceAB)) return result;
  const ab = values.get("ab"), pa = values.get("pa"), bb = values.get("bb"), hbp = values.get("hbp"), sf = values.get("sac_fly"), sh = values.get("sac_bunt");
  if (ab !== undefined) result.set(sourceAB, ab);
  const counted = (value: number | undefined) => value !== undefined && Number.isSafeInteger(value) && value >= 0;
  if ([ab, pa, bb, hbp, sf].every(counted) && sf! > 0 && sf! <= ab! && (ab! + bb! + hbp! === pa! || (counted(sh) && sh! > 0 && ab! + bb! + hbp! + sh! === pa!))) result.set("ab", ab! - sf!);
  return result;
}
export function qpaSheetAB(values: ReadonlyMap<string, number>): number | undefined {
  return values.get(sourceAB) ?? values.get("ab");
}
