/** Presentation names for reviewed BDL Full Swing exports (September 11 and September 26).
 * Saved original filenames, file hashes and observation provenance remain unchanged.
 */
const BDL_DATES: Record<string, string> = { "2026-09-11": "September 11th", "2026-09-26": "September 26th" };
export function fullSwingFileLabel(original: string, source: string, date?: string): string {
  if (/^full swing\s*·\s*(game|intrasquad|practice)(?:\s*·|$)/i.test(source.trim())) {
    const fromName = original.match(/^Session_(2026-09-(?:11|26))_/i)?.[1];
    const day = (date && BDL_DATES[date] ? date : undefined) ?? fromName;
    if (day) return `BDL (${BDL_DATES[day]})`;
    if (/^BDL \(September 11th/i.test(original)) return "BDL (September 11th)";
  }
  return original.replace(/\.csv$/i, "");
}
