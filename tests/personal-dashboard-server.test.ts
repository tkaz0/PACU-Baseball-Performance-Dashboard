import {beforeEach,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {loadDashboardVisit,loadSavedAnalyticsViews} from "@/lib/personal-dashboard-server";
import {parseAnalyticsViewConfig,parseSavedAnalyticsViews} from "@/lib/saved-analytics";
const rpc=vi.fn(),athlete="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",view="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const config={version:1,x:'["weight","lb","renpho"]',y:'["muscle_mass","lb","renpho"]',period:"fall",colorBy:"academicClass",classFilter:"",positionFilter:"",window:30,hidden:[]};
const access=(roles:string[],athleteId:string|null=athlete,preview:unknown=null)=>({roles,athleteId,preview,supabase:{rpc}}) as unknown as Parameters<typeof loadDashboardVisit>[0];
beforeEach(()=>vi.resetAllMocks());
it("restores only bounded, exact saved configs and rejects added keys, repeated IDs or malformed filters",()=>{
 const entry={id:view,name:"Fictional view",config,createdAt:"2026-09-27T00:00:00Z"};expect(parseSavedAnalyticsViews([entry])).toHaveLength(1);
 expect(parseSavedAnalyticsViews([{...entry,name:"⚾".repeat(60)}])).toHaveLength(1);
 expect(parseSavedAnalyticsViews([{...entry,name:"😀".repeat(60)}])).toHaveLength(1);
 expect(()=>parseSavedAnalyticsViews([{...entry,name:"😀".repeat(61)}])).toThrow();
 expect(()=>parseSavedAnalyticsViews([{...entry,createdAt:1}])).toThrow();
 for(const bad of [{...config,x:config.y},{...config,hidden:["a","a"]},{...config,window:1},{...config,unapproved:"x"},{...config,colorBy:"name"},{...config,period:null}])expect(()=>parseAnalyticsViewConfig(bad)).toThrow();
 expect(()=>parseSavedAnalyticsViews([entry,entry])).toThrow();expect(()=>parseSavedAnalyticsViews([{...entry,email:"fictional@example.com"}])).toThrow();
});
it("denies player analytics before the reader and never records/queries visit cursors in preview or unlinked access",async()=>{
 await expect(loadSavedAnalyticsViews(access(["player"]))).rejects.toThrow();expect(rpc).not.toHaveBeenCalled();
 expect(await loadDashboardVisit(access(["player"],athlete,{role:"player"}),"2026-09-27T00:00:00Z")).toMatchObject({record:false,since:null});
 expect(await loadDashboardVisit(access(["player"],null),"2026-09-27T00:00:00Z")).toMatchObject({record:false});expect(rpc).not.toHaveBeenCalled();
});
it("keeps a visit window stable through refreshes and starts a new window after 30 minutes",async()=>{
 rpc.mockResolvedValue({data:{seenAt:"2026-09-27T01:00:00Z",previousSeenAt:"2026-09-26T01:00:00Z"},error:null});
 expect((await loadDashboardVisit(access(["coach"]),"2026-09-27T01:15:00Z")).since).toBe("2026-09-26T01:00:00Z");expect(rpc).toHaveBeenLastCalledWith("my_dashboard_visit",{p_scope:"staff"});
 expect((await loadDashboardVisit(access(["player"]),"2026-09-27T02:00:00Z")).since).toBe("2026-09-27T01:00:00Z");expect(rpc).toHaveBeenLastCalledWith("my_dashboard_visit",{p_scope:`athlete:${athlete}`});
 rpc.mockResolvedValue({data:{seenAt:"2026-09-28T01:00:00Z",previousSeenAt:null},error:null});await expect(loadDashboardVisit(access(["coach"]),"2026-09-27T00:00:00Z")).rejects.toThrow();
});
