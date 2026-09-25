/** Presentation name for the six reviewed September 11 Intrasquad exports.
 * Saved original filenames, file hashes and observation provenance remain unchanged.
 */
export function fullSwingFileLabel(original: string, source: string, date?: string): string {
  if (/^full swing\s*·\s*(game|intrasquad|practice)(?:\s*·|$)/i.test(source.trim()) &&
    (date === "2026-09-11" || /^Session_2026-09-11_/i.test(original) || /^BDL \(September 11th/i.test(original)))
    return "BDL (September 11th)";
  return original.replace(/\.csv$/i, "");
}
