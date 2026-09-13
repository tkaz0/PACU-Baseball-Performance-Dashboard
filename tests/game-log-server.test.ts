import {beforeEach,expect,it,vi} from "vitest";
const rpc=vi.hoisted(()=>vi.fn());vi.mock("server-only",()=>({}));
import {loadGameLogs} from "@/lib/game-log-server";
const own="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",other="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const access={roles:["player"],athleteId:own,supabase:{rpc}} as unknown as Parameters<typeof loadGameLogs>[0];
const row={id:own,athleteId:own,playedOn:"2026-09-01",opponent:"Fictional Owls",gameNumber:1,kind:"game",batting:{ab:4,h:1},pitching:{},version:1,updatedAt:"2026-09-02T12:00:00Z"};
beforeEach(()=>rpc.mockReset());
it("scopes players and Player View as before querying",async()=>{await expect(loadGameLogs(access,other)).rejects.toThrow("access denied");expect(rpc).not.toHaveBeenCalled();rpc.mockResolvedValue({data:[row],error:null});expect(await loadGameLogs(access)).toEqual([row]);expect(rpc).toHaveBeenCalledWith("read_game_logs",{p_athlete_id:own});});
it("rejects peer data, unexpected properties and invalid records from the transport",async()=>{for(const invalid of [{...row,athleteId:other},{...row,email:"fictional@example.com"},{...row,version:0},{...row,batting:{ab:1,h:2}}]){rpc.mockResolvedValue({data:[invalid],error:null});await expect(loadGameLogs(access)).rejects.toThrow();}rpc.mockResolvedValue({data:[row,row],error:null});await expect(loadGameLogs(access)).rejects.toThrow();});
