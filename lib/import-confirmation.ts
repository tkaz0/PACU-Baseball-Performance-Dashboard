import type { Measurement } from "@/lib/imports/engine";
import { athleteName, type RosterAthlete } from "@/lib/types";
export type ReadingsSaved = { created: number; unchanged: number };
export type ImportSkipped = { label: string; reason: string };
export type ImportConfirmationData = ReadingsSaved & {
  players: { code: string; name: string; href: string; date: string; metrics: string[] }[];
  skipped: ImportSkipped[];
};
/** In-memory receipt built only after a verified save. No source files, IDs or values. */
export function buildImportConfirmation(rows: readonly Pick<Measurement, "athlete_code" | "measured_at" | "metric">[], roster: readonly RosterAthlete[], receipt: ReadingsSaved, skipped: ImportSkipped[] = [], alreadyPresent = 0): ImportConfirmationData {
  const groups = new Map<string, ImportConfirmationData["players"][number]>();
  for (const row of rows) {
    const athlete = roster.find(a => a.athlete_code === row.athlete_code);
    if (!athlete) throw new Error("Refresh the roster to view this import’s player matches.");
    const key = JSON.stringify([row.athlete_code, row.measured_at]);
    const group = groups.get(key) ?? { code: row.athlete_code, name: athleteName(athlete), href: `/athletes/${athlete.id}`, date: row.measured_at, metrics: [] };
    if (!group.metrics.includes(row.metric)) group.metrics.push(row.metric);
    groups.set(key, group);
  }
  return { created: receipt.created, unchanged: receipt.unchanged + alreadyPresent, players: [...groups.values()], skipped: [...new Map(skipped.map(s => [JSON.stringify(s), s])).values()] };
}
