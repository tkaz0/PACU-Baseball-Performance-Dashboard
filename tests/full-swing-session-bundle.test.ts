import { describe, expect, it } from "vitest";
import { FULL_SWING_SESSION_HEADERS as headers, SESSION_METRICS } from "@/lib/imports/full-swing-session";
import { inspectFullSwingReadings, summarizeReviewedFullSwingSession } from "@/lib/imports/full-swing-misreads";
import { prepareFullSwingSessionBundle, validateFullSwingSessionBundle, fullSwingSessionDatabasePayload } from "@/lib/imports/full-swing-session-bundle";
import { previewFullSwingSummary } from "@/lib/imports/full-swing";
import { getPreviewRoster } from "@/lib/preview-roster";

const player = { ...getPreviewRoster()[0], athlete_code: "PAC-0001" };
const name = `${player.first_name} ${player.last_name}`;
const hash = "a".repeat(64);
function event(pitch: number, overrides: Record<string,string> = {}) {
  const values: Record<string,string> = { PitchNo:String(pitch),Date:"09/11/26",Pitcher:name,PitcherId:"fictional-pitcher",Batter:name,BatterId:"fictional-batter",RelSpeed:String(78+pitch),SpinRate:String(1800+pitch*100),ExitSpeed:String(80+pitch*5),Angle:"20",Direction:"10",BatSpeed:String(55+pitch),Distance:String(200+pitch*25),Environment:"Field",Mode:"Live at Bat",...overrides };
  return headers.map(header => values[header] ?? "null");
}
function bundle(removedValues: string[] = [], overrides: Record<string,string> = {}) {
  const input = { headers:[...headers],rows:[event(1,overrides),event(2,overrides),event(3,overrides)],rowNumbers:[2,3,4] };
  const session = summarizeReviewedFullSwingSession(input,inspectFullSwingReadings(input),new Set(removedValues));
  const category = session.mode === "Machine BP" ? "practice" : "intrasquad";
  const preview = previewFullSwingSummary({ table:session.table,roster:[player],category,summaryConfirmed:true,file:{fileHash:hash,fileName:"fictional.csv",sheetName:"CSV · Full Swing session summaries v1"},mapping:{identityKind:"name",identityColumn:0,dateColumn:1,dateFormat:"ISO",source:"",metrics:SESSION_METRICS.map((m,i)=>({column:i+2,label:m.label,unit:m.unit}))} });
  return prepareFullSwingSessionBundle({ session,context:{fileName:"fictional.csv",fileHash:hash,date:session.date,category,matches:[{identity:name,athleteCode:player.athlete_code}]},summaries:preview.candidateMeasurements,
    assignments:session.mode === "Machine BP" ? [] : [2,3,4].map(sourceRow=>({sourceRow,pitchType:"Fastball" as const})),assignmentVersion:0,removedValues,excludedPlayerCount:0,requestId:"11111111-1111-4111-8111-111111111111",expectedRevision:0,replace:false });
}
const metric = (b: ReturnType<typeof bundle>, label: string) => b.measurements.find(row=>row.metric===label)?.value;
describe("complete Full Swing publication",()=>{
  it("prepares summaries, pitch results, contacts and exact sample sizes together",()=>{
    const b=bundle();
    expect(b.measurements).toHaveLength(14); expect(b.samples).toHaveLength(7); expect(b.contacts).toHaveLength(3);
    expect(b.unresolvedPitchCount).toBe(0); expect(metric(b,"Pitch Type Count")).toBe(3);
    expect(fullSwingSessionDatabasePayload(b).measurements.every(row=>row.file_hash===hash)).toBe(true);
    expect(JSON.stringify(b)).not.toContain(name); expect(JSON.stringify(b)).not.toContain("fictional-pitcher");
  });
  it("recalculates spin max/average/count without changing velocity or pitch count",()=>{
    const before=bundle(),after=bundle(["4:SpinRate"]);
    expect(metric(after,"Pitch Type Max Spin")).toBe(2000); expect(metric(after,"Pitch Type Average Spin")).toBe(1950);
    expect(metric(after,"Pitch Type Spin Readings")).toBe(2); expect(metric(after,"Pitch Type Count")).toBe(3);
    expect(metric(after,"Pitch Type Max Velocity")).toBe(metric(before,"Pitch Type Max Velocity")); expect(after.contacts).toEqual(before.contacts);
  });
  it("recalculates generic and classified velocity together",()=>{
    const b=bundle(["4:RelSpeed"]);
    expect(metric(b,"Max Velocity")).toBe(80); expect(metric(b,"Average Velocity")).toBe(79.5);
    expect(metric(b,"Pitch Type Average Velocity")).toBe(79.5); expect(metric(b,"Pitch Type Velocity Readings")).toBe(2);
    expect(b.samples.find(s=>s.metricKey==="avg_pitch_velocity")?.sampleCount).toBe(2);
  });
  it("distance removal retains contact EV/angle but removes the spatial pair",()=>{
    const b=bundle(["4:Distance"]);
    expect(metric(b,"Max Distance")).toBe(250); expect(b.samples.find(s=>s.metricKey==="max_distance")?.sampleCount).toBe(2);
    expect(b.contacts[2]).toMatchObject({exitVelocity:95,launchAngle:20,direction:null,distance:null});
  });
  it("exit-velocity removal updates both summary denominators and batted-ball charts",()=>{
    const b=bundle(["4:ExitSpeed"]);
    expect(metric(b,"Max EV")).toBe(90); expect(metric(b,"Average EV")).toBe(87.5); expect(b.contacts).toHaveLength(2);
    expect(b.samples.find(s=>s.metricKey==="avg_exit_velocity")?.sampleCount).toBe(2); expect(metric(b,"Pitch Type Count")).toBe(3);
  });
  it("keeps original coordinates after corrections and preserves raw precision",()=>{
    const before=bundle(),after=bundle(["4:BatSpeed"]);
    expect(metric(after,"Average Bat Speed")).toBe(56.5);
    expect(after.measurements.map(m=>m.id)).toEqual(before.measurements.map(m=>m.id));
    expect(after.expectedRevision).toBe(0); expect(after.replace).toBe(false);
  });
  it("Machine BP publishes practice hitting with no invented pitching",()=>{
    const b=bundle([],{Mode:"Machine BP",Environment:"Cage"});
    expect(b.category).toBe("practice"); expect(b.measurements).toHaveLength(5); expect(b.assignments).toEqual([]); expect(b.samples).toHaveLength(5);
    expect(()=>validateFullSwingSessionBundle({...b,category:"intrasquad"})).toThrow();
  });
  it("publishes available classified spin without inventing generic velocity or hitting results",()=>{
    const b=bundle([],{RelSpeed:"null",ExitSpeed:"null",BatSpeed:"null",Distance:"null"});
    expect(b.samples).toEqual([]); expect(b.contacts).toEqual([]);
    expect(metric(b,"Pitch Type Max Spin")).toBe(2100); expect(metric(b,"Max Velocity")).toBeUndefined();
    expect(metric(b,"Pitch Type Velocity Readings")).toBe(0);
  });
  it.each(["names","emails","rawCsv"])("rejects unsolicited payload field %s",key=>{
    expect(()=>validateFullSwingSessionBundle({...bundle(),[key]:"not allowed"})).toThrow();
  });
  it("rejects cross-file/date/context values, missing sample counts, duplicate measurements and extra row data",()=>{
    for (const field of ["file_hash","measured_at","source"] as const) {
      const b=bundle();b.measurements[0][field]="unexpected";expect(()=>validateFullSwingSessionBundle(b)).toThrow();
    }
    const missing=bundle();missing.samples.pop();expect(()=>validateFullSwingSessionBundle(missing)).toThrow();
    const duplicate=bundle();duplicate.measurements.push(duplicate.measurements[0]);expect(()=>validateFullSwingSessionBundle(duplicate)).toThrow();
    const raw=bundle();Object.assign(raw.contacts[0],{rawCsv:"not allowed"});expect(()=>validateFullSwingSessionBundle(raw)).toThrow();
  });
});
