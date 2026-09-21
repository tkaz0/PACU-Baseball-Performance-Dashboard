export const MOVEMENT_SOURCE = "1Uu-bmZT-ol7ccW96H_1DAFOEI7LdGYTFgJfFUvJdDsU";
export const MOVEMENT_LABELS = ["Thoracic Cavity", "Shoulder Girdle", "Right Shoulder Internal Rotation", "Right Shoulder External Rotation", "Left Shoulder Internal Rotation", "Left Shoulder External Rotation", "Right Hip External Rotation", "Right Hip Internal Rotation", "Left Hip External Rotation", "Left Hip Internal Rotation", "Right Hip Flexion", "Right Hip Extension", "Left Hip Flexion", "Left Hip Extension", "Right Ankle Flexion", "Right Ankle Extension", "Left Ankle Flexion", "Left Ankle Extension", "Hip / Ankle Stability", "Overhead Squat", "Core Stability", "Shoulder Dissociation", "Hip Dissociation", "Pelvic Tilt"] as const;
export type MovementColor = "green" | "yellow" | "red" | "none";
export type MovementReading = { row: number; sourceRow: number; value: string | null; reference: string | null; color: MovementColor };
export type MovementReport = { athleteCode: string; sheetId: number; screenedOn: string; sourceHash: string; readings: MovementReading[] };
export type MovementPayload = { version: 1; source: typeof MOVEMENT_SOURCE; reports: MovementReport[] };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const keys = (v: Record<string, unknown>, expected: string) => Object.keys(v).sort().join(",") === expected;
const cell = (v: unknown) => v === null || (typeof v === "string" && v.length > 0 && v.length <= 120 && v.trim() === v && !/[\u0000-\u001f\u007f]/.test(v));
export function isMovementRom(row: number) { return row >= 4 && row <= 15; }
export function movementTone(reading: MovementReading): MovementColor {
  if (reading.value === null) return "none";
  if (reading.color !== "none") return reading.color;
  if (isMovementRom(reading.row)) return "none";
  const rating = Number(reading.value);
  if (Number.isInteger(rating) && rating >= 1 && rating <= 5) return rating >= 4 ? "green" : rating === 3 ? "yellow" : "red";
  return reading.value.toLowerCase() === "good" ? "green" : "none";
}
export function parseMovementPayload(value: unknown): MovementPayload {
  const fail = () => { throw new Error("This file does not match the reviewed movement-screening format."); };
  if (!object(value) || !keys(value,"reports,source,version") || value.version !== 1 || value.source !== MOVEMENT_SOURCE || !Array.isArray(value.reports) || value.reports.length < 1 || value.reports.length > 50 || JSON.stringify(value).length > 1000000) return fail();
  const seen = new Set<string>();
  for (const report of value.reports) {
    if (!object(report) || !keys(report,"athleteCode,readings,screenedOn,sheetId,sourceHash") || typeof report.athleteCode !== "string" || !/^PAC-\d{4,6}$/.test(report.athleteCode) || !Number.isSafeInteger(report.sheetId) || (report.sheetId as number) < 0 || (report.sheetId as number) > 2147483647 || typeof report.sourceHash !== "string" || !/^[a-f0-9]{64}$/.test(report.sourceHash) || typeof report.screenedOn !== "string" || !/^2026-\d\d-\d\d$/.test(report.screenedOn) || report.screenedOn < "2026-09-01" || report.screenedOn > "2026-12-31" || !Number.isFinite(Date.parse(report.screenedOn)) || new Date(report.screenedOn).toISOString().slice(0,10) !== report.screenedOn || !Array.isArray(report.readings) || report.readings.length !== 24) return fail();
    const id = `${report.sheetId}:${report.screenedOn}`;
    if (seen.has(id)) return fail(); seen.add(id);
    let recorded = 0; const sourceRows=new Set<number>();
    for (let i=0;i<24;i++) {
      const r = report.readings[i];
      if (!object(r) || !keys(r,"color,reference,row,sourceRow,value") || r.row !== i+2 || !Number.isInteger(r.sourceRow) || (r.sourceRow as number)<2 || (r.sourceRow as number)>25 || !cell(r.value) || !cell(r.reference) || !["none","green","yellow","red"].includes(r.color as string)) return fail();
      if (sourceRows.has(r.sourceRow as number)) return fail(); sourceRows.add(r.sourceRow as number);
      if (r.value !== null) {
        recorded++;
        if ((r.row as number)>=16 && (r.row as number)<=19 && (typeof r.value!=="string" || !/^[1-5]$/.test(r.value))) return fail();
        if (isMovementRom(r.row as number) && (typeof r.value !== "string" || !/^-?\d+(\.\d+)?$/.test(r.value) || Math.abs(Number(r.value)) > 360)) return fail();
        if (!isMovementRom(r.row as number) && typeof r.value === "string" && /^-?\d+(\.\d+)?$/.test(r.value) && (!Number.isInteger(Number(r.value)) || Number(r.value)<1 || Number(r.value)>5)) return fail();
      }
    }
    if (!recorded) return fail();
  }
  return value as MovementPayload;
}
