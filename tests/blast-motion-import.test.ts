import { describe, expect, it } from "vitest";
import { getPreviewRoster } from "@/lib/preview-roster";
import { parseDelimited, selectTable, type MeasurementMapping } from "@/lib/imports/engine";
import { BLAST_MOTION_METRICS, previewBlastMotionSummary } from "@/lib/imports/blast-motion";
import { prepareReviewedPerformanceRows } from "@/lib/performance-import";

const roster = getPreviewRoster(), player = roster[0];
const file = { fileName: "fictional-blast-summary.csv", fileHash: "b".repeat(64), sheetName: "CSV" };
const mapping: MeasurementMapping = { identityKind: "code", identityColumn: 0, dateColumn: 1, dateFormat: "ISO", source: "Incorrect vendor", metrics: [{ column: 2, label: "Max Bat Speed", unit: "mph" }, { column: 3, label: "Average Bat Speed", unit: "mph" }] };
const run = (csv = `Player,Date,Maximum,Average\n${player.athlete_code},2026-09-12,75,68`, overrides: Partial<Parameters<typeof previewBlastMotionSummary>[0]> = {}) => previewBlastMotionSummary({ table: selectTable(parseDelimited(csv), 0), mapping, file, roster, summaryConfirmed: true, ...overrides });

describe("Blast Motion reviewed CSV importer", () => {
  it("preserves values, exact provenance and stable IDs accepted by the shared importer", () => {
    const preview = run();
    expect(preview.canApply).toBe(true);
    expect(preview.candidateMeasurements.map(row => row.value)).toEqual([75,68]);
    expect(preview.candidateMeasurements[0]).toMatchObject({source:"Blast Motion · Hitting",source_row:2,source_sheet:"CSV",file_hash:file.fileHash});
    expect(preview.candidateMeasurements[0].id).toBe(`observation:${JSON.stringify([file.fileHash,"CSV",2,2])}`);
    expect(run().candidateMeasurements).toEqual(preview.candidateMeasurements);
    expect(prepareReviewedPerformanceRows(preview.candidateMeasurements).map(row=>row.metric_key)).toEqual(["max_bat_speed","avg_bat_speed"]);
  });
  it("requires summary confirmation and does not relabel individual swings",()=>{
    expect(()=>run(undefined,{summaryConfirmed:false})).toThrow("session summaries");
    expect(()=>run(`Player,Date,Maximum,Average\n${player.athlete_code},2026-09-12,75,68\n${player.athlete_code},2026-09-12,74,67`)).toThrow("Multiple summaries");
  });
  it("rejects incorrect vendor metrics, repeated metrics and invalid units",()=>{
    expect(BLAST_MOTION_METRICS.map(row=>row.key)).toEqual(["max_bat_speed","avg_bat_speed"]);
    for (const metric of [{column:2,label:"Max EV",unit:"mph"},{column:2,label:"Max Bat Speed",unit:"rpm"}]) expect(()=>run(undefined,{mapping:{...mapping,metrics:[metric]}})).toThrow("original speed unit");
    expect(()=>run(undefined,{mapping:{...mapping,metrics:[mapping.metrics[0],{...mapping.metrics[0],column:3}]}})).toThrow("only once");
  });
  it("blocks reversed maximum and average, negative values, and out-of-season dates",()=>{
    expect(()=>run(`Player,Date,Maximum,Average\n${player.athlete_code},2026-09-12,65,68`)).toThrow("cannot exceed");
    expect(()=>run(`Player,Date,Maximum,Average\n${player.athlete_code},2026-09-12,75,-1`)).toThrow("invalid value");
    expect(()=>run(`Player,Date,Maximum,Average\n${player.athlete_code},2027-01-01,75,68`)).toThrow("Fall 2026");
  });
  it("keeps missing values missing and blocks unknown player identities",()=>{
    expect(run(`Player,Date,Maximum,Average\n${player.athlete_code},2026-09-12,75,`).candidateMeasurements).toHaveLength(1);
    expect(run('Player,Date,Maximum,Average\nUNKNOWN,2026-09-12,75,68').canApply).toBe(false);
  });
  it("supports explicit name overrides, header row offsets, and speed units without converting",()=>{
    const table=selectTable(parseDelimited('Metadata\nPlayer,Date,Maximum,Average\nExport nickname,09/12/2026,120,100'),1);
    const preview=run(undefined,{table,mapping:{...mapping,identityKind:"name",identityOverrides:{"Export nickname":player.athlete_code},dateFormat:"MDY",metrics:mapping.metrics.map(m=>({...m,unit:"km/h"}))}});
    expect(preview.canApply).toBe(true);
    expect(preview.candidateMeasurements[0]).toMatchObject({athlete_code:player.athlete_code,source_row:3,value:120,unit:"km/h",measured_at:"2026-09-12"});
  });
});
