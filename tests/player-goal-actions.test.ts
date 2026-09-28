import { beforeEach,expect,it,vi } from "vitest";
const fake=vi.hoisted(()=>({access:vi.fn(),rpc:vi.fn(),revalidate:vi.fn()}));
vi.mock("@/lib/auth",()=>({requireImportAccess:fake.access}));
vi.mock("next/cache",()=>({revalidatePath:fake.revalidate}));
vi.mock("next/navigation",()=>({redirect:(path:string)=>{throw new Error(`REDIRECT:${path}`);}}));
import { saveNumericGoal } from "@/app/(workspace)/athletes/[id]/goal-actions";
const athlete="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",goal="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
function form(overrides:Record<string,string>={}){const data=new FormData();Object.entries({athleteId:athlete,goalId:goal,revision:"0",title:"Fictional target",target:"90.123",due:"2026-10-15",note:"Fictional private note",baselineId:"fictional-observation",baselineValue:"80.456",...overrides}).forEach(([key,value])=>data.set(key,value));return data;}
beforeEach(()=>{vi.resetAllMocks();fake.access.mockResolvedValue({roles:["coach"],preview:null,supabase:{rpc:fake.rpc}});fake.rpc.mockResolvedValue({data:{id:goal,revision:1},error:null});});
it("uses a fresh ordinary staff guard and saves reviewed precision without automatic sharing",async()=>{
 await expect(saveNumericGoal(form())).rejects.toThrow(`REDIRECT:/athletes/${athlete}?goal=saved`);
 expect(fake.access).toHaveBeenCalledOnce();expect(fake.rpc).toHaveBeenCalledExactlyOnceWith("staff_save_numeric_goal",expect.objectContaining({p_athlete_id:athlete,p_goal_id:goal,p_expected_revision:0,p_baseline_observation_id:"fictional-observation",p_baseline_value:80.456,p_target_value:90.123,p_shared:false,p_completed:false}));expect(fake.revalidate).toHaveBeenCalledWith(`/athletes/${athlete}`);
});
it("blocks admin-as-player even if the underlying fresh guard were to return that presentation",async()=>{
 fake.access.mockResolvedValue({roles:["player"],actualRoles:["admin"],preview:{role:"player",athleteId:athlete},supabase:{rpc:fake.rpc}});
 await expect(saveNumericGoal(form())).rejects.toThrow("read-only");expect(fake.rpc).not.toHaveBeenCalled();
});
it("denies unauthenticated or revoked access before accepting goal inputs",async()=>{
 fake.access.mockRejectedValue(new Error("forbidden"));await expect(saveNumericGoal(form())).rejects.toThrow("forbidden");expect(fake.rpc).not.toHaveBeenCalled();
});
it("makes edits revision-checked without accepting a replacement baseline",async()=>{
 fake.rpc.mockResolvedValue({data:{id:goal,revision:3},error:null});await expect(saveNumericGoal(form({revision:"2",baselineId:"attempted-new-baseline",baselineValue:"1",shared:"on",completed:"on"}))).rejects.toThrow("goal=saved");
 expect(fake.rpc).toHaveBeenCalledWith("staff_save_numeric_goal",expect.objectContaining({p_expected_revision:2,p_baseline_observation_id:null,p_baseline_value:null,p_shared:true,p_completed:true}));
});
it.each<Record<string,string>>([{target:""},{target:"NaN"},{target:"-3"},{baselineValue:""},{revision:"1.1"},{title:""}])("rejects incomplete or invalid submitted values before RPC %#",async change=>{
 await expect(saveNumericGoal(form(change))).rejects.toThrow("goal=invalid");expect(fake.rpc).not.toHaveBeenCalled();
});
it("surfaces stale and uncertain saves without retrying or claiming success",async()=>{
 fake.rpc.mockResolvedValueOnce({data:null,error:{code:"40001"}});await expect(saveNumericGoal(form())).rejects.toThrow("goal=stale");expect(fake.rpc).toHaveBeenCalledTimes(1);expect(fake.revalidate).not.toHaveBeenCalled();
 fake.rpc.mockResolvedValueOnce({data:{id:goal,revision:9},error:null});await expect(saveNumericGoal(form())).rejects.toThrow("goal=unverified");expect(fake.rpc).toHaveBeenCalledTimes(2);expect(fake.revalidate).not.toHaveBeenCalled();
});
