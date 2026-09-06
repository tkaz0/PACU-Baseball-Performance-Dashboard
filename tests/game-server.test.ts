import { afterEach,beforeEach,describe,expect,it,vi } from "vitest";
import type { requireAccess } from "@/lib/auth";
vi.mock("server-only",()=>({}));
import { loadGameStats } from "@/lib/game-server";
const rpc=vi.fn(),a="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",b="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const row=()=>({source:"qpa_fall_2026",athlete_id:a,metric:"pa",value:0,unit:"count",scope:"cumulative_fall",event_id:null,played_on:null,source_row:2,source_column:2,derived_from:[],snapshot_id:b,fetched_at:"2026-09-13T12:00:00Z",content_hash:"a".repeat(64)});
const access=(roles=["player"],athleteId:string|null=a,preview=false)=>({supabase:{rpc},roles,athleteId,actualRoles:preview?["admin"]:roles,preview:preview?{role:"player",athleteId}:null}as unknown as Awaited<ReturnType<typeof requireAccess>>);
beforeEach(()=>{vi.resetAllMocks();vi.useFakeTimers();vi.setSystemTime(new Date("2026-09-14T12:00:00Z"));rpc.mockResolvedValue({data:[row()],error:null});});afterEach(()=>vi.useRealTimers());
describe("protected game read projection",()=>{
 it.each([false,true])("queries only the effective own athlete, including Admin player preview=%s",async preview=>{expect(await loadGameStats(access(["player"],a,preview))).toEqual([row()]);expect(rpc).toHaveBeenCalledExactlyOnceWith("read_game_stats",{p_athlete_id:a});});
 it("uses broad staff scope only for staff and exact profile scope when specified",async()=>{await loadGameStats(access(["coach"],null));expect(rpc).toHaveBeenLastCalledWith("read_game_stats",{p_athlete_id:null});await loadGameStats(access(["admin"],null),a);expect(rpc).toHaveBeenLastCalledWith("read_game_stats",{p_athlete_id:a});});
 it("denies other athlete, unlinked and malformed requests before RPC",async()=>{for(const [trusted,id]of[[access(),b],[access(["player"],null),undefined],[access(["admin"],null),"not-uuid"]]as const)await expect(loadGameStats(trusted,id)).rejects.toThrow("denied");expect(rpc).not.toHaveBeenCalled();});
 it.each([{athlete_id:b},{source:"constructor"},{private_email:"fictional@example.com"},{metric:"unknown"},{source_column:3},{derived_from:[3,2]},{value:NaN},{value:-1},{content_hash:""},{fetched_at:"2026-09-15T12:00:00Z"},{played_on:"2026-09-13"}])("rejects extra, cross-player or invalid provider rows %#",async change=>{rpc.mockResolvedValue({data:[{...row(),...change}],error:null});await expect(loadGameStats(access())).rejects.toThrow();});
 it("rejects oversized, duplicate and failed reads rather than showing partial success",async()=>{for(const data of [null,{},[row(),row()],Array(10001).fill(row())]){rpc.mockResolvedValue({data,error:null});await expect(loadGameStats(access())).rejects.toThrow();}rpc.mockResolvedValue({data:[],error:{message:"fictional"}});await expect(loadGameStats(access())).rejects.toThrow();});
});
