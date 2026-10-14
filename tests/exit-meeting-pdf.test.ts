import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, PDFPage, Duplex } from "pdf-lib";
vi.mock("server-only",()=>({}));
import { createExitMeetingPdf } from "@/lib/exit-meeting-pdf";
import type { ExitMeetingReport, ExitMeetingRow, ExitMeetingSection } from "@/lib/exit-meeting";

afterEach(() => vi.restoreAllMocks());

// Synthetic export used for visual QA; no actual player data or source report.
const metric=(label:string,value:string,percentile:number|null=80):ExitMeetingRow=>({label,value,source:"Fictional Full Swing · Intrasquad",date:"2026-09-16",basis:"Latest saved result",percentile,peers:percentile===null?null:12,sample:"28 readings"});
const report:ExitMeetingReport={format:"detailed",name:"Fictional Boxer",code:"PAC-9999",jersey:"#0",position:"SS / P",academicClass:"Senior",batsThrows:"Bats R / Throws R",season:"Fall 2026",generatedAt:"2026-09-27T12:00:00Z",lastTested:"2026-09-16",lastGameUpdate:"2026-09-20T04:00:00Z",strengths:[{label:"Max Exit Velocity",detail:"105.2 mph · Full Swing Intrasquad · 2026-09-16 · 12 teammates",percentile:92},{label:"AVG · Hitting",detail:".350 · QPA Fall · 40 AB · 12 teammates",percentile:78}],development:[{label:"Average Exit Velocity",detail:"80.1 mph · Full Swing Intrasquad · 2026-09-16 · 12 teammates",percentile:22}],jumps:[{label:"Home to 1st",detail:"4.32 s to 4.18 s · 2026-09-15 to 2026-09-16 · Player Metrics",percentile:null}],missing:["Complete Blast Fall averages"],notes:["Percentiles compare at least five eligible teammates with the same metric, source, unit and period. Blue means a lower team rank; red means higher.","Body and spin comparisons are descriptive. No medical advice or invented training plan is included."],sections:[{id:"physicality",title:"Physicality",subtitle:"Latest recorded results",rows:[{...metric("Height","6′ 1″",70),source:"RENPHO",sample:null},{...metric("Weight","190 lb",45),source:"RENPHO",sample:null},{...metric("Body Fat %","12%",80),source:"RENPHO",sample:null},{...metric("Muscle Mass","160 lb",88),source:"RENPHO",sample:null},{...metric("RENPHO Body Score","88 points",null),source:"RENPHO",sample:null}]},{id:"hitting",title:"Hitting · In-Game",subtitle:"Latest profile results · Fall 2026",rows:[metric("Max Exit Velocity","105.2 mph",92),metric("Average Exit Velocity","80.1 mph",22),metric("Average Bat Speed","68.4 mph",80)],note:"In-Game and Practice use separate source comparisons."},{id:"arsenal",title:"Pitch Arsenal · In-Game",subtitle:"2026-09-16 · Staff-classified pitches",rows:[metric("Four-Seam Fastball · Average Velocity","82.2 mph",null),metric("Four-Seam Fastball · Max Velocity","86.1 mph",null),metric("Four-Seam Fastball · Average Spin","2110.4 rpm",null),metric("Four-Seam Fastball · Max Spin","2301.7 rpm",null)],note:"Spin is descriptive; a higher spin rate is not automatically better."},{id:"movement",title:"Movement Screening",subtitle:"Capstone · 2026-09-15",rows:Array.from({length:24},(_,i)=>({...metric(i%2?"Right Shoulder Internal Rotation":"Right Ankle Flexion",i%2?"65°":"3 / 5",null),source:"Capstone",sample:null,basis:i%2?"Range of motion":"Recorded rating",tone:i%3===0?"red":i%3===1?"yellow":"green"})),note:"Ratings use 1-5. Shoulder and hip range of motion use degrees. Ankle readings are ratings, not degrees."}]};
it("generates a real, paginated PDF with readable branded sections and no persistence by default",async()=>{
 const bytes=await createExitMeetingPdf(report,{meetingDate:"2026-10-01",talkingPoints:"Keep building consistent contact.\nReview the next testing date together."});const pdf=await PDFDocument.load(bytes);expect(pdf.getPageCount()).toBeGreaterThanOrEqual(4);expect(pdf.getPageCount()).toBeLessThanOrEqual(8);expect(pdf.getTitle()).toContain("Fictional Boxer");expect(pdf.getPages().every(p=>p.getSize().width===612&&p.getSize().height===792)).toBe(true);expect(Buffer.from(bytes).subarray(0,4).toString()).toBe("%PDF");
 if(process.env.EXIT_MEETING_QA_DIR){await mkdir(process.env.EXIT_MEETING_QA_DIR,{recursive:true});await writeFile(path.join(process.env.EXIT_MEETING_QA_DIR,"fictional-exit-meeting.pdf"),bytes);}
});
it("handles long player names, unbroken notes, and a long table without clipping into another page",async()=>{
 const drawn=vi.spyOn(PDFPage.prototype,"drawText");
 const long={...report,name:"Fictional Extremely Long Compound Player Name for Layout Verification",sections:[{id:"long",title:"Extended Fictional Measurement Report",subtitle:"Synthetic pagination stress test",rows:Array.from({length:70},(_,i)=>metric(`Long descriptive measurement label ${i+1} with an exceptionally extended name`,"1234.5 mph",i%100))}]};
 const bytes=await createExitMeetingPdf(long,{meetingDate:"2026-10-01",talkingPoints:"Word".repeat(400)});const pdf=await PDFDocument.load(bytes);expect(pdf.getPageCount()).toBeGreaterThan(8);expect(pdf.getPageCount()).toBeLessThan(25);
 for(const [text,options] of drawn.mock.calls){if(options?.font&&options.x!==undefined&&options.y!==undefined&&options.size!==undefined){expect(options.x).toBeGreaterThanOrEqual(38);expect(options.x+options.font.widthOfTextAtSize(text,options.size)).toBeLessThanOrEqual(574.1);expect(options.y).toBeGreaterThanOrEqual(20);expect(options.y+options.size).toBeLessThanOrEqual(780);}}
 for(const row of long.sections[0].rows)expect(drawnText(drawn)).toContain(normalized(row.label));
 assertNotesRetained(drawn, "Word".repeat(400));
 drawn.mockRestore();
 if(process.env.EXIT_MEETING_QA_DIR)await writeFile(path.join(process.env.EXIT_MEETING_QA_DIR,"fictional-exit-meeting-stress.pdf"),bytes);
});

// Canonical section IDs and keys mirror the Meeting Summary projection. All data is fictional.
const summaryRow = (metricKey: string, label: string, value: string, patch: Partial<ExitMeetingRow> = {}): ExitMeetingRow => ({
  ...metric(label, value), metricKey, ...patch,
});
const bodyRows: ExitMeetingRow[] = [
  ["height", "Height", "6′ 1″"], ["weight", "Weight", "191 lb"], ["muscle_mass", "Muscle Mass", "156 lb"],
  ["body_score", "Body Score", "87 points"], ["body_fat_pct", "Body Fat %", "13.4%"],
  ["grip_dominant", "Dominant Grip", "117 lb"], ["grip_non_dominant", "Non-Dominant Grip", "109 lb"],
].map(([key, label, value], index) => summaryRow(key, label, value, { source: index < 5 ? "RENPHO" : "Player Metrics", basis: "Latest profile result", sample: null, percentile: index === 3 ? null : 62, peers: index === 3 ? null : 12 }));
const battingRows: ExitMeetingRow[] = [
  ["batting_production_plus", "PAC Production+", "128.4", "48 plate appearances"],
  ["batting_ops", "OPS", ".912", "49 OBP opportunities"], ["batting_est_slg", "SLG", ".523", "40 AB"],
  ["batting_est_wobacon", "wOBAcon", ".394", "32 contact opportunities"], ["batting_avg", "AVG", ".311", "40 AB"],
  ["batting_obp", "OBP", ".389", "49 OBP opportunities"], ["qpa_pct", "QPA %", "64.2%", "48 plate appearances"],
  ["batting_hh_pct", "Hard Hit %", "38.5%", "31 contact opportunities"], ["batting_bb_pct", "BB %", "11.6%", "48 plate appearances"],
  ["batting_k_pct", "K %", "16.8%", "48 plate appearances"], ["pumps", "Home Runs", "3", "48 plate appearances"], ["sb", "Stolen Bases", "7", "48 plate appearances"],
].map(([key, label, value, sample], index) => summaryRow(key, label, value, { source: "QPA Fall Sheet", date: "2026-10-10", basis: "Updated snapshot", sample, percentile: 65 + index }));
const pitchingRows: ExitMeetingRow[] = [
  ["pitching_whip", "WHIP", "1.12", "14.2 IP"], ["pitching_k_bb", "K/BB", "3.40", "5 walks"],
  ["pitching_k9", "K/9", "10.20", "14.2 IP"], ["pitching_bb9", "BB/9", "3.00", "14.2 IP"],
  ["pitching_r9", "Runs/9", "4.80", "14.2 IP"], ["strike_pct", "Strike %", "66.7%", "231 pitches"],
  ["weak_contact_pct", "Weak Contact %", "61.3%", "36 classified contacts"], ["hard_contact_pct", "Hard Contact %", "38.7%", "36 classified contacts"],
].map(([key, label, value, sample], index) => summaryRow(key, label, value, { source: "Pitching Fall Sheet", date: "2026-10-10", basis: "Updated snapshot", sample, percentile: 88 - index }));
const hittingRows: ExitMeetingRow[] = [
  ["max_exit_velocity", "Max Exit Velocity", "105.2 mph"], ["avg_exit_velocity", "Average Exit Velocity", "80.1 mph"],
  ["avg_bat_speed", "Average Bat Speed", "68.4 mph"], ["max_bat_speed", "Max Bat Speed", "72.3 mph"], ["max_distance", "Max Distance", "375.1 ft"],
].map(([key, label, value]) => summaryRow(key, label, value, { source: "Full Swing · Intrasquad", basis: "Latest profile result", sample: "Session sample not shown" }));
const blastRows: ExitMeetingRow[] = [
  ["avg_bat_speed", "Bat Speed (Practice)", "66.8 mph"], ["blast_peak_hand_speed", "Hand Speed", "21.4 mph"],
  ["blast_attack_angle", "Attack Angle", "12.0 °"], ["blast_early_connection", "Early Connection", "84.0 °"], ["blast_vertical_bat_angle", "Vertical Bat Angle", "-24.0 °"],
].map(([key, label, value]) => summaryRow(key, label, value, { source: "Blast Motion · Practice", date: "2026-09-13 to 2026-10-04", basis: "Fall weighted average", sample: "220 swings · 3 reports", percentile: null, peers: null }));
const timedRows: ExitMeetingRow[] = [["home_to_first", "Home to 1st", "4.15 s"], ["home_to_second", "Home to 2nd", "7.32 s"], ["boxer_t", "Boxer T", "10.67 s"]]
  .map(([key, label, value], index) => summaryRow(key, label, value, { source: "Player Metrics", basis: `Best time · Average ${["4.25", "7.48", "10.91"][index]} s`, sample: "3 trials" }));
const arsenalRows = ["4-Seam Fastball", "Slider", "Curveball", "Changeup"].flatMap((pitch, index) => ["Velocity", "Spin"].map(family => summaryRow(
  `compact_pitch_${family.toLowerCase()}`, `${pitch} · ${family}`,
  family === "Velocity" ? `${(81.5 - index * 4).toFixed(1)} avg / ${(86 - index * 3).toFixed(1)} max mph` : `${2110 - index * 170} avg / ${2301 - index * 150} max rpm`,
  { source: "Full Swing · Intrasquad", date: "2026-09-11 to 2026-10-09", basis: "Fall weighted average / best", sample: family === "Velocity" ? "40 velocity readings · 2 sessions" : "36 spin readings · 2 sessions", percentile: null, peers: null },
)));
const compactBase: ExitMeetingReport = { ...report, format: "meeting", generatedAt: "2026-10-14T18:00:00Z", lastGameUpdate: "2026-10-10T19:00:00Z", missing: [], lastTested: "2026-10-09", sections: [
  { id: "physicality", title: "Physicality", subtitle: "Latest recorded measurements", rows: bodyRows },
  { id: "game-qpa_fall_2026", title: "Game Stats · Hitting", subtitle: "Fall to date · Current approved team-sheet totals", rows: battingRows },
  { id: "game-pitching_fall_2026", title: "Game Stats · Pitching", subtitle: "Fall to date · Current approved team-sheet totals", rows: pitchingRows },
  { id: "hitting-in_game", title: "Hitting · In-Game", subtitle: "Latest saved profile results · Fall 2026", rows: hittingRows },
  { id: "blast-fall", title: "Hitting · Blast Practice", subtitle: "Swing-weighted averages across reviewed, non-overlapping weekly exports", rows: blastRows },
  { id: "testing", title: "Running & Position Throwing", subtitle: "Best trial and trial average", rows: timedRows },
  { id: "arsenal-summary-intrasquad", title: "Pitch Arsenal · In-Game", subtitle: "Full Swing Intrasquad · Fall averages and bests", rows: arsenalRows },
], notes: [
  "Percentiles compare at least five teammates in the same test, source, unit and period. Red is higher, blue lower. Unranked means no verified comparison. Body and spin comparisons are descriptive.",
  "Game stats are Fall to date. Test values are latest, timed trials use best time, and pitch averages are weighted by recorded readings. In-Game and Practice are separate.",
  "Detailed Report includes all weekly Blast/P95, RENPHO, movement, supporting counts and saved pitch sessions.",
] };
const variants = [
  { name: "hitter", report: { ...compactBase, position: "SS", sections: compactBase.sections.filter(s => !["game-pitching_fall_2026", "arsenal-summary-intrasquad"].includes(s.id)) } },
  { name: "pitcher", report: { ...compactBase, position: "P", strengths: [{ label: "K/9 · Pitching", detail: "10.20 · 14.2 IP · 12 teammates · Updated 2026-10-10", percentile: 92 }], development: [], jumps: [], sections: compactBase.sections.filter(s => ["physicality", "game-pitching_fall_2026", "arsenal-summary-intrasquad"].includes(s.id)) } },
  { name: "two-way", report: compactBase },
];
const normalized = (value: string) => value.normalize("NFC").replace(/[′’‘]/g, "'").replace(/[″“”]/g, '"').replace(/[−–—]/g, "-").replace(/→/g, "to").replace(/\u00a0/g, " ").replace(/[^\x20-\x7e\u00a1-\u00ff\n]/g, "?").replace(/\s+/g, "");
type TextCalls = { mock: { calls: Parameters<PDFPage["drawText"]>[] } };
function assertTextBounds(drawn: TextCalls) {
  for (const [text, options] of drawn.mock.calls) if (options?.font && options.x !== undefined && options.y !== undefined && options.size !== undefined) {
    expect(options.x, text).toBeGreaterThanOrEqual(38);
    expect(options.x + options.font.widthOfTextAtSize(text, options.size), text).toBeLessThanOrEqual(574.1);
    expect(options.y, text).toBeGreaterThanOrEqual(20);
    expect(options.y + options.size, text).toBeLessThanOrEqual(780);
  }
}
function assertNotesRetained(drawn: TextCalls, notes: string) {
  // Running headers may be inserted between wrapped note fragments at a page boundary.
  const fragments = drawn.mock.calls.map(([value]) => value).filter(value => value.trim().length > 3 && notes.includes(value.trim()));
  expect(normalized(fragments.join(" "))).toContain(normalized(notes));
}
function drawnText(drawn: TextCalls) { return normalized(drawn.mock.calls.map(([text]) => text).join(" ")); }
const evidenceText = (value: string) => normalized(value).toLowerCase().replace(/[·,]/g, "");
const metadataAliases: Record<string, string> = {
  "Updated snapshot": "Updated", "Latest profile result": "Latest result", "Fall weighted average": "Fall weighted avg",
  "Fall weighted average / best": "Fall weighted avg / best",
};
function compactSample(value: string) { return value.replace(/plate appearances/g, "PA").replace(/classified contacts/g, "classified contact").replace(/velocity readings/g, "velo readings"); }
function shortDate(value: string) { return new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }); }
function assertRowsRetained(drawn: TextCalls, sections: ExitMeetingSection[]) {
  const text = evidenceText(drawn.mock.calls.map(([value]) => value).join(" "));
  const includes = (candidates: string[], context: string) => expect(candidates.some(value => text.includes(evidenceText(value))), context).toBe(true);
  for (const section of sections) {
    includes([section.title], `Section: ${section.id}`);
    for (const row of section.rows) {
      const context = `${section.id} / ${row.label}`;
      const arsenal = row.metricKey?.startsWith("compact_pitch_") && row.label.match(/^(.*) · (Velocity|Spin)$/);
      if (arsenal) {
        includes([arsenal[1]], `${context} / pitch name`);
        includes([arsenal[2]], `${context} / measurement family`);
        const pair = row.value.match(/^([\d.,]+|—|-) avg \/ ([\d.,]+|—|-) max (mph|rpm)$/);
        expect(pair, `${context} / fixture avg-max pair`).not.toBeNull();
        for (const value of pair!.slice(1)) includes([value], `${context} / exact value or unit ${value}`);
      } else {
        includes([row.label], `${context} / label`);
        includes([row.value], `${context} / exact value`);
      }
      includes([row.source], `${context} / source`);
      for (const date of row.date.split(" to ")) includes([date, /^\d{4}-\d\d-\d\d$/.test(date) ? shortDate(date) : date], `${context} / date ${date}`);
      includes([row.basis, metadataAliases[row.basis] ?? row.basis, ...(arsenal && row.basis === "Fall weighted average / best" ? ["Averages use matching reading counts. Max = Fall best."] : [])], `${context} / basis`);
      if (row.sample) includes([row.sample, compactSample(row.sample)], `${context} / sample`);
    }
  }
}

async function saveQa(filename: string, bytes: Uint8Array) {
  if (!process.env.EXIT_MEETING_QA_DIR) return;
  await mkdir(process.env.EXIT_MEETING_QA_DIR, { recursive: true });
  await writeFile(path.join(process.env.EXIT_MEETING_QA_DIR, filename), bytes);
}

describe("front-and-back meeting summary", () => {
  it.each(variants)("fits the populated $name report on two pages without losing selected metrics or evidence", async variant => {
    const drawn = vi.spyOn(PDFPage.prototype, "drawText");
    const before = structuredClone(variant.report);
    const bytes = await createExitMeetingPdf(variant.report, { meetingDate: "2026-10-14", talkingPoints: "Review the strongest results and select the next focus together." });
    const pdf = await PDFDocument.load(bytes);
    await saveQa(`fictional-meeting-summary-${variant.name}.pdf`, bytes);
    expect(pdf.getPageCount()).toBe(2);
    expect(pdf.catalog.getOrCreateViewerPreferences().getDuplex()).toBe(Duplex.DuplexFlipLongEdge);
    expect(pdf.getPages().every(page => page.getSize().width === 612 && page.getSize().height === 792)).toBe(true);
    assertTextBounds(drawn);
    assertRowsRetained(drawn, variant.report.sections);
    expect(variant.report).toEqual(before);
  });

  it("keeps sparse and empty reports honest without manufacturing result rows", async () => {
    for (const sections of [[], [{ ...compactBase.sections[0], rows: [bodyRows[1]] }]]) {
      const drawn = vi.spyOn(PDFPage.prototype, "drawText");
      const sparse = { ...compactBase, strengths: [], development: [], jumps: [], sections, missing: ["Complete Blast Fall averages", "Pitching game stats"] };
      const bytes = await createExitMeetingPdf(sparse, { meetingDate: "2026-10-14", talkingPoints: "" });
      const pdf = await PDFDocument.load(bytes);
      expect(pdf.getPageCount()).toBeLessThanOrEqual(2);
      assertTextBounds(drawn);
      assertRowsRetained(drawn, sections);
      expect(drawnText(drawn)).toContain(normalized("Complete Blast Fall averages"));
      expect(drawnText(drawn)).not.toContain(normalized("105.2 mph"));
      expect(drawnText(drawn)).not.toContain("NaN");
      expect(drawnText(drawn)).not.toContain("Infinity");
      drawn.mockRestore();
    }
  });

  it("preserves complete maximum-length coach notes and long names using an appendix when necessary", async () => {
    const drawn = vi.spyOn(PDFPage.prototype, "drawText");
    const talkingPoints = "NoteStart " + "Review".repeat(263) + " NoteEndDone";
    expect(talkingPoints).toHaveLength(1600);
    const long = { ...compactBase, name: "Fictional Very Long Compound Player Name for Meeting Layout Verification" };
    const bytes = await createExitMeetingPdf(long, { meetingDate: "2026-10-14", talkingPoints });
    const pdf = await PDFDocument.load(bytes);
    await saveQa("fictional-meeting-summary-stress.pdf", bytes);
    expect(pdf.getPageCount()).toBeLessThanOrEqual(4);
    assertTextBounds(drawn);
    assertRowsRetained(drawn, long.sections);
    assertNotesRetained(drawn, talkingPoints);
    expect(drawnText(drawn)).toContain(normalized(long.name));
  });

  it("preserves historical meeting sections and distinct source partitions instead of re-projecting saved content", async () => {
    const drawn = vi.spyOn(PDFPage.prototype, "drawText");
    const oldSections: ExitMeetingSection[] = [
      { id: "weeks-qpa_fall_2026", title: "Week by Week · Hitting", subtitle: "Each week's own counts", rows: [summaryRow("batting_ops", "OPS", ".766", { source: "QPA Fall Sheet", date: "2026-10-10", basis: "Week 3 only · Earlier: Week 2 .845", sample: "11 OBP opportunities" })] },
      { id: "pitch-grades", title: "Pitch+ (Team)", subtitle: "Saved historical outcome grades", rows: [summaryRow("pitch_plus", "Slider Pitch+", "112", { source: "Full Swing · Intrasquad", basis: "Saved team-relative outcome grade", sample: "42 family pitches", percentile: null, peers: null })] },
      { id: "movement", title: "Movement Screening", subtitle: "Saved historical screening", rows: [summaryRow("legacy_ankle", "Historical Ankle Flexion", "3 / 5", { source: "Capstone", basis: "Recorded rating", sample: null, percentile: null, peers: null })], note: "Historical section stays in this saved report." },
      { id: "arsenal-summary-practice", title: "Pitch Arsenal · Practice", subtitle: "Saved Practice source", rows: [{ ...arsenalRows[0], value: "77.1 avg / 82.2 max mph", source: "Full Swing · Practice", sample: "19 velocity readings · 1 session" }] },
      { id: "saved-extra", title: "Historical Extra Section", subtitle: "Original saved display values", rows: [summaryRow("saved_metric", "Legacy Recorded Result", "18.7 units", { source: "Saved Fictional Protocol", sample: "9 saved trials", basis: "Original saved value" })] },
    ];
    const legacy = { ...compactBase, sections: [...compactBase.sections, ...oldSections] };
    const before = structuredClone(legacy);
    const bytes = await createExitMeetingPdf(legacy, { meetingDate: "2026-10-14", talkingPoints: "Saved meeting notes remain intact." });
    const pdf = await PDFDocument.load(bytes);
    await saveQa("fictional-meeting-summary-legacy.pdf", bytes);
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(2);
    assertTextBounds(drawn);
    assertRowsRetained(drawn, legacy.sections);
    expect(drawnText(drawn)).toContain(normalized(oldSections.find(section => section.id === "movement")!.note!));
    expect(legacy).toEqual(before);
  });
});

it("retains bounded historical highlight evidence and many distinct result references without clipping",async()=>{
 const drawn=vi.spyOn(PDFPage.prototype,"drawText");
 const detail=(tag:string)=>`${tag} ${"Fictional saved evidence. ".repeat(44)} ${tag} End`;
 const highlights=[{label:"Fictional Recorded Strength",detail:detail("StrengthEvidence"),percentile:90},{label:"Fictional Second Strength",detail:detail("SecondEvidence"),percentile:82}];
 const rows=Array.from({length:100},(_,i)=>summaryRow(`historical_${i}`,`Historical Metric ${i+1}`,`${100+i}.7 units`,{source:`Fictional Protocol ${i+1}`,basis:`Original saved basis ${i+1}`,sample:`${i+1} saved trials`,date:"2026-09-16"}));
 const historical={...compactBase,strengths:highlights,development:[{label:"Fictional Development",detail:detail("DevelopmentEvidence"),percentile:18}],jumps:[{label:"Fictional Progress",detail:detail("ProgressEvidence"),percentile:null}],sections:[{id:"historical-many",title:"Historical Results",subtitle:"Saved result context",rows}]};
 const bytes=await createExitMeetingPdf(historical,{meetingDate:"2026-10-14",talkingPoints:""});const pdf=await PDFDocument.load(bytes);
 expect(pdf.getPageCount()).toBeGreaterThan(2);expect(pdf.getPageCount()).toBeLessThan(30);assertTextBounds(drawn);assertRowsRetained(drawn,historical.sections);
 for(const item of [...historical.strengths,...historical.development,...historical.jumps]){const plain=drawnText(drawn);expect(plain).toContain(normalized(item.label));expect(plain).toContain(normalized(item.detail.split(" ")[0]));expect(plain).toContain(normalized(`${item.detail.split(" ")[0]} End`));}
 await saveQa("fictional-meeting-summary-many-saved-results.pdf",bytes);
});

it("keeps arsenal velocity and spin evidence separate when dates and reading counts differ",async()=>{
 const drawn=vi.spyOn(PDFPage.prototype,"drawText");
 const rows=[{...arsenalRows[0],date:"2026-09-11 to 2026-10-09",sample:"40 velocity readings · 2 sessions"},{...arsenalRows[1],date:"2026-09-11",sample:"7 spin readings · 1 session"}];
 const section={...compactBase.sections.at(-1)!,rows};
 await createExitMeetingPdf({...compactBase,sections:[section],strengths:[],development:[],jumps:[]},{meetingDate:"2026-10-14",talkingPoints:""});
 const plain=drawnText(drawn);expect(plain).toContain(normalized("Velocity: Sep 11 - Oct 9"));expect(plain).toContain(normalized("Spin: Sep 11"));expect(plain).toContain(normalized("40 velo readings · 2 sessions"));expect(plain).toContain(normalized("7 spin readings · 1 session"));assertRowsRetained(drawn,[section]);assertTextBounds(drawn);
});

 it("fits separate In-Game and Practice arsenals and recorded position throwing on the normal duplex handout",async()=>{
  const drawn=vi.spyOn(PDFPage.prototype,"drawText");
  const practice={...compactBase.sections.at(-1)!,id:"arsenal-summary-practice",title:"Pitch Arsenal · Practice",rows:arsenalRows.map(r=>({...r,source:"Full Swing · Practice",date:"2026-10-09",sample:r.metricKey==="compact_pitch_velocity"?"15 velocity readings · 1 session":"12 spin readings · 1 session"}))};
  const sections=[...compactBase.sections.map(s=>s.id==="testing"?{...s,rows:[...s.rows,summaryRow("infield_velocity","Infield Velocity","84.5 mph",{source:"Manual Testing",sample:"3 throws",basis:"Latest result"}),summaryRow("outfield_velocity","Outfield Velocity","88.2 mph",{source:"Manual Testing",sample:"4 throws",basis:"Latest result"})]}:s),practice];
  const bytes=await createExitMeetingPdf({...compactBase,position:"SS",sections},{meetingDate:"2026-10-14",talkingPoints:"Review both source contexts together."});
  const pdf=await PDFDocument.load(bytes);await saveQa("fictional-meeting-summary-two-contexts.pdf",bytes);expect(pdf.getPageCount()).toBe(2);assertTextBounds(drawn);assertRowsRetained(drawn,sections);
 });
