import { beforeEach, expect, it, vi } from "vitest";
const fake=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock("server-only",()=>({}));
import { loadContactsAllowed } from "@/lib/contacts-allowed-server";
const id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const row={played_on:"2026-09-11",category:"intrasquad",exit_velocity:90,launch_angle:20,direction:0,distance:200,squared_up:.9,potential_exit_velocity:100,pitch_type:"Slider"};
const access={roles:["player"],athleteId:id,actualRoles:["player"],preview:null,supabase:{rpc:fake.rpc}};
beforeEach(()=>{vi.resetAllMocks();fake.rpc.mockResolvedValue({data:[row],error:null});});
it("reads authorized contact by pitch without returning hitter or file identities",async()=>{
 expect(await loadContactsAllowed(access as never,id)).toEqual([{playedOn:row.played_on,category:row.category,exitVelocity:90,launchAngle:20,direction:0,distance:200,squaredUp:.9,potentialExitVelocity:100,pitchType:"Slider"}]);
 expect(fake.rpc).toHaveBeenCalledExactlyOnceWith("athlete_contacts_allowed_by_pitch",{p_athlete_id:id});
});
it("denies peers and validates pitch/context without silently dropping records",async()=>{
 await expect(loadContactsAllowed(access as never,"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")).rejects.toThrow("denied");expect(fake.rpc).not.toHaveBeenCalled();
 for(const change of [{category:"practice"},{pitch_type:"Guessed Fastball"},{squared_up:2}]){
  fake.rpc.mockResolvedValueOnce({data:[{...row,...change}],error:null});
  await expect(loadContactsAllowed(access as never,id)).rejects.toThrow("verified");
 }
});
