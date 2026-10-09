import type { ImportTable } from "@/lib/imports/engine";
import type { FullSwingSession } from "@/lib/imports/full-swing-session";

export type ContactSquaredUpRow = { sourceRow: number; exitVelocity: number; squaredUp: number; potentialExitVelocity: number };

/**
 * Squared Up (0–1) and Potential Exit Velocity (mph) for each batted ball, read from the same CSV row.
 * The server accepts a row only when the saved contact's ExitSpeed equals the value sent here.
 * Missing, "null" or out-of-range cells are left out rather than estimated.
 */
export function contactSquaredUpRows(source: ImportTable, session: FullSwingSession): ContactSquaredUpRow[] {
  const squared = source.headers.indexOf("SquaredUp"), potential = source.headers.indexOf("PotExitSpeed");
  if (squared < 0 || potential < 0) return [];
  const cells = new Map(source.rows.map((row, index) => [source.rowNumbers[index], row]));
  const number = (value: string | undefined) => { const text = value?.trim() ?? ""; return /^-?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(text) ? Number(text) : null; };
  return session.contacts.flatMap(contact => {
    const row = cells.get(contact.sourceRow);
    const squaredUp = number(row?.[squared]), potentialExitVelocity = number(row?.[potential]);
    return squaredUp !== null && potentialExitVelocity !== null && squaredUp > 0 && squaredUp <= 1 && potentialExitVelocity > 0 && potentialExitVelocity <= 200
      ? [{ sourceRow: contact.sourceRow, exitVelocity: contact.exitVelocity, squaredUp, potentialExitVelocity }] : [];
  });
}
