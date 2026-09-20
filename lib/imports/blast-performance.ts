import { BLAST_HEADERS, BLAST_REPORT_METRICS, blastMetricFor, blastSource, validBlastValue, type BlastSummaryKind } from "@/lib/blast-metrics";
import { prepareReviewedPerformanceRows } from "@/lib/performance-import";
import { selectRosterSummaries } from "./roster-selection";
import type { FileContext, ImportTable, Measurement } from "./engine";
import type { RosterAthlete } from "@/lib/types";

export function blastIdentityTable(table: ImportTable): ImportTable {
  if (table.headers.length !== BLAST_HEADERS.length || table.headers.some((h,i)=>h.trim() !== BLAST_HEADERS[i]) || table.rows.some(row=>row.length !== BLAST_HEADERS.length)) throw new Error("This is not the supported 16-column Blast Performance export. Choose Average Performance or Peak (95th Percentile). Custom summaries use the separate option below.");
  return { ...table, rows: table.rows.map(row=>[`${row[0].trim()} ${row[1].trim()}`.trim(),...row.slice(1)]) };
}
export function previewBlastPerformance(input: { table: ImportTable; roster: RosterAthlete[]; file: FileContext; kind: BlastSummaryKind; start: string; end: string; overrides?: Record<string,string>; excluded?: string[] }) {
  const source = blastSource(input.kind,input.start,input.end);
  if (!input.file.fileName.toLowerCase().endsWith(".csv")) throw new Error("Choose a Blast Performance CSV.");
  const selection = selectRosterSummaries(blastIdentityTable(input.table), {identityKind:"name",identityColumn:0,identityOverrides:input.overrides}, input.roster,input.excluded);
  const rows: Measurement[] = [], seen = new Set<string>();
  selection.table.rows.forEach((row,i)=>{
    const player = selection.players.find(p=>p.identity === row[0])!.athlete!;
    const rowNumber = selection.table.rowNumbers[i];
    if (seen.has(player.athlete_code)) throw new Error(`Row ${rowNumber}: more than one summary matches the same player. Match or skip these rows before saving.`);
    seen.add(player.athlete_code);
    if (!row[2].trim()) throw new Error(`Row ${rowNumber}: a swing count is required for a weekly summary.`);
    for (const definition of BLAST_REPORT_METRICS) {
      const cell = row[definition.column].trim(), metric = blastMetricFor(definition.column,input.kind);
      if (!cell) continue;
      if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(cell) || !validBlastValue(metric,Number(cell))) throw new Error(`Row ${rowNumber}: review ${metric.label}. Use the original numeric value and unit.`);
      const sheet = input.file.sheetName ?? "CSV";
      rows.push({id:`observation:${JSON.stringify([input.file.fileHash,sheet,rowNumber,metric.column])}`,athlete_code:player.athlete_code,measured_at:input.end,metric:metric.label,value:Number(cell),unit:metric.unit,source,source_file:input.file.fileName,source_sheet:sheet,source_row:rowNumber,file_hash:input.file.fileHash});
    }
  });
  if (!rows.some(r=>r.unit !== "count")) throw new Error("Match at least one player with recorded measurements before saving.");
  prepareReviewedPerformanceRows(rows);
  return { rows, players:selection.players, skipped:selection.skipped };
}
