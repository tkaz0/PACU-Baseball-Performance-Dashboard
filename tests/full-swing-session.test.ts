import { describe, expect, it } from "vitest";
import { FULL_SWING_SESSION_HEADERS as headers, summarizeFullSwingSession } from "@/lib/imports/full-swing-session";
import { previewFullSwingSummary } from "@/lib/imports/full-swing";
import { getPreviewRoster } from "@/lib/preview-roster";
import { groupPitchRanges, SESSION_METRICS } from "@/lib/imports/full-swing-session";
import { prepareFullSwingContacts, REVIEWED_CONTACT_FIELDS } from "@/lib/imports/full-swing-contacts";
import { fullSwingValueKey, inspectFullSwingReadings, LOW_EXIT_VELOCITY_REVIEW_MPH, omitFullSwingReadings, summarizeReviewedFullSwingSession } from "@/lib/imports/full-swing-misreads";
import { fullSwingSamplesForImport } from "@/lib/imports/full-swing-samples";
import { fullSwingFileLabel } from "@/lib/full-swing-file-label";

const player = getPreviewRoster()[0];
const name = `${player.first_name} ${player.last_name}`;
const event = (overrides: Record<string, string> = {}) => headers.map(h => ({ PitchNo: "1", Date: "09/11/26", Pitcher: name, PitcherId: "fictional-pitcher", Batter: name, BatterId: "fictional-batter", RelSpeed: "80", SpinRate: "1800", ExitSpeed: "90", BatSpeed: "60", Distance: "250", Environment: "Field", Mode: "Live at Bat", ...overrides } as Record<string, string>)[h] ?? "null");
const table = (rows = [event(), event({ PitchNo: "2", RelSpeed: "84", ExitSpeed: "null", BatSpeed: "70", Distance: "null" })]) => ({ headers: [...headers], rows, rowNumbers: rows.map((_, i) => i + 2) });

describe("reviewed Full Swing Live at Bat session", () => {
  it("separates pitching and hitting, skips nulls, and uses each metric's sample", () => {
    const result = summarizeFullSwingSession(table());
    expect(result).toMatchObject({ date: "2026-09-11", eventCount: 2, pitcherCount: 1, batterCount: 1 });
    const hitter = result.table.rows.find(r => r[2]);
    const pitcher = result.table.rows.find(r => r[7]);
    expect(hitter?.slice(2)).toEqual(["90", "90", "70", "65", "250", "", ""]);
    expect(pitcher?.slice(2)).toEqual(["", "", "", "", "", "84", "82"]);
    expect(result.samples.find(s => s.metric === "Average EV")?.count).toBe(1);
    expect(result.samples.find(s => s.metric === "Average Bat Speed")?.count).toBe(2);
    expect(result.samples.find(s => s.metric === "Average Velocity")?.sourceRows).toEqual([2, 3]);
  });
  it("preserves original file with distinct derived-summary coordinates", () => {
    const session = summarizeFullSwingSession(table());
    const preview = previewFullSwingSummary({ table: session.table, roster: [player], category: "intrasquad", summaryConfirmed: true, file: { fileHash: "a".repeat(64), fileName: "fictional.csv", sheetName: "CSV · Full Swing session summaries v1" }, mapping: { identityKind: "name", identityColumn: 0, dateColumn: 1, dateFormat: "ISO", source: "", metrics: SESSION_METRICS.map((m, i) => ({ column: i + 2, label: m.label, unit: m.unit })) } });
    expect(preview.canApply).toBe(true);
    expect(preview.candidateMeasurements).toHaveLength(7);
    expect(new Set(preview.candidateMeasurements.map(m => m.id)).size).toBe(7);
    expect(preview.candidateMeasurements.every(m => m.source === "Full Swing · Intrasquad" && [2, 3].includes(m.source_row))).toBe(true);
    expect(preview.candidateMeasurements.some(m => /Spin|Strike|Smash|Potential/.test(m.metric))).toBe(false);
    const counts = fullSwingSamplesForImport(session, [{ identity: name, athleteCode: player.athlete_code }], preview.candidateMeasurements);
    expect(counts).toHaveLength(7);
    expect(counts.find(c => c.metricKey === "avg_bat_speed")?.sampleCount).toBe(2);
    expect(counts.find(c => c.metricKey === "avg_exit_velocity")?.sampleCount).toBe(1);
    expect(counts.find(c => c.metricKey === "avg_bat_speed")?.expectedValue).toBe(65);
    expect(counts.every(c => c.fileHash === "a".repeat(64) && [2, 3].includes(c.sourceRow))).toBe(true);
  });
  it.each(["0", "-3", "Infinity", "80 mph"])("rejects malformed speed %s", RelSpeed => expect(() => summarizeFullSwingSession(table([event({ RelSpeed })]))).toThrow("RelSpeed"));
  it("retains recorded zero distance and withholds missing hitting readings", () => {
    const r = summarizeFullSwingSession(table([event({ Distance: "0", ExitSpeed: "null", BatSpeed: "null" })]));
    expect(r.table.rows.find(row => row[6] === "0")?.slice(2, 6)).toEqual(["", "", "", ""]);
  });
  it("rejects repeated pitches, changed layouts, mixed dates and unknown modes", () => {
    expect(() => summarizeFullSwingSession(table([event(), event()]))).toThrow("repeated");
    expect(() => summarizeFullSwingSession({ ...table(), headers: headers.slice(1) })).toThrow("layout");
    expect(() => summarizeFullSwingSession(table([event(), event({ PitchNo: "2", Date: "09/12/26" })]))).toThrow("one dated");
    expect(() => summarizeFullSwingSession(table([event({ Mode: "Bullpen" })]))).toThrow("Live at Bat");
    expect(() => summarizeFullSwingSession(table([event({ Date: "08/31/26" })]))).toThrow("Fall 2026");
    expect(() => summarizeFullSwingSession(table([event({ Date: "09/31/26" })]))).toThrow();
  });
  it("does not merge conflicting vendor identities", () => {
    expect(() => summarizeFullSwingSession(table([event(), event({ PitchNo: "2", BatterId: "another-fictional-id" })]))).toThrow("conflicting");
    expect(() => summarizeFullSwingSession(table([event({ Batter: "null" })]))).toThrow("identity");
  });
});

it("shows BDL only for September 11 Full Swing files while preserving other dates", () => {
  expect(fullSwingFileLabel("Session_2026-09-11_example.csv", "Full Swing · Intrasquad")).toBe("BDL (September 11th)");
  expect(fullSwingFileLabel("another.csv", "Full Swing · Intrasquad", "2026-09-11")).toBe("BDL (September 11th)");
  expect(fullSwingFileLabel("Session_2026-09-23_example.csv", "Full Swing · Intrasquad", "2026-09-23")).toBe("Session_2026-09-23_example");
  expect(fullSwingFileLabel("Session_2026-09-11_example.csv", "Blast Motion · Hitting", "2026-09-11")).toBe("Session_2026-09-11_example");
});

it("keeps every export identity in review, including batters without measurements", () => {
 const rows=Array.from({length:15},(_,i)=>event({PitchNo:String(i+1),Batter:`Fictional Batter ${i}`,BatterId:`fictional-${i}`,ExitSpeed:"null",BatSpeed:"null",Distance:"null"}));
 const r=summarizeFullSwingSession(table(rows));
 expect(r.players.filter(p=>p.role==="Batter")).toHaveLength(15);
 expect(r.players.filter(p=>p.role==="Batter").every(p=>p.values.every(v=>v===""))).toBe(true);
 expect(r.table.rows).toHaveLength(1); // No invented zero-valued hitting measurements to save.
});
it("bins velocity/spin by pitcher with exact boundaries and missing spin separate", () => {
 const r=summarizeFullSwingSession(table([
 event({RelSpeed:"84.99",SpinRate:"1999.9"}),event({PitchNo:"2",RelSpeed:"85",SpinRate:"2000"}),
 event({PitchNo:"3",RelSpeed:"85",SpinRate:"null"}),event({PitchNo:"4",Pitcher:"Fictional Other",PitcherId:"fictional-other",RelSpeed:"85",SpinRate:"2000"})]));
 const groups=groupPitchRanges(r.pitches,5,250,"fixed");
 expect(groups).toHaveLength(4);expect(groups.reduce((n,g)=>n+g.count,0)).toBe(4);
 expect(groups).toContainEqual(expect.objectContaining({identity:name,velocityStart:80,spinStart:1750,count:1}));
 expect(groups).toContainEqual(expect.objectContaining({identity:name,velocityStart:85,spinStart:2000,count:1}));
 expect(groups).toContainEqual(expect.objectContaining({spinStart:null,averageSpin:null}));
 expect(groupPitchRanges(r.pitches,10,500,"fixed")).toHaveLength(4);
 expect(()=>groupPitchRanges(r.pitches,0,250)).toThrow();
});
it("keeps unreadable spin out of numerical groups without blocking summary imports",()=>{
 const r=summarizeFullSwingSession(table([event({SpinRate:"broken"})]));
 expect(r.pitches[0].spin).toBeNull();expect(r.table.rows).toHaveLength(2);
});

it("preserves exact row-paired batted balls and excludes incomplete pairs and unmatched hitters", () => {
 const session=summarizeFullSwingSession(table([
  event({Angle:"-12.5",ExitSpeed:"94.321"}),
  event({PitchNo:"2",Angle:"18",ExitSpeed:"null"}),
  event({PitchNo:"3",Batter:"Fictional Guest",BatterId:"fictional-guest",Angle:"22",ExitSpeed:"81"}),
 ]));
 expect(session.contacts).toEqual([
  {identity:name,exitVelocity:94.321,launchAngle:-12.5,direction:null,distance:null,sourceRow:2,pitchNumber:1},
  {identity:"Fictional Guest",exitVelocity:81,launchAngle:22,direction:null,distance:null,sourceRow:4,pitchNumber:3},
 ]);
 const rows=prepareFullSwingContacts(session,{fileHash:"a".repeat(64),fileName:"fictional.csv",date:session.date,category:"intrasquad",matches:[{identity:name,athleteCode:"PAC-0001"}]});
 expect(rows).toEqual([{athleteCode:"PAC-0001",fileHash:"a".repeat(64),sourceFile:"fictional.csv",sourceRow:2,pitchNumber:1,playedOn:"2026-09-11",category:"intrasquad",exitVelocity:94.321,launchAngle:-12.5,direction:null,distance:null}]);
 expect(Object.keys(rows[0]).sort()).toEqual(REVIEWED_CONTACT_FIELDS);
 expect(()=>summarizeFullSwingSession(table([event({Angle:"120"})]))).toThrow("Angle");
});
it("keeps direction and feet on the same contact row without inferring incomplete spatial pairs",()=>{
 const report=summarizeFullSwingSession(table([event({Angle:"19",Direction:"-14.5",Distance:"245"}),event({PitchNo:"2",Angle:"25",Direction:"11",Distance:"null"})]));
 expect(report.contacts.map(row=>[row.direction,row.distance])).toEqual([[-14.5,245],[null,null]]);
});

it("groups nearby velocities across old boundaries until a 3 mph gap, preserving pitcher/spin/missing partitions",()=>{
 const r=summarizeFullSwingSession(table([event({PitchNo:"1",RelSpeed:"79",SpinRate:"2000"}),event({PitchNo:"2",RelSpeed:"81",SpinRate:"2100"}),event({PitchNo:"3",RelSpeed:"83",SpinRate:"2001"}),event({PitchNo:"4",RelSpeed:"86",SpinRate:"2010"}),event({PitchNo:"5",RelSpeed:"81",SpinRate:"null"}),event({PitchNo:"6",RelSpeed:"81",SpinRate:"2400"})]));
 const before=structuredClone(r.pitches),groups=groupPitchRanges(r.pitches);
 expect(groups).toHaveLength(4);
 expect(groups).toContainEqual(expect.objectContaining({velocityStart:79,velocityEnd:83,count:3,sourceRows:[2,3,4],averageVelocity:81}));
 expect(groups).toContainEqual(expect.objectContaining({velocityStart:86,velocityEnd:86,count:1}));
 expect(groups.reduce((sum,g)=>sum+g.count,0)).toBe(6);expect(r.pitches).toEqual(before);
 expect(groupPitchRanges([...r.pitches].reverse())).toEqual(groups);
 expect(groupPitchRanges(r.pitches,3,250,"fixed").length).toBeGreaterThan(groups.length);
});

it("flags a high tracking value and excludes only that CSV cell from every derived view",()=>{
 const source=table([
  event({PitchNo:"1",RelSpeed:"80",ExitSpeed:"89",Angle:"20"}),
  event({PitchNo:"2",RelSpeed:"81",ExitSpeed:"90",Angle:"21"}),
  event({PitchNo:"3",RelSpeed:"82",ExitSpeed:"91",Angle:"22"}),
  event({PitchNo:"4",RelSpeed:"80",ExitSpeed:"92",Angle:"23"}),
  event({PitchNo:"5",RelSpeed:"81",ExitSpeed:"93",Angle:"24"}),
  event({PitchNo:"6",RelSpeed:"150",ExitSpeed:"180",Angle:"25"}),
 ]);
 const readings=inspectFullSwingReadings(source);
 expect(readings.find(row=>row.key===fullSwingValueKey(7,"RelSpeed"))?.reason).toMatch(/high/);
 expect(readings.find(row=>row.key===fullSwingValueKey(7,"ExitSpeed"))?.reason).toMatch(/high/);
 const excluded=new Set([fullSwingValueKey(7,"RelSpeed"),fullSwingValueKey(7,"ExitSpeed")]);
 const reviewed=summarizeReviewedFullSwingSession(source,readings,excluded);
 expect(reviewed.pitches.find(p=>p.sourceRow===7)?.velocity).toBeNull();
 expect(reviewed.pitches.find(p=>p.sourceRow===7)?.spin).toBe(1800);
 expect(reviewed.contacts.some(contact=>contact.sourceRow===7)).toBe(false);
 expect(reviewed.table.rows.find(row=>row[7])?.[8]).toBe("80.8");
 expect(reviewed.samples.find(sample=>sample.metric==="Average EV")?.count).toBe(5);
 expect(source.rows[5][source.headers.indexOf("RelSpeed")]).toBe("150");
 expect(()=>omitFullSwingReadings(source,readings,new Set(["99:RelSpeed"]))).toThrow("no longer matches");
});

it("reviews hitter outliers from a short session without changing valid pitcher results",()=>{
 const source=table([
  event({PitchNo:"1",RelSpeed:"80",ExitSpeed:"70",BatSpeed:"60",Distance:"100"}),
  event({PitchNo:"2",RelSpeed:"81",ExitSpeed:"72",BatSpeed:"61",Distance:"120"}),
  event({PitchNo:"3",RelSpeed:"90",ExitSpeed:"115",BatSpeed:"85",Distance:"490"}),
 ]);
 const readings=inspectFullSwingReadings(source);
 for(const field of ["ExitSpeed","BatSpeed","Distance"] as const)
  expect(readings.find(row=>row.key===fullSwingValueKey(4,field))).toMatchObject({actor:"Batter",reason:"Much higher than this player's other readings"});
 expect(readings.find(row=>row.key===fullSwingValueKey(4,"RelSpeed"))).toMatchObject({actor:"Pitcher",reason:null});
 const excluded=new Set([fullSwingValueKey(4,"ExitSpeed"),fullSwingValueKey(4,"BatSpeed"),fullSwingValueKey(4,"Distance")]);
 const reviewed=summarizeReviewedFullSwingSession(source,readings,excluded);
 expect(reviewed.table.rows.find(row=>row[2])?.slice(2,7)).toEqual(["72","71","61","60.5","120"]);
 expect(reviewed.table.rows.find(row=>row[7])?.slice(7)).toEqual(["90","83.66666666666667"]);
 expect(reviewed.contacts.some(contact=>contact.sourceRow===4)).toBe(false);
});

it("marks exit velocities below the low-70s review line without deleting legitimate soft contact",()=>{
 const source=table([
  event({PitchNo:"1",ExitSpeed:"71.9"}),
  event({PitchNo:"2",ExitSpeed:"72"}),
 ]);
 const readings=inspectFullSwingReadings(source);
 expect(LOW_EXIT_VELOCITY_REVIEW_MPH).toBe(72);
 expect(readings.find(row=>row.key===fullSwingValueKey(2,"ExitSpeed"))?.reason).toContain("Below 72 mph");
 expect(readings.find(row=>row.key===fullSwingValueKey(3,"ExitSpeed"))?.reason).toBeNull();
 expect(summarizeReviewedFullSwingSession(source,readings,new Set()).table.rows.find(row=>row[2])?.[2]).toBe("72");
});

it("requires explicit removal of invalid readings and keeps later summary coordinates stable",()=>{
 const source=table([
  event({PitchNo:"1",ExitSpeed:"-10",BatSpeed:"60",Distance:"250"}),
  event({PitchNo:"2",Batter:"Fictional Other",BatterId:"fictional-other",ExitSpeed:"90",BatSpeed:"62",Distance:"240"}),
 ]);
 const readings=inspectFullSwingReadings(source);
 expect(readings.find(row=>row.key===fullSwingValueKey(2,"ExitSpeed"))?.blocking).toBe(true);
 expect(()=>summarizeReviewedFullSwingSession(source,readings,new Set())).toThrow("invalid");
 const base=summarizeReviewedFullSwingSession(source,readings,new Set([fullSwingValueKey(2,"ExitSpeed")]));
 const excluded=new Set([fullSwingValueKey(2,"ExitSpeed"),fullSwingValueKey(2,"BatSpeed"),fullSwingValueKey(2,"Distance")]);
 const reviewed=summarizeReviewedFullSwingSession(source,readings,excluded);
 expect(reviewed.table.rowNumbers.at(-1)).toBe(base.table.rowNumbers.at(-1));
 expect(reviewed.players.find(player=>player.identity===name&&player.role==="Batter")?.values.every(value=>!value)).toBe(true);
 expect(reviewed.table.rows.some(row=>row[0]===name&&row[2])).toBe(false);
});
