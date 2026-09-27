import type { Measurement } from "@/lib/imports/engine";
import { SESSION_METRICS, type FullSwingSession } from "@/lib/imports/full-swing-session";
import { prepareClassifiedPitchResults, type PitchResultContext } from "@/lib/imports/classified-pitch-results";
import { prepareFullSwingContacts, REVIEWED_CONTACT_FIELDS, type ReviewedContact } from "@/lib/imports/full-swing-contacts";
import { fullSwingSamplesForImport, type ReviewedFullSwingSample } from "@/lib/imports/full-swing-samples";
import { validatePitchAssignments, type PitchAssignment } from "@/lib/imports/pitch-assignments";
import { prepareReviewedPerformanceRows } from "@/lib/performance-import";

export type FullSwingSessionBundle = {
  requestId: string; expectedRevision: number; replace: boolean;
  fileHash: string; fileName: string; date: string; category: PitchResultContext["category"];
  mode: FullSwingSession["mode"]; eventCount: number; unresolvedPitchCount: number; excludedPlayerCount: number;
  removedValues: string[]; assignmentVersion: number; assignments: PitchAssignment[];
  measurements: Measurement[]; samples: ReviewedFullSwingSample[]; contacts: ReviewedContact[];
};
export type FullSwingSessionReceipt = {
  requestId: string; fileHash: string; revision: number; created: number; unchanged: number;
  measurementCount: number; contactCount: number; sampleCount: number; publishedAt: string; unresolvedPitchCount: number;
};
export type FullSwingSessionState = {
  revision: number; publishedAt: string | null; removedValues?: string[];
  fileName?: string; date?: string; category?: PitchResultContext["category"]; mode?: FullSwingSession["mode"];
};
const SUMMARY_SHEET = "CSV · Full Swing session summaries v1";
const CLASSIFIED_SHEET = "CSV · Classified pitch summaries v1";
const fields = ["requestId","expectedRevision","replace","fileHash","fileName","date","category","mode","eventCount","unresolvedPitchCount","excludedPlayerCount","removedValues","assignmentVersion","assignments","measurements","samples","contacts"].sort();
const measurementFields = ["id","athlete_code","measured_at","source","metric","value","unit","source_file","source_sheet","source_row","file_hash"].sort();
const sampleFields = ["athleteCode","fileHash","metricKey","unit","sourceRow","sampleCount","expectedValue"].sort();
const exactKeys = (value: unknown, allowed: readonly string[]): boolean => !!value && typeof value === "object" && !Array.isArray(value) && JSON.stringify(Object.keys(value).sort()) === JSON.stringify(allowed);
const integer = (value: unknown, min: number, max: number): value is number => Number.isSafeInteger(value) && Number(value) >= min && Number(value) <= max;
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

/** Build every projection from the same reviewed original CSV. No raw names or CSV cells leave this function. */
export function prepareFullSwingSessionBundle(input: {
  session: FullSwingSession; context: PitchResultContext; summaries: Measurement[];
  assignments: PitchAssignment[]; assignmentVersion: number; removedValues: string[];
  excludedPlayerCount: number; requestId: string; expectedRevision: number; replace: boolean;
}): FullSwingSessionBundle {
  const { session, context } = input;
  const matches = new Map(context.matches.map(match => [match.identity, match.athleteCode]));
  const assignments = validatePitchAssignments(input.assignments);
  const source = `Full Swing · ${context.category === "game" ? "Game" : context.category === "practice" ? "Practice" : "Intrasquad"}`;
  const expected = session.table.rows.flatMap((cells, index) => {
    const code = matches.get(cells[0]), row = session.table.rowNumbers[index];
    if (!code) return [];
    return SESSION_METRICS.flatMap((metric, i): Measurement[] => cells[i + 2] === "" ? [] : [{
      id: `observation:${JSON.stringify([context.fileHash, SUMMARY_SHEET, row, i + 2])}`,
      athlete_code: code, measured_at: session.date, source, metric: metric.label, value: Number(cells[i + 2]), unit: metric.unit,
      source_file: context.fileName, source_sheet: SUMMARY_SHEET, source_row: row, file_hash: context.fileHash,
    }]);
  });
  const signature = (rows: Measurement[]) => JSON.stringify(rows.map(row => Object.fromEntries(measurementFields.map(key => [key, row[key as keyof Measurement]]))).sort((a,b) => String(a.id).localeCompare(String(b.id))));
  if (signature(expected) !== signature(input.summaries)) throw new Error("Review all available session summaries before publishing the complete session.");
  const matchedPitches = session.pitches.filter(pitch => matches.has(pitch.identity));
  const assigned = new Set(assignments.map(assignment => assignment.sourceRow));
  const bundle: FullSwingSessionBundle = {
    requestId: input.requestId, expectedRevision: input.expectedRevision, replace: input.replace,
    fileHash: context.fileHash, fileName: context.fileName, date: context.date, category: context.category, mode: session.mode,
    eventCount: session.eventCount, unresolvedPitchCount: matchedPitches.filter(pitch => !assigned.has(pitch.sourceRow)).length,
    excludedPlayerCount: input.excludedPlayerCount, removedValues: [...input.removedValues].sort(), assignmentVersion: input.assignmentVersion, assignments,
    measurements: [...expected, ...prepareClassifiedPitchResults(session, assignments, context)],
    samples: fullSwingSamplesForImport(session, context.matches, expected), contacts: prepareFullSwingContacts(session, context),
  };
  validateFullSwingSessionBundle(bundle);
  return bundle;
}

/** Strict server boundary: whitelist numeric projections and bind them to one exact original file and context. */
export function validateFullSwingSessionBundle(value: unknown): FullSwingSessionBundle {
  const fail = (): never => { throw new Error("Review the complete session, player matches, units and original file before publishing."); };
  if (!exactKeys(value, fields) || JSON.stringify(value).length > 1_800_000) return fail();
  const b = value as FullSwingSessionBundle;
  if (!uuid(b.requestId) || !integer(b.expectedRevision,0,1_000_000) || typeof b.replace !== "boolean" ||
    (b.replace && b.expectedRevision === 0) || !/^[a-f0-9]{64}$/.test(b.fileHash) || typeof b.fileName !== "string" ||
    !b.fileName || b.fileName !== b.fileName.trim() || b.fileName.length > 300 || /[\u0000-\u001f\u007f]/.test(b.fileName) ||
    !/^2026-(09|10|11|12)-\d{2}$/.test(b.date) || !Number.isFinite(Date.parse(b.date)) || new Date(b.date).toISOString().slice(0,10) !== b.date ||
    !["game","intrasquad","practice"].includes(b.category) || !["Live at Bat","Machine BP"].includes(b.mode) ||
    (b.mode === "Machine BP" && b.category !== "practice") || !integer(b.eventCount,1,5000) ||
    !integer(b.unresolvedPitchCount,0,b.eventCount) || !integer(b.excludedPlayerCount,0,10000) || !integer(b.assignmentVersion,0,1_000_000) ||
    !Array.isArray(b.removedValues) || b.removedValues.length > 35000 || new Set(b.removedValues).size !== b.removedValues.length ||
    b.removedValues.some(key => typeof key !== "string" || !/^[1-9]\d{0,5}:(RelSpeed|SpinRate|ExitSpeed|Angle|Direction|BatSpeed|Distance)$/.test(key)) ||
    !Array.isArray(b.measurements) || !integer(b.measurements.length,1,2000) || !Array.isArray(b.samples) || b.samples.length > 500 ||
    !Array.isArray(b.contacts) || b.contacts.length > 500) return fail();
  validatePitchAssignments(b.assignments);
  const source = `Full Swing · ${b.category === "game" ? "Game" : b.category === "practice" ? "Practice" : "Intrasquad"}`;
  const ids = new Set<string>();
  for (const m of b.measurements) {
    if (!exactKeys(m, measurementFields) || m.file_hash !== b.fileHash || m.source_file !== b.fileName || m.measured_at !== b.date ||
      (m.source_sheet !== SUMMARY_SHEET && m.source_sheet !== CLASSIFIED_SHEET) ||
      (m.source_sheet === SUMMARY_SHEET ? m.source !== source || !SESSION_METRICS.some(metric => metric.label === m.metric && metric.unit === m.unit) : !m.source.startsWith(`${source} · `)) || ids.has(m.id)) return fail();
    ids.add(m.id);
    if (b.mode === "Machine BP" && (m.source_sheet === CLASSIFIED_SHEET || ["Max Velocity","Average Velocity"].includes(m.metric))) return fail();
  }
  const canonical = [];
  for (let i = 0; i < b.measurements.length; i += 500) canonical.push(...prepareReviewedPerformanceRows(b.measurements.slice(i,i+500)));
  const summaries = canonical.filter(row => row.source_sheet === SUMMARY_SHEET);
  if (b.samples.length !== summaries.length) return fail();
  const sampleKeys = new Set<string>();
  for (const s of b.samples) {
    if (!exactKeys(s, sampleFields) || !integer(s.sampleCount,1,b.eventCount) || s.fileHash !== b.fileHash) return fail();
    const key = JSON.stringify([s.athleteCode,s.metricKey,s.unit,s.sourceRow]);
    if (sampleKeys.has(key) || !summaries.some(m => m.athlete_code === s.athleteCode && m.metric_key === s.metricKey && m.unit === s.unit && m.source_row === s.sourceRow && m.value === s.expectedValue)) return fail();
    sampleKeys.add(key);
  }
  const rows = new Set<number>(), pitches = new Set<number>();
  for (const c of b.contacts) {
    if (!exactKeys(c, REVIEWED_CONTACT_FIELDS) || c.fileHash !== b.fileHash || c.sourceFile !== b.fileName || c.playedOn !== b.date || c.category !== b.category ||
      !/^PAC-\d{4,6}$/.test(c.athleteCode) || !integer(c.sourceRow,2,1000000) || !integer(c.pitchNumber,1,1000000) ||
      !Number.isFinite(c.exitVelocity) || c.exitVelocity <= 0 || c.exitVelocity > 200 || !Number.isFinite(c.launchAngle) || Math.abs(c.launchAngle)>90 ||
      (c.direction !== null && (!Number.isFinite(c.direction) || Math.abs(c.direction)>90)) ||
      (c.distance !== null && (!Number.isFinite(c.distance) || c.distance<0 || c.distance>1000)) ||
      (c.direction === null)!==(c.distance === null) || rows.has(c.sourceRow) || pitches.has(c.pitchNumber)) return fail();
    rows.add(c.sourceRow); pitches.add(c.pitchNumber);
  }
  if (b.mode === "Machine BP" && (b.assignments.length || b.unresolvedPitchCount)) return fail();
  return b;
}

export function fullSwingSessionDatabasePayload(bundle: FullSwingSessionBundle) {
  const b = validateFullSwingSessionBundle(bundle);
  const measurements = [];
  for (let i=0;i<b.measurements.length;i+=500) measurements.push(...prepareReviewedPerformanceRows(b.measurements.slice(i,i+500)));
  const { requestId: _request, expectedRevision: _revision, replace: _replace, ...payload } = b;
  void _request; void _revision; void _replace;
  return { ...payload, measurements };
}
