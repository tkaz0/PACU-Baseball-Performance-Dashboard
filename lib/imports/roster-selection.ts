import { measurementIdentityResolver, type ImportTable, type MeasurementMapping } from "@/lib/imports/engine";
import type { RosterAthlete } from "@/lib/types";

/** Filter summaries, never raw events: known opponents retain every recorded event.
 * Keep original row coordinates so exclusions cannot change observation IDs. */
export function selectRosterSummaries(table: ImportTable, mapping: Pick<MeasurementMapping, "identityKind" | "identityColumn" | "identityOverrides">, roster: RosterAthlete[], excluded: string[] = [], extraIdentities: string[] = []) {
  if (!Number.isInteger(mapping.identityColumn) || mapping.identityColumn < 0 || mapping.identityColumn >= table.headers.length) throw new Error("Choose the player column before reviewing the import.");
  const resolve = measurementIdentityResolver(mapping, roster);
  const identities = [...new Set([...table.rows.map(row => (row[mapping.identityColumn] ?? "").trim()), ...extraIdentities])];
  const players = identities.map(identity => {
    const { matches } = resolve(identity);
    const athlete = matches.length === 1 ? matches[0] : undefined;
    const reason = excluded.includes(identity) ? "Excluded by staff" : !identity ? "Missing name" : matches.length > 1 ? "Needs a unique match" : !athlete ? "Not matched to the roster" : "";
    return { identity, athlete, included: !reason, reason };
  });
  const includedIdentities = players.filter(player => player.included).map(player => player.identity);
  const included = new Set(includedIdentities);
  const selected: ImportTable = { headers: table.headers, rows: [], rowNumbers: [] };
  table.rows.forEach((row, index) => {
    if (included.has((row[mapping.identityColumn] ?? "").trim())) {
      selected.rows.push(row); selected.rowNumbers.push(table.rowNumbers[index]);
    }
  });
  return { table: selected, players, includedIdentities, skipped: players.filter(player => !player.included) };
}
