import { parseMeasurementDate, type ImportTable } from "@/lib/imports/engine";

// Exact layout observed in the owner-supplied September 2026 Live at Bat export.
export const FULL_SWING_SESSION_HEADERS = ["PitchNo", "Date", "Time", "Pitcher", "PitcherId", "PitcherThrows", "PitcherTeam", "Batter", "BatterId", "BatterSide", "BatterTeam", "RelSpeed", "SpinRate", "ExitSpeed", "Angle", "Direction", "BatSpeed", "HitSpinRate", "Distance", "SmashFactor", "PotSmashFactor", "PotExitSpeed", "SquaredUp", "Environment", "Mode", "PitchDistance", "Level", "LM FSID"];
export const SESSION_METRICS = [
  { key: "max_exit_velocity", label: "Max EV", unit: "mph", input: "ExitSpeed", operation: "max", role: "Batter" },
  { key: "avg_exit_velocity", label: "Average EV", unit: "mph", input: "ExitSpeed", operation: "mean", role: "Batter" },
  { key: "max_bat_speed", label: "Max Bat Speed", unit: "mph", input: "BatSpeed", operation: "max", role: "Batter" },
  { key: "avg_bat_speed", label: "Average Bat Speed", unit: "mph", input: "BatSpeed", operation: "mean", role: "Batter" },
  { key: "max_distance", label: "Max Distance", unit: "ft", input: "Distance", operation: "max", role: "Batter" },
  { key: "max_pitch_velocity", label: "Max Velocity", unit: "mph", input: "RelSpeed", operation: "max", role: "Pitcher" },
  { key: "avg_pitch_velocity", label: "Average Velocity", unit: "mph", input: "RelSpeed", operation: "mean", role: "Pitcher" },
] as const;
export type FullSwingSession = {
  table: ImportTable; date: string; eventCount: number; pitcherCount: number; batterCount: number;
  samples: { identity: string; role: string; metric: string; count: number; sourceRows: number[] }[];
};
export const looksLikeFullSwingSession = (headers: readonly string[]) => headers.includes("PitchNo") && headers.includes("PitcherId") && headers.includes("BatterId");

/** No roster inference, writes, or implied units. The caller must confirm mph/ft before saving. */
export function summarizeFullSwingSession(input: ImportTable): FullSwingSession {
  if (JSON.stringify(input.headers) !== JSON.stringify(FULL_SWING_SESSION_HEADERS)) throw new Error("This Full Swing layout differs from the reviewed Live at Bat sample. Keep the original export for review.");
  const index = (header: string) => input.headers.indexOf(header);
  const groups = new Map<string, { identity: string; role: "Pitcher" | "Batter"; rows: { cells: string[]; row: number }[] }>();
  const dates = new Set<string>(), pitches = new Set<string>(), nameIds = new Map<string, string>(), idNames = new Map<string, string>();
  for (const [i, cells] of input.rows.entries()) {
    const row = input.rowNumbers[i];
    if (cells.length !== FULL_SWING_SESSION_HEADERS.length) throw new Error(`Row ${row}: incomplete Full Swing row.`);
    const get = (header: string) => cells[index(header)].trim();
    const date = get("Date").match(/^(\d{2})\/(\d{2})\/(26)$/);
    if (!date) throw new Error(`Row ${row}: expected a Fall 2026 MM/DD/YY date.`);
    const iso = parseMeasurementDate(`20${date[3]}-${date[1]}-${date[2]}`, "ISO");
    if (iso < "2026-09-01" || iso > "2026-12-31") throw new Error(`Row ${row}: use a Fall 2026 session.`);
    dates.add(iso);
    if (get("Mode") !== "Live at Bat" || get("Environment") !== "Field") throw new Error(`Row ${row}: only the reviewed Field / Live at Bat layout is supported.`);
    if (!/^[1-9]\d*$/.test(get("PitchNo")) || pitches.has(get("PitchNo"))) throw new Error(`Row ${row}: missing or repeated pitch number. Use one complete session export.`);
    pitches.add(get("PitchNo"));
    for (const role of ["Pitcher", "Batter"] as const) {
      const identity = get(role), id = get(`${role}Id`), key = `${role}:${id}`, nameKey = `${role}:${identity.toLowerCase()}`;
      if (!identity || !id || /^(null|unknown|n\/a)$/i.test(identity) || /^(null|unknown|n\/a)$/i.test(id)) throw new Error(`Row ${row}: missing ${role.toLowerCase()} identity.`);
      if ((nameIds.has(nameKey) && nameIds.get(nameKey) !== id) || (idNames.has(key) && idNames.get(key) !== identity)) throw new Error(`Row ${row}: conflicting ${role.toLowerCase()} name or ID. Review the source identities.`);
      nameIds.set(nameKey, id); idNames.set(key, identity);
      const group = groups.get(key) ?? { identity, role, rows: [] };
      group.rows.push({ cells, row }); groups.set(key, group);
    }
  }
  if (dates.size !== 1) throw new Error("Use one dated Full Swing session per file.");
  const date = [...dates][0], table: ImportTable = { headers: ["Player", "Date", ...SESSION_METRICS.map(m => m.label)], rows: [], rowNumbers: [] }, samples: FullSwingSession["samples"] = [];
  for (const group of groups.values()) {
    const values = SESSION_METRICS.map(metric => {
      if (metric.role !== group.role) return "";
      const readings = group.rows.flatMap(({ cells, row }) => {
        const raw = cells[index(metric.input)].trim();
        if (!raw || raw === "null") return [];
        if (!/^\d+(?:\.\d+)?$/.test(raw) || !Number.isFinite(Number(raw)) || Number(raw) < 0 || (metric.input !== "Distance" && Number(raw) === 0)) throw new Error(`Row ${row}: review ${metric.input}; expected a positive number or null.`);
        return [{ value: Number(raw), row }];
      });
      if (!readings.length) return "";
      samples.push({ identity: group.identity, role: group.role, metric: metric.label, count: readings.length, sourceRows: readings.map(r => r.row) });
      return String(metric.operation === "max" ? Math.max(...readings.map(r => r.value)) : readings.reduce((sum, r) => sum + r.value, 0) / readings.length);
    });
    if (values.some(Boolean)) { table.rows.push([group.identity, date, ...values]); table.rowNumbers.push(table.rows.length + 1); }
  }
  return { table, date, eventCount: input.rows.length, pitcherCount: [...groups.values()].filter(g => g.role === "Pitcher").length, batterCount: [...groups.values()].filter(g => g.role === "Batter").length, samples };
}
