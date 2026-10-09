import type { ImportTable } from "@/lib/imports/engine";
import { SESSION_METRICS, type FullSwingSession } from "@/lib/imports/full-swing-session";

export type ContactPitcherRow = { sourceRow: number; pitcherSummaryRow: number; pitcherMaxVelocity: number };

/**
 * Pairs each batted ball with its pitcher's summary row in the same file. No identity leaves the
 * browser: the server links a contact only when that summary row's saved Max Velocity (the staff
 * pitcher match) equals the value this CSV produces. Machine BP has no pitcher and yields nothing.
 */
export function contactPitcherRows(source: ImportTable, session: FullSwingSession): ContactPitcherRow[] {
  if (session.mode !== "Live at Bat") return [];
  const maxIndex = SESSION_METRICS.findIndex(metric => metric.key === "max_pitch_velocity");
  const pitcherRows = new Map<string, { row: number; max: number }>();
  let tableIndex = 0;
  for (const player of session.players) {
    if (!player.values.some(Boolean)) continue;
    const row = session.table.rowNumbers[tableIndex++];
    const max = Number(player.values[maxIndex]);
    if (player.role === "Pitcher" && player.values[maxIndex] && Number.isFinite(max)) pitcherRows.set(player.identity, { row, max });
  }
  const pitcherColumn = source.headers.indexOf("Pitcher");
  if (pitcherColumn < 0) return [];
  const pitcherBySourceRow = new Map(source.rows.map((cells, index) => [source.rowNumbers[index], cells[pitcherColumn]?.trim() ?? ""]));
  return session.contacts.flatMap(contact => {
    const pitcher = pitcherRows.get(pitcherBySourceRow.get(contact.sourceRow) ?? "");
    return pitcher ? [{ sourceRow: contact.sourceRow, pitcherSummaryRow: pitcher.row, pitcherMaxVelocity: pitcher.max }] : [];
  });
}
