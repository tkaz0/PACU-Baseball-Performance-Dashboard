import { beforeEach,expect,it,vi } from "vitest";
const fake=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock("server-only",()=>({}));
import { loadPlayerGoals } from "@/lib/player-goals-server";
import type { PlayerNumericGoal } from "@/lib/player-goals";
const athlete="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",other="aaaaaaaa-aaaa-4aaa-8aaa-bbbbbbbbbbbb";
const goal:PlayerNumericGoal={id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",athleteId:athlete,title:"Fictional target",metricKey:"max_exit_velocity",metricLabel:"Max EV",source:"Full Swing · Intrasquad",unit:"mph",period:"fall_2026",baselineValue:80,baselineDate:"2026-09-11",baselineValid:true,targetValue:90,targetDate:null,staffNote:"Private fictional note",shared:true,completedAt:null,revision:1,createdAt:"2026-09-20T00:00:00Z",currentValue:85,currentDate:"2026-09-23"};
const choice={observationId:"fictional-staff-choice",metricKey:"max_exit_velocity",metricLabel:"Max EV",source:goal.source,unit:"mph",value:80,measuredAt:"2026-09-11"};
function access(role:"player"|"coach"|"admin"="player",preview=false){return {roles:[role],athleteId:role==="player"?athlete:null,actualRoles:preview?["admin"]:[role],preview:preview?{role,athleteId:athlete}:null,supabase:{rpc:fake.rpc}} as unknown as Parameters<typeof loadPlayerGoals>[0];}
beforeEach(()=>{vi.resetAllMocks();fake.rpc.mockResolvedValue({data:{goals:[goal],choices:[choice]},error:null});});
it.each([false,true])("strips notes, unshared goals, raw extra fields and baseline choices for player view preview=%s",async preview=>{
 fake.rpc.mockResolvedValue({data:{goals:[{...goal,extraPrivate:"do not return"},{...goal,id:"cccccccc-cccc-4ccc-8ccc-cccccccccccc",shared:false}],choices:[choice]},error:null});
 const result=await loadPlayerGoals(access("player",preview),athlete);expect(result.goals).toHaveLength(1);expect(result.goals[0].staffNote).toBeNull();expect(result.choices).toEqual([]);expect(JSON.stringify(result)).not.toContain("do not return");
});
it("retains edit data only for staff and coach view",async()=>{
 for(const actor of [access("admin"),access("coach"),access("coach",true)]){const result=await loadPlayerGoals(actor,athlete);expect(result.goals[0].staffNote).toBe(goal.staffNote);expect(result.choices).toEqual([choice]);}
});
it("denies other players and invalid identities before calling the RPC",async()=>{
 for(const id of [other,"invalid"]){await expect(loadPlayerGoals(access(),id)).rejects.toThrow("access denied");}
 expect(fake.rpc).not.toHaveBeenCalled();
});
it.each([{athleteId:other},{unit:"rpm"},{baselineDate:"2026-02-30"},{currentDate:"2026-09-01"},{currentValue:NaN},{targetValue:80},{baselineValid:false},{revision:0}])("rejects malformed or mismatched goal projections %#",async change=>{
 fake.rpc.mockResolvedValue({data:{goals:[{...goal,...change}],choices:[]},error:null});await expect(loadPlayerGoals(access(),athlete)).rejects.toThrow("format");
});
it("does not silently turn unavailable goal reads into an empty success",async()=>{
 fake.rpc.mockResolvedValue({data:null,error:{code:"fictional"}});await expect(loadPlayerGoals(access(),athlete)).rejects.toThrow("could not be loaded");
});
it("accepts SQL-valid Unicode length boundaries while preserving the player-safe projection",async()=>{
 const title="🐉".repeat(100),note="🧢".repeat(600);
 fake.rpc.mockResolvedValue({data:{goals:[{...goal,title,staffNote:note,extraPrivate:"do not return"}],choices:[choice]},error:null});
 const staff=await loadPlayerGoals(access("coach"),athlete);expect(staff.goals[0].title).toBe(title);expect(staff.goals[0].staffNote).toBe(note);
 const player=await loadPlayerGoals(access("player",true),athlete);expect(player.goals[0].title).toBe(title);expect(player.goals[0].staffNote).toBeNull();expect(player.choices).toEqual([]);expect(JSON.stringify(player)).not.toContain("do not return");
});
it.each([{title:"🐉".repeat(101)},{staffNote:"🐉".repeat(601)}])("rejects strings beyond the SQL codepoint boundary %#",async change=>{
 fake.rpc.mockResolvedValue({data:{goals:[{...goal,...change}],choices:[]},error:null});await expect(loadPlayerGoals(access("coach"),athlete)).rejects.toThrow("format");
});
it("matches SQL btrim semantics without rejecting legitimate Unicode spacing",async()=>{
 const title="\u00a0Fictional target\u00a0",note="\u2003Fictional private note\u2003";
 fake.rpc.mockResolvedValue({data:{goals:[{...goal,title,staffNote:note}],choices:[]},error:null});
 const result=await loadPlayerGoals(access("coach"),athlete);expect(result.goals[0]).toMatchObject({title,staffNote:note});
 fake.rpc.mockResolvedValue({data:{goals:[{...goal,title:" Fictional target "}],choices:[]},error:null});await expect(loadPlayerGoals(access("coach"),athlete)).rejects.toThrow("format");
});
