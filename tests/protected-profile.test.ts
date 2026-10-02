import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role, RosterAthlete } from "@/lib/types";
import type { Measurement } from "@/lib/imports/engine";

const fake = vi.hoisted(() => ({ access: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), single: vi.fn(), rpc: vi.fn(), load: vi.fn(), contacts: vi.fn(), charts: vi.fn(), games: vi.fn(), comparisons: vi.fn(), logs: vi.fn(), team: vi.fn(), speed: vi.fn(), movement: vi.fn(), goals: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/blast-speed-percentile-server", () => ({ loadBlastBatSpeedPercentile: fake.speed }));
vi.mock("@/lib/player-goals-server", () => ({ loadPlayerGoals: fake.goals }));
vi.mock("@/lib/movement-server", () => ({ loadMovementScreening: fake.movement }));
vi.mock("@/lib/render-access", () => ({ requireRenderAccess: fake.access }));
vi.mock("@/lib/hitting-team-server", () => ({ loadHittingTeamAverages: fake.team }));
vi.mock("@/lib/performance-server", () => ({ loadAthletePerformance: fake.load }));
vi.mock("@/lib/full-swing-contacts-server", () => ({ loadFullSwingContacts: fake.contacts }));
vi.mock("@/lib/game-comparison-server", () => ({ loadGameComparisons: fake.comparisons }));
vi.mock("@/lib/game-log-server", () => ({ loadGameLogs: fake.logs }));
vi.mock("@/lib/game-server", () => ({ loadGameStats: fake.games }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); },useRouter:()=>({refresh:vi.fn()}) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: { href: string; children: ReactNode }) => createElement("a", { href, ...props }, children) }));
vi.mock("@/components/renpho-charts", () => ({ RenphoCharts: fake.charts }));
vi.mock("@/lib/headshots-server", () => ({ loadTeamHeadshots: async () => new Map(), loadAthleteHeadshot: async () => null }));

import Profile from "@/app/(workspace)/athletes/[id]/page";

const ownId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", otherId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const athlete: RosterAthlete = {
  id: ownId, athlete_code: "SYN-001", first_name: "Fictional", last_name: "Profile", preferred_name: null,
  pacific_email: "private-roster@example.com", profile_photo_url: null, created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z",
  athlete_seasons: [{ athlete_id: ownId, season: "2026-27", jersey_number: 0, primary_position: "OF", secondary_position: null, player_type: "two_way",
    bats: "R", throws: "R", academic_class: "graduate", eligibility_year: 4, graduation_year: 2027, roster_status: "redshirt" }],
};
const reading = (change: Partial<Measurement> = {}): Measurement => ({
  id: "fictional-reading", athlete_code: athlete.athlete_code, measured_at: "2026-09-12", source: "Fictional hitting test", metric: "Max EV",
  value: 10, unit: "mph", source_file: "fictional.csv", source_sheet: "Values", source_row: 2, file_hash: "a".repeat(64), ...change,
});
const ownPlan={id:"11111111-1111-4111-8111-111111111111",athleteId:ownId,weekStart:"2026-09-28",focus:"Fictional shared weekly plan",drills:[{id:"33333333-3333-4333-8333-333333333333",title:"Fictional drill",cue:"Fictional shared cue",completedAt:null}],staffNote:"Fictional private weekly note",shared:true,archived:false,revision:1,createdAt:"2026-09-29T00:00:00Z",updatedAt:"2026-09-29T00:00:00Z"};
const ownAnnotation={id:"55555555-5555-4555-8555-555555555555",athleteId:ownId,date:"2026-09-20",category:"swing_cue",scope:"hitting_practice",note:"Fictional shared chart note",shared:true,archived:false,revision:1,createdAt:"2026-09-20T00:00:00Z"};
const contact={fileHash:"a".repeat(64),sourceRow:2,pitchNumber:1,sourceFile:"fictional-contact.csv",playedOn:"2026-09-11",category:"intrasquad",exitVelocity:90,launchAngle:20,direction:5,distance:230};
function access(roles: Role[] = ["player"], athleteId: string | null = ownId, preview = false) {
  return { roles, athleteId, actualRoles: preview ? ["admin"] : roles, preview: preview ? { role: roles[0], athleteId: roles[0] === "player" ? ownId : null } : null,
    user: { id: "fictional-user", email: "private-login@example.com" }, supabase: { from: fake.from, rpc: fake.rpc } };
}
beforeEach(() => {
  vi.resetAllMocks(); fake.speed.mockResolvedValue(null); fake.goals.mockResolvedValue({goals:[],choices:[]}); fake.movement.mockResolvedValue(null); fake.comparisons.mockResolvedValue([]); fake.team.mockResolvedValue([]);
  const chain = { select: fake.select, eq: fake.eq, maybeSingle: fake.single };
  fake.from.mockReturnValue(chain); fake.select.mockReturnValue(chain); fake.eq.mockReturnValue(chain);
  fake.single.mockResolvedValue({ data: athlete, error: null });
  fake.access.mockResolvedValue(access());
  fake.load.mockResolvedValue({ measurements: [reading()], batches: [], percentileOverrides: [] });
  fake.contacts.mockResolvedValue([]);
  fake.rpc.mockResolvedValue({data:[],error:null});
  fake.games.mockResolvedValue([]); fake.logs.mockResolvedValue([]);
  fake.charts.mockImplementation(() => createElement("p", null, "Fictional chart boundary"));
});

describe("protected profile route authorization and integration", () => {
  it("requires authentication before querying any profile or performance data", async () => {
    fake.access.mockRejectedValueOnce(new Error("REDIRECT:/login"));
    await expect(Profile({ params: Promise.resolve({ id: ownId }) })).rejects.toThrow("REDIRECT:/login");
    expect(fake.goals).not.toHaveBeenCalled(); expect(fake.movement).not.toHaveBeenCalled(); expect(fake.from).not.toHaveBeenCalled(); expect(fake.load).not.toHaveBeenCalled(); expect(fake.games).not.toHaveBeenCalled(); expect(fake.logs).not.toHaveBeenCalled();
    expect(fake.rpc).not.toHaveBeenCalled();
  });
  it.each([otherId, "LOCAL-0001", "", "../../admin/access", ownId + "\n"])("rejects malformed or another player's ID %# before the profile query", async id => {
    await expect(Profile({ params: Promise.resolve({ id }) })).rejects.toThrow("NOT_FOUND");
    expect(fake.goals).not.toHaveBeenCalled(); expect(fake.movement).not.toHaveBeenCalled(); expect(fake.from).not.toHaveBeenCalled(); expect(fake.load).not.toHaveBeenCalled(); expect(fake.games).not.toHaveBeenCalled(); expect(fake.logs).not.toHaveBeenCalled();
    expect(fake.rpc).not.toHaveBeenCalled();
  });
  it("does not fall back to actual admin authority during a player preview", async () => {
    fake.access.mockResolvedValueOnce(access(["player"], ownId, true));
    await expect(Profile({ params: Promise.resolve({ id: otherId }) })).rejects.toThrow("NOT_FOUND");
    expect(fake.goals).not.toHaveBeenCalled(); expect(fake.movement).not.toHaveBeenCalled(); expect(fake.from).not.toHaveBeenCalled(); expect(fake.load).not.toHaveBeenCalled(); expect(fake.games).not.toHaveBeenCalled(); expect(fake.logs).not.toHaveBeenCalled();
    expect(fake.rpc).not.toHaveBeenCalled();
  });
  it("denies unlinked players and missing/error profile results without loading measurements", async () => {
    fake.access.mockResolvedValueOnce(access(["player"], null));
    await expect(Profile({ params: Promise.resolve({ id: ownId }) })).rejects.toThrow("NOT_FOUND");
    fake.single.mockResolvedValueOnce({ data: null, error: null });
    await expect(Profile({ params: Promise.resolve({ id: ownId }) })).rejects.toThrow("NOT_FOUND");
    fake.single.mockResolvedValueOnce({ data: null, error: { message: "fictional query failure" } });
    await expect(Profile({ params: Promise.resolve({ id: ownId }) })).rejects.toThrow("Unable to load this athlete profile");
    expect(fake.load).not.toHaveBeenCalled(); expect(fake.games).not.toHaveBeenCalled(); expect(fake.logs).not.toHaveBeenCalled();
  });
  it("queries the requested athlete and loads only its explicitly authorized performance input", async () => {
    const trusted = access(); fake.access.mockResolvedValueOnce(trusted);
    const html = renderToStaticMarkup(await Profile({ params: Promise.resolve({ id: ownId.toUpperCase() }) }));
    expect(fake.from).toHaveBeenCalledExactlyOnceWith("athletes");
    expect(fake.eq).toHaveBeenCalledExactlyOnceWith("id", ownId.toUpperCase());
    expect(fake.load).toHaveBeenCalledExactlyOnceWith(trusted, athlete);
    expect(fake.contacts).toHaveBeenCalledExactlyOnceWith(trusted, athlete.id);
    expect(fake.goals).toHaveBeenCalledExactlyOnceWith(trusted, athlete.id);
    expect(fake.games).toHaveBeenCalledExactlyOnceWith(trusted, athlete.id);
    expect(fake.logs).not.toHaveBeenCalled();
    expect(fake.team).toHaveBeenCalledExactlyOnceWith(trusted);
    expect(fake.speed).not.toHaveBeenCalled();
    expect(html).toContain(`href="/swing-design?athlete=${athlete.id}"`);
    expect(html).toContain(`href="/pitch-design?athlete=${athlete.id}"`);
    expect(html).not.toContain('data-testid="hitter-swing-blueprint"');
    expect(fake.movement).toHaveBeenCalledExactlyOnceWith(trusted,athlete.id,athlete.athlete_code);
    expect(fake.rpc.mock.calls).toEqual([
      ["athlete_focus_items",{p_athlete_id:athlete.id}],
      ["athlete_swing_videos",{p_athlete_id:athlete.id}],
      ["athlete_development_plans",{p_athlete_id:athlete.id}],
      ["athlete_trend_annotations",{p_athlete_id:athlete.id}],
      ["athlete_training_block_samples",{p_athlete_id:athlete.id,p_offset:0}],
    ]);
    expect(html).toContain("Game Stats");
    expect(html).toContain("Fictional Profile"); expect(html).toContain('data-metric-key="max_exit_velocity"');
    expect(html).toContain('data-value="10"'); expect(html).toContain("Jersey Number");
  });
  it.each([false, true])("omits administrative controls, roster email and account metadata from rendered player view (preview=%s)", async preview => {
    fake.access.mockResolvedValueOnce(access(["player"], ownId, preview));
    const html = renderToStaticMarkup(await Profile({ params: Promise.resolve({ id: ownId }) }));
    for (const hidden of ["private-roster@example.com", "private-login@example.com", "Roster Details", "Roster email", "Academic class", "graduate", "redshirt", "Permanent athlete code", "/admin/performance", "/imports", "Team Roster"]) expect(html).not.toContain(hidden);
    expect(html).not.toContain("Measurement History");expect(html).not.toContain("RENPHO Reports");expect(html).not.toContain("Sources &amp; Percentiles");expect(fake.logs).not.toHaveBeenCalled();
    expect(html).not.toContain('data-testid="player-percentile"');
  });
  it("preserves read-only notices after the compatibility redirect without giving the preview import controls", async () => {
    fake.access.mockResolvedValueOnce(access(["player"], ownId, true));
    const html = renderToStaticMarkup(await Profile({ params: Promise.resolve({ id: ownId }), searchParams: Promise.resolve({ preview: "read-only" }) }));
    expect(html).toContain("This action is unavailable in the selected view. No change was saved.");
    expect(html).not.toContain('href="/imports"');
    expect(fake.games).toHaveBeenCalledTimes(1);
  });
  it("shows imports to actual staff and Coach view, and limits management details to presented admin", async () => {
    fake.contacts.mockResolvedValue([contact]);
    fake.access.mockResolvedValueOnce(access(["coach"], null));
    const coach = renderToStaticMarkup(await Profile({ params: Promise.resolve({ id: ownId }) }));
    expect(coach).toContain("Team Roster"); expect(coach).not.toContain("Roster Details"); expect(coach).not.toContain("private-roster@example.com"); expect(coach).toContain('href="/imports"');
    fake.access.mockResolvedValueOnce(access(["coach"], null, true));
    const preview = renderToStaticMarkup(await Profile({ params: Promise.resolve({ id: ownId }) }));
    expect(preview).toContain('href="/imports"');
    fake.access.mockResolvedValueOnce(access(["admin"], null));
    const admin = renderToStaticMarkup(await Profile({ params: Promise.resolve({ id: ownId }) }));
    expect(admin).toContain("Roster Details"); expect(admin).toContain("private-roster@example.com"); expect(admin).toContain('href="/imports"');
    for(const html of [coach,preview,admin]){expect(html).toContain("Add Weekly Plan");expect(html).toContain("Add Coaching Note");expect(html).toContain("Attach Video");expect(html).not.toContain('aria-label="Complete Fictional drill"');}
  });
  it.each([false,true])("shows only shared development content and keeps staff controls out of Player View (preview=%s)",async preview=>{
    fake.access.mockResolvedValueOnce(access(["player"],ownId,preview));fake.contacts.mockResolvedValue([contact]);
    fake.rpc.mockImplementation(async(name:string)=>({data:name==="athlete_development_plans"?[ownPlan,{...ownPlan,id:"22222222-2222-4222-8222-222222222222",weekStart:"2026-10-05",focus:"Fictional hidden staff plan",shared:false}]:name==="athlete_trend_annotations"?[ownAnnotation,{...ownAnnotation,id:"66666666-6666-4666-8666-666666666666",note:"Fictional hidden chart note",shared:false}]:[],error:null}));
    const html=renderToStaticMarkup(await Profile({params:Promise.resolve({id:ownId})}));
    expect(html).toContain(ownPlan.focus);expect(html).toContain(ownPlan.drills[0].cue);expect(html).toContain(ownAnnotation.note);
    for(const hidden of [ownPlan.staffNote,"Fictional hidden staff plan","Fictional hidden chart note","Add Weekly Plan","Edit Weekly Plan","Add Coaching Note","Edit Note","Attach Video","Attach Swing Video"])expect(html).not.toContain(hidden);
    expect(html.includes('aria-label="Complete Fictional drill"')).toBe(!preview);
    for(const [,args] of fake.rpc.mock.calls)expect(args.p_athlete_id).toBe(ownId);
  });
  it("isolates optional video, weekly-plan, note and sample-reader failures without losing the profile",async()=>{
    fake.contacts.mockResolvedValue([contact]);fake.rpc.mockImplementation(async(name:string)=>name==="athlete_focus_items"?{data:[],error:null}:{data:null,error:{code:"FICTITIOUS_ERROR"}});
    const html=renderToStaticMarkup(await Profile({params:Promise.resolve({id:ownId})}));
    expect(html).toContain("Fictional Profile");expect(html).toContain('data-value="10"');expect(html).toContain("Game Stats");
    for(const message of ["Weekly plans are temporarily unavailable","Coaching notes are temporarily unavailable","Swing videos are temporarily unavailable","Swing counts are temporarily unavailable"])expect(html).toContain(message);
    expect(html).not.toContain("Attach Video");expect(html).not.toContain("FICTITIOUS_ERROR");
  });
  it("uses own aggregate overlays without peer rows and keeps baseball outside Fall out of history", async () => {
    fake.load.mockResolvedValueOnce({ measurements: [reading(), reading({ id: "fictional-summer", measured_at: "2026-08-12", metric: "Summer-only metric" }), reading({ id: "fictional-old", measured_at: "2025-09-12", metric: "Old-only metric" })], batches: [], percentileOverrides: [{
      athleteCode: athlete.athlete_code, metricKey: "max_exit_velocity", measuredAt: "2026-09-12", observedValue: 10, value: 50, sampleSize: 5,
      period: "fall_2026", unit: "mph", source: "Fictional hitting test", direction: "higher",
    }] });
    const html = renderToStaticMarkup(await Profile({ params: Promise.resolve({ id: ownId }) }));
    expect(html).toContain("5 teammates"); expect(html).toContain('data-percentile="50"');
    expect(html).not.toContain("Summer-only metric"); expect(html).not.toContain("Old-only metric");
    expect(fake.load).toHaveBeenCalledTimes(1);
  });
  it("hides pitcher speed tests from cards and history without changing saved input", async () => {
    const pitcher = {...athlete, athlete_seasons: athlete.athlete_seasons.map(s => ({...s, player_type: "pitcher", primary_position: "P"}))};
    fake.single.mockResolvedValueOnce({data: pitcher, error: null});
    const measurements = [reading({metric: "Home to First", value: 4.2, unit: "s"}), reading({id: "fictional-weight", metric: "Weight", value: 180, unit: "lb"})];
    fake.load.mockResolvedValueOnce({measurements, batches: [], percentileOverrides: []});
    const html = renderToStaticMarkup(await Profile({params: Promise.resolve({id: ownId})}));
    expect(html).not.toContain("Home to First"); expect(html).not.toContain("Speed &amp; Agility");
    expect(html).not.toContain("Measurement History"); expect(html).toContain('data-value="180"');
    expect(measurements).toHaveLength(2);
    expect(fake.contacts).not.toHaveBeenCalled(); expect(fake.team).not.toHaveBeenCalled();
    expect(fake.speed).not.toHaveBeenCalled(); expect(html).not.toContain('href="/swing-design');
    expect(html).toContain(`href="/pitch-design?athlete=${athlete.id}"`);
  });
  it("does not present a failed performance load as a successful empty profile", async () => {
    fake.load.mockRejectedValueOnce(new Error("Fictional performance unavailable"));
    await expect(Profile({ params: Promise.resolve({ id: ownId }) })).rejects.toThrow("Fictional performance unavailable");
    expect(fake.charts).not.toHaveBeenCalled();
  });
  it("shows only shared focus titles in Player View and keeps staff notes private",async()=>{
    fake.rpc.mockResolvedValueOnce({data:[
      {id:"11111111-1111-4111-8111-111111111111",athleteId:ownId,title:"Fictional shared goal",staffNote:"Private coach note",targetDate:"2026-10-10",shared:true,completedAt:null,createdAt:"2026-09-20T00:00:00Z"},
      {id:"22222222-2222-4222-8222-222222222222",athleteId:ownId,title:"Fictional staff-only goal",staffNote:"Another private note",targetDate:null,shared:false,completedAt:null,createdAt:"2026-09-20T00:00:00Z"},
    ],error:null});
    fake.access.mockResolvedValueOnce(access(["player"],ownId,true));
    const html=renderToStaticMarkup(await Profile({params:Promise.resolve({id:ownId})}));
    expect(html).toContain("Fictional shared goal");
    expect(html).not.toContain("Fictional staff-only goal");
    expect(html).not.toContain("Private coach note");
    expect(html).not.toContain("Another private note");
    expect(html).not.toContain("Add Coach Focus");
  });
});
it("renders aggregate hitting comparisons on an own-player profile without peer queries",async()=>{
 fake.load.mockResolvedValueOnce({measurements:[reading({source:"Full Swing · Intrasquad"})],batches:[],percentileOverrides:[]});
 fake.team.mockResolvedValueOnce([{metricKey:"max_exit_velocity",unit:"mph",source:"full swing · intrasquad",method:"player_mean",value:75.25,athleteCount:8,swingCount:null,firstDate:"2026-09-11",lastDate:"2026-09-20"}]);
 const html=renderToStaticMarkup(await Profile({params:Promise.resolve({id:ownId})}));
 expect(html).toContain("Team Average");expect(html).toContain("75.3");expect(fake.from).toHaveBeenCalledExactlyOnceWith("athletes");expect(fake.eq).toHaveBeenCalledExactlyOnceWith("id",ownId);
});

it("starts independent profile readers while game stats are still loading",async()=>{
 let release!:(rows:[])=>void;fake.games.mockImplementation(()=>new Promise(resolve=>{release=resolve;}));
 const pending=Profile({params:Promise.resolve({id:ownId})});
 await vi.waitFor(()=>expect(fake.load).toHaveBeenCalledTimes(1));
 expect(fake.comparisons).toHaveBeenCalledTimes(1);expect(fake.movement).toHaveBeenCalledTimes(1);expect(fake.contacts).toHaveBeenCalledTimes(1);
 release([]);await expect(pending).resolves.toBeDefined();
});
