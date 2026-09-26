import { FULL_SWING_SESSION_HEADERS, summarizeFullSwingSession, type FullSwingSession } from "@/lib/imports/full-swing-session";
import type { ImportTable } from "@/lib/imports/engine";

type Field = "RelSpeed" | "SpinRate" | "ExitSpeed" | "Angle" | "Direction" | "BatSpeed" | "Distance";
export const LOW_EXIT_VELOCITY_REVIEW_MPH = 72;
const FIELDS: { field: Field; label: string; unit: string; actor: "Pitcher" | "Batter"; low: number; high: number; floor: number }[] = [
  { field: "RelSpeed", label: "Pitch velocity", unit: "mph", actor: "Pitcher", low: 40, high: 110, floor: 8 },
  { field: "SpinRate", label: "Pitch spin", unit: "rpm", actor: "Pitcher", low: 700, high: 3500, floor: 750 },
  { field: "ExitSpeed", label: "Exit velocity", unit: "mph", actor: "Batter", low: LOW_EXIT_VELOCITY_REVIEW_MPH, high: 125, floor: 12 },
  { field: "Angle", label: "Launch angle", unit: "°", actor: "Batter", low: -50, high: 65, floor: 0 },
  { field: "Direction", label: "Field direction", unit: "°", actor: "Batter", low: -90, high: 90, floor: 0 },
  { field: "BatSpeed", label: "Bat speed", unit: "mph", actor: "Batter", low: 25, high: 95, floor: 12 },
  { field: "Distance", label: "Distance", unit: "ft", actor: "Batter", low: 0, high: 500, floor: 180 },
];
const RELATIVE_FIELDS = new Set<Field>(["RelSpeed", "SpinRate", "ExitSpeed", "BatSpeed", "Distance"]);
const HITTER_RELATIVE_MINIMUM = 3;
const PITCHER_RELATIVE_MINIMUM = 5;
const numeric = /^-?\d+(?:\.\d+)?$/;
const median = (values: readonly number[]) => {
  const sorted = [...values].sort((a, b) => a - b), mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
export type FullSwingReadingReview = {
  key: string; sourceRow: number; pitchNumber: string; identity: string; actor: "Pitcher" | "Batter"; field: Field;
  label: string; unit: string; raw: string; value: number | null;
  reason: string | null; blocking: boolean;
};
export const fullSwingValueKey = (sourceRow: number, field: Field) => `${sourceRow}:${field}`;

/** Advisory review only. Source readings remain unchanged until staff exclude a specific cell. */
export function inspectFullSwingReadings(table: ImportTable): FullSwingReadingReview[] {
  if (JSON.stringify(table.headers) !== JSON.stringify(FULL_SWING_SESSION_HEADERS)) throw new Error("This Full Swing layout differs from the reviewed Live at Bat sample.");
  const fields = FIELDS.map(spec => ({ ...spec, column: table.headers.indexOf(spec.field), actorColumn: table.headers.indexOf(spec.actor) }));
  const rows: FullSwingReadingReview[] = [];
  for (const [index, cells] of table.rows.entries()) {
    const sourceRow = table.rowNumbers[index];
    if (cells.length !== table.headers.length) throw new Error(`Row ${sourceRow}: incomplete Full Swing row.`);
    const machine = cells[table.headers.indexOf("Mode")].trim() === "Machine BP" && cells[table.headers.indexOf("Environment")].trim() === "Cage";
    for (const spec of fields) {
      if (machine && spec.actor === "Pitcher") continue;
      const raw = cells[spec.column].trim();
      if (!raw || raw.toLowerCase() === "null") continue;
      const value = numeric.test(raw) && Number.isFinite(Number(raw)) ? Number(raw) : null;
      const blocking = value === null || (spec.field === "Distance" ? value < 0 || value > 1000 : spec.field === "Angle" || spec.field === "Direction" ? Math.abs(value) > 90 : value <= 0 || (spec.field === "ExitSpeed" && value > 200));
      const reason = blocking ? "Invalid or outside the supported measurement range" : value < spec.low ? spec.field === "ExitSpeed" ? `Below ${LOW_EXIT_VELOCITY_REVIEW_MPH} mph — check contact or tracking` : "Unusually low — check the source" : value > spec.high ? "Unusually high — check the source" : null;
      rows.push({ key: fullSwingValueKey(sourceRow, spec.field), sourceRow, pitchNumber: cells[0].trim(), identity: cells[spec.actorColumn].trim(), actor: spec.actor, field: spec.field, label: spec.label, unit: spec.unit, raw, value, reason, blocking });
    }
  }
  const groups = new Map<string, FullSwingReadingReview[]>();
  for (const row of rows) if (row.value !== null && !row.blocking && RELATIVE_FIELDS.has(row.field)) {
    const key = JSON.stringify([row.actor, row.identity.toLowerCase(), row.field]);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  for (const group of groups.values()) {
    if (group.length < (group[0].actor === "Batter" ? HITTER_RELATIVE_MINIMUM : PITCHER_RELATIVE_MINIMUM)) continue;
    const center = median(group.map(row => row.value!));
    const spread = median(group.map(row => Math.abs(row.value! - center)));
    const floor = FIELDS.find(spec => spec.field === group[0].field)!.floor;
    const limit = Math.max(floor, 4 * 1.4826 * spread);
    for (const row of group) if (!row.reason && Math.abs(row.value! - center) > limit)
      row.reason = row.value! > center ? "Much higher than this player's other readings" : "Much lower than this player's other readings";
  }
  return rows;
}

/** Replace only reviewed metric cells with null, keeping every pitch number, player and CSV coordinate. */
export function omitFullSwingReadings(table: ImportTable, readings: readonly FullSwingReadingReview[], excluded: ReadonlySet<string>): ImportTable {
  const allowed = new Map(readings.map(row => [row.key, row]));
  for (const key of excluded) if (!allowed.has(key)) throw new Error("A removed reading no longer matches this CSV. Reload the original file.");
  const column = new Map(FIELDS.map(spec => [spec.field, table.headers.indexOf(spec.field)]));
  return { headers: table.headers, rowNumbers: table.rowNumbers, rows: table.rows.map((source, index) => {
    const cells = [...source], sourceRow = table.rowNumbers[index];
    for (const spec of FIELDS) if (excluded.has(fullSwingValueKey(sourceRow, spec.field))) cells[column.get(spec.field)!] = "null";
    return cells;
  }) };
}

/** Keep derived-summary coordinates stable when all of one player's readings are removed. */
export function summarizeReviewedFullSwingSession(table: ImportTable, readings: readonly FullSwingReadingReview[], excluded: ReadonlySet<string>): FullSwingSession {
  const unresolved = readings.filter(row => row.blocking && !excluded.has(row.key));
  if (unresolved.length) throw new Error(`${unresolved.length} invalid ${unresolved.length === 1 ? "reading needs" : "readings need"} removal before import review.`);
  const base = summarizeFullSwingSession(omitFullSwingReadings(table, readings, new Set(readings.filter(row => row.blocking).map(row => row.key))));
  const next = summarizeFullSwingSession(omitFullSwingReadings(table, readings, excluded));
  const identified = (session: FullSwingSession) => session.players.filter(player => player.values.some(Boolean));
  const coordinates = new Map(identified(base).map((player, index) => [JSON.stringify([player.role, player.identity]), base.table.rowNumbers[index]]));
  next.table.rowNumbers = identified(next).map(player => {
    const row = coordinates.get(JSON.stringify([player.role, player.identity]));
    if (row === undefined) throw new Error("The reviewed summary rows changed. Reload the original CSV.");
    return row;
  });
  return next;
}
