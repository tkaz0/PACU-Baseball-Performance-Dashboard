import {beforeEach,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({auth:vi.fn(),staff:vi.fn(),analytics:vi.fn(),rpc:vi.fn()}));
vi.mock("server-only",()=>({}));vi.mock("@/lib/auth",()=>({requireAccess:mocks.auth,requireImportAccess:mocks.staff}));vi.mock("@/lib/analytics-server",()=>({loadAnalytics:mocks.analytics}));
import {saveAnalyticsView} from "@/app/(workspace)/analytics/view-actions";
import {recordDashboardVisit} from "@/app/(workspace)/overview/visit-actions";
const id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",access={roles:["coach"],athleteId:null,preview:null,supabase:{rpc:mocks.rpc}};
const config={version:1,x:'["weight","lb","renpho"]',y:'["muscle_mass","lb","renpho"]',period:"fall",colorBy:"academicClass",classFilter:"",positionFilter:"",window:30,hidden:[]};
beforeEach(()=>{vi.resetAllMocks();mocks.auth.mockResolvedValue(access);mocks.staff.mockResolvedValue(access);});
it("checks fresh staff access and current stat availability before a preset write",async()=>{
 mocks.staff.mockRejectedValueOnce(new Error("denied"));await expect(saveAnalyticsView({id,name:"Fictional view",config})).rejects.toThrow("denied");expect(mocks.rpc).not.toHaveBeenCalled();
 mocks.analytics.mockResolvedValue({players:[],readings:[]});expect((await saveAnalyticsView({id,name:"Fictional view",config})).error).toContain("no longer available");expect(mocks.rpc).not.toHaveBeenCalled();
});
it("sends only account-scoped validated settings and verifies the saved receipt",async()=>{
 mocks.analytics.mockResolvedValue({players:[],readings:[{id:"1",athleteId:id,metric:"weight",label:"Weight",unit:"lb",source:"RENPHO",date:"2026-09-20",importedAt:"2026-09-20T00:00:00Z",value:180},{id:"2",athleteId:id,metric:"muscle_mass",label:"Muscle Mass",unit:"lb",source:"RENPHO",date:"2026-09-20",importedAt:"2026-09-20T00:00:00Z",value:150}]});
 mocks.rpc.mockResolvedValueOnce({data:id,error:null}).mockResolvedValueOnce({data:[{id,name:"Fictional view",config,createdAt:"2026-09-27T00:00:00Z"}],error:null});
 expect((await saveAnalyticsView({id,name:"Fictional view",config})).views).toHaveLength(1);expect(mocks.rpc.mock.calls[0]).toEqual(["save_my_analytics_view",{p_id:id,p_name:"Fictional view",p_config:config}]);
});
it("never advances another role's preview cursor and validates visible capture time before saving",async()=>{
 mocks.auth.mockResolvedValueOnce({...access,preview:{role:"coach"}});expect(await recordDashboardVisit(new Date().toISOString())).toBe(false);expect(mocks.rpc).not.toHaveBeenCalled();
 expect(await recordDashboardVisit("bad")).toBe(false);expect(await recordDashboardVisit(new Date(Date.now()+60_000).toISOString())).toBe(false);expect(mocks.rpc).not.toHaveBeenCalled();
 mocks.rpc.mockResolvedValue({data:true,error:null});const now=new Date(Date.now()-1000).toISOString();expect(await recordDashboardVisit(now)).toBe(true);expect(mocks.rpc).toHaveBeenLastCalledWith("record_my_dashboard_visit",{p_scope:"staff",p_viewed_at:now});
});
