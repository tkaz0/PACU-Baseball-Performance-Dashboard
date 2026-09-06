/** Exact Fall source contracts. No network, storage, name guessing or Sheet writes. */
export type GameSourceKey = "qpa_fall_2026" | "pitching_fall_2026";
export type GameSourceCell = { row: number; column: number; entered?: string | number; effective?: string | number; formula?: string; error?: string };
export type GameSourceSnapshot = {
  source: GameSourceKey; spreadsheetId: string; sheetId: number; sheetTitle: string;
  fetchedAt: string; contentHash: string; cells: GameSourceCell[];
};
export type ReviewedGameSource = {
  source: GameSourceKey; spreadsheetId: string; sheetId: number; sheetTitle: string;
  /** Complete, reviewed detail rows. Never infer players from summary labels. */
  detailRows: number[];
};
export type ReviewedGameIdentity = { sourceName: string; athleteCode: string };
export type ReviewedPitchingEvent = { headerRow: number; firstRow: number; lastRow: number; eventId: string; playedOn: string };
export type GameSourceIssue = { severity: "error" | "review"; code: string; row: number | null; column: number | null; message: string };
export type GameSourceObservation = {
  athleteCode: string; metric: string; label: string; value: number; unit: "count" | "%";
  scope: "cumulative_fall" | "pitching_event"; eventId: string | null; playedOn: string | null;
  source: GameSourceKey; sourceRow: number; sourceColumn: number; derivedFrom: number[];
};
export type GameSourcePreview = {
  source: GameSourceKey; fetchedAt: string; contentHash: string;
  observations: GameSourceObservation[]; issues: GameSourceIssue[];
  populatedRows: number; missingRawCells: number; canImport: boolean;
};

export const QPA_HEADERS = ["Player", "PA's", "QPAs", "QPA Checker", "AB's", "AB's Checker", "Walks + HBP + Sac Bunt", "Percentage", "HH Base Hit", "HH Extra Base Hit", "Pumps", "Base Hit", "3-8 HH", "8 (+) pitches", "BB", "RBI", "Sac Bunt", "Moving Runner (2nd to 3rd w/ < 2 outs)", "HBP", "Punchies", "HH %", "Hitterish Value", "AB Control: weak before 3 or plus count (0-0, 1-0, 2-0, 2-1, 3-0, 3-1) (includes popped up bunts)", "Hitterish Plus AB Control", "Hitterish Plus AB Control / Total PA's", "AB's / AB's Thrown"] as const;
export const PITCHING_HEADERS = ["Name", "", "Pitches", "Strikes", "K%", "FB", "FB K", "FB K%", "BB", "BB K", "BB K%", "CH", "CH K", "CH K%", "BAF", "FPS", "FPS%", "Inn", "H", "R", "BB", "HBP", "K"] as const;
const QPA_RAW = [[2,"pa"],[3,"qpa"],[5,"ab"],[9,"hh_base_hit"],[10,"hh_extra_base_hit"],[11,"pumps"],[12,"base_hit"],[13,"three_eight_hh"],[14,"eight_plus_pitches"],[15,"bb"],[16,"rbi"],[17,"sac_bunt"],[18,"moving_runner"],[19,"hbp"],[20,"punchies"],[23,"ab_control"]] as const;
const PITCHING_RAW = [[3,"pitches"],[4,"strikes"],[6,"fb"],[7,"fb_k"],[9,"bb_pitch_family"],[10,"bb_pitch_family_k"],[12,"ch"],[13,"ch_k"],[15,"baf"],[16,"fps"],[19,"h"],[20,"r"],[21,"bb_outcome"],[22,"hbp"],[23,"k"]] as const;
const normalize = (value: string) => value.trim().replace(/\s+/g," ").toLocaleLowerCase("en-US");
const canonicalFormula = (formula: string) => formula.replace(/\s+/g, "").toUpperCase();
const validDate = (value: string) => /^2026-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value && value >= "2026-09-01" && value <= "2026-12-31";
const key = (row: number, column: number) => `${row}:${column}`;

export function parseGameSource(snapshot: GameSourceSnapshot, contract: ReviewedGameSource, identities: ReviewedGameIdentity[], events: ReviewedPitchingEvent[] = [], now=Date.now()): GameSourcePreview {
  const result: GameSourcePreview = { source: snapshot.source, fetchedAt: snapshot.fetchedAt, contentHash: snapshot.contentHash, observations: [], issues: [], populatedRows: 0, missingRawCells: 0, canImport: false };
  const problem = (code: string, message: string, row: number | null = null, column: number | null = null, severity: "error" | "review" = "error") => result.issues.push({ severity, code, row, column, message });
  const source = snapshot.source;
  const qpa = source === "qpa_fall_2026";
  if (!["qpa_fall_2026", "pitching_fall_2026"].includes(source) || source !== contract.source || snapshot.spreadsheetId !== contract.spreadsheetId || snapshot.sheetId !== contract.sheetId || snapshot.sheetTitle !== contract.sheetTitle || snapshot.sheetTitle !== (qpa ? "2026 - Fall" : "FALL")) {
    problem("source", "The spreadsheet or tab does not match the reviewed Fall source."); return result;
  }
  if (typeof snapshot.contentHash!=="string" || snapshot.contentHash.length!==64 || !/^[a-f0-9]{64}$/.test(snapshot.contentHash) || !Number.isFinite(Date.parse(snapshot.fetchedAt)) || Date.parse(snapshot.fetchedAt)>now+5*60*1000 || !Array.isArray(snapshot.cells) || snapshot.cells.length > 40000 || !Array.isArray(contract.detailRows) || contract.detailRows.length > 1000) {
    problem("snapshot", "The source snapshot has invalid provenance or exceeds its bounded capacity."); return result;
  }
  const cells = new Map<string, GameSourceCell>();
  for (const cell of snapshot.cells) {
    if (!Number.isSafeInteger(cell.row) || cell.row < 1 || cell.row > 2000 || !Number.isSafeInteger(cell.column) || cell.column < 1 || cell.column > 33 || cells.has(key(cell.row, cell.column)) || (cell.formula !== undefined && typeof cell.formula !== "string")) {
      problem("cells", "Source cells are duplicated or outside the supported grid."); return result;
    }
    cells.set(key(cell.row,cell.column),cell);
  }
  const text = (row: number, column: number) => {
    const cell = cells.get(key(row,column));
    return typeof cell?.entered === "string" && !cell.formula ? cell.entered : "";
  };
  const checkHeader = (row: number, headers: readonly string[]) => headers.forEach((header,index) => {
    if (normalize(text(row,index+1)) !== normalize(header)) problem("header", "A source column header changed; review the mapping before syncing.",row,index+1);
  });
  checkHeader(qpa ? 1 : 2, qpa ? QPA_HEADERS : PITCHING_HEADERS);
  const byName = new Map<string,string>();
  for (const mapping of identities) {
    const name = normalize(mapping.sourceName);
    if (!name || !/^PAC-[0-9]{4,9}$/.test(mapping.athleteCode) || byName.has(name)) problem("identity_mapping", "The reviewed identity mapping is missing, duplicated or invalid.");
    else byName.set(name,mapping.athleteCode);
  }
  const rows = new Set(contract.detailRows);
  if (rows.size !== contract.detailRows.length || [...rows].some(row => !Number.isSafeInteger(row) || row < (qpa ? 2 : 3) || row > 2000)) problem("detail_rows", "The reviewed source detail-row coverage is invalid.");
  for(const cell of cells.values()) if(cell.column>(qpa?26:23)&&(cell.entered!==undefined||cell.formula||cell.error)) problem("unreviewed_columns", "Source content appeared outside the reviewed columns. Review the changed source layout before syncing.",cell.row,cell.column);
  const rawColumns=new Set<number>((qpa?QPA_RAW:PITCHING_RAW).map(([column])=>column));
  if(!qpa)rawColumns.add(18);
  for(const cell of cells.values()) if(!rows.has(cell.row)&&rawColumns.has(cell.column)&&typeof cell.entered==="number"&&!cell.formula){
    problem("unreviewed_rows", "Entered statistics appeared outside the reviewed detail rows. Review the changed source layout before syncing.",cell.row,cell.column);
  }
  for (const row of rows) for (let column=1;column<=(qpa ? 26 : 23);column++) {
    if (!cells.has(key(row,column))) problem("coverage", "The snapshot omitted part of a reviewed detail row. Read the complete bounded source range again.",row,column);
  }
  const eventByRow = new Map<number,ReviewedPitchingEvent>();
  const eventIds = new Set<string>();
  if (!qpa) for (const event of events) {
    if (!Number.isSafeInteger(event.headerRow) || !Number.isSafeInteger(event.firstRow) || !Number.isSafeInteger(event.lastRow) || event.headerRow < 3 || event.firstRow !== event.headerRow+1 || event.lastRow < event.firstRow || event.lastRow > 2000 || !/^[A-Za-z0-9_-]{1,80}$/.test(event.eventId) || eventIds.has(event.eventId) || !validDate(event.playedOn)) {
      problem("event_mapping", "Pitching blocks need unique reviewed event IDs and Fall game dates."); continue;
    }
    eventIds.add(event.eventId); checkHeader(event.headerRow,PITCHING_HEADERS);
    for (let row=event.firstRow;row<=event.lastRow;row++) {
      if (eventByRow.has(row)) problem("event_mapping", "Reviewed pitching blocks overlap.",row);
      eventByRow.set(row,event);
    }
  }
  if (result.issues.some(issue => issue.severity === "error")) return result;
  const seenIdentities = new Set<string>();
  for (const row of [...rows].sort((a,b)=>a-b)) {
    const raw = qpa ? QPA_RAW : PITCHING_RAW;
    const values = new Map<number,number>();
    let touched = false;
    for (const [column] of raw) {
      const cell = cells.get(key(row,column));
      if (!cell || (cell.entered === undefined && !cell.formula && !cell.error) || cell.entered === "") { result.missingRawCells++; continue; }
      touched = true;
      if (cell.formula || cell.error || typeof cell.entered !== "number" || !Number.isSafeInteger(cell.entered) || cell.entered < 0 || cell.entered>1000000000) {
        problem("raw_value", "A raw count is a formula, error, text, negative value or non-integer. Review the source entry.",row,column); continue;
      }
      values.set(column,cell.entered);
    }
    const innings = !qpa ? cells.get(key(row,18)) : undefined;
    if (innings && (innings.entered !== undefined || innings.formula || innings.error)) {
      touched = true; problem("innings", "The innings convention is not confirmed. Inn stays excluded; no decimal or baseball-outs conversion is inferred.",row,18,"review");
    }
    if (!touched) continue;
    result.populatedRows++;
    const athleteCode = byName.get(normalize(text(row,1)));
    if (!athleteCode) { problem("unmapped_identity", "This populated source row needs an exact reviewed athlete mapping.",row,1); continue; }
    const event = qpa ? undefined : eventByRow.get(row);
    if (!qpa && !event) { problem("unmapped_event", "This populated pitching row needs a reviewed event/block and actual game date.",row); continue; }
    const identityKey = `${athleteCode}:${event?.eventId ?? "cumulative"}`;
    if (seenIdentities.has(identityKey)) { problem("duplicate_identity", "Two source rows resolve to the same athlete and event/season.",row,1); continue; }
    seenIdentities.add(identityKey);
    const add = (metric: string,label: string,value: number,column: number,unit: "count" | "%"="count",derivedFrom: number[] = []) => result.observations.push({ athleteCode, metric, label, value, unit, scope: qpa ? "cumulative_fall" : "pitching_event", eventId: event?.eventId ?? null, playedOn: event?.playedOn ?? null, source, sourceRow: row, sourceColumn: column, derivedFrom });
    for (const [column,metric] of raw) if (values.has(column)) {
      const label = qpa ? QPA_HEADERS[column-1] : column === 9 ? "BB (pitch family)" : column === 21 ? "BB (outcome)" : PITCHING_HEADERS[column-1];
      add(metric,label,values.get(column)!,column);
    }
    const numerator = qpa ? 3 : 4, denominator = qpa ? 2 : 3, rateColumn = qpa ? 8 : 5;
    const expectedFormula = qpa ? `=C${row}/B${row}` : `=D${row}/C${row}`;
    const formula = cells.get(key(row,rateColumn))?.formula;
    if (formula && canonicalFormula(formula)!==expectedFormula.toUpperCase()) problem("rate_formula", "The source rate formula changed; review its numerator and denominator before syncing.",row,rateColumn);
    if (values.has(numerator) && values.has(denominator)) {
      const top = values.get(numerator)!, bottom = values.get(denominator)!;
      if (top>bottom) problem("rate_counts", "The rate numerator exceeds its denominator.",row,numerator);
      else if (bottom>0) add(qpa ? "qpa_pct" : "strike_pct",qpa ? "QPA Percentage" : "Strike Percentage",100*(top/bottom),rateColumn,"%",[numerator,denominator]);
    }
  }
  if (result.observations.length>10000) problem("capacity", "The normalized snapshot exceeds 10,000 observations.");
  result.canImport = result.observations.length>0 && !result.issues.some(issue => issue.severity === "error");
  return result;
}
