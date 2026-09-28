import { beforeEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({access:vi.fn(),from:vi.fn(),games:vi.fn()}));
vi.mock("server-only",()=>({}));vi.mock("@/lib/render-access",()=>({requireRenderImportAccess:mocks.access}));
vi.mock("@/lib/game-server",()=>({loadGameStats:mocks.games}));
import { analyticsPages, loadAnalytics, loadCoachingData, loadComparisonData, loadDataCoverage } from "@/lib/analytics-server";
import { CLASSIFIED_METRICS } from "@/lib/imports/classified-pitch-results";
beforeEach(()=>{vi.resetAllMocks();mocks.games.mockResolvedValue([]);});
it("denies unauthorized access before any team query",async()=>{mocks.access.mockRejectedValue(Error("DENIED"));await expect(loadAnalytics()).rejects.toThrow("DENIED");await expect(loadCoachingData()).rejects.toThrow("DENIED");await expect(loadComparisonData()).rejects.toThrow("DENIED");await expect(loadDataCoverage()).rejects.toThrow("DENIED");expect(mocks.from).not.toHaveBeenCalled();expect(mocks.games).not.toHaveBeenCalled();});
it("detects provider truncation and changing page counts instead of returning false missing data",async()=>{await expect(analyticsPages(async()=>({data:[1],count:2,error:null}),x=>x,1000)).rejects.toThrow("could not be verified");const req=vi.fn().mockResolvedValueOnce({data:Array(500).fill(1),count:501,error:null}).mockResolvedValueOnce({data:[1,2],count:502,error:null});await expect(analyticsPages(req,x=>x,1000)).rejects.toThrow("could not be verified");});
it("reads the full final page and fails on provider errors",async()=>{const req=vi.fn().mockResolvedValueOnce({data:Array(500).fill(1),count:501,error:null}).mockResolvedValueOnce({data:[2],count:501,error:null});expect(await analyticsPages(req,x=>x,1000)).toHaveLength(501);await expect(analyticsPages(async()=>({data:null,count:0,error:"unavailable"}),x=>x,1000)).rejects.toThrow("could not be verified");});
it("returns only eligible roster fields and numerical readings through the signed-in client",async()=>{
 const id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
 const athlete={id,athlete_code:"SYN-001",first_name:"Fictional",last_name:"Player",preferred_name:null,athlete_seasons:[{season:"2026-27",academic_class:"freshman",primary_position:"OF",player_type:"position",bats:"R",throws:"R",roster_status:"active"}]};
 const measurement={observation_id:"fictional-obs",athlete_id:id,metric_key:"weight",metric:"Weight",unit:"lb",value:180,measured_at:"2026-09-06",source:"Fictional",imported_at:"2026-09-06T00:00:00Z"};
 const make=(data:unknown[])=>{const chain={select:vi.fn(),eq:vi.fn(),in:vi.fn(),gte:vi.fn(),lte:vi.fn(),order:vi.fn(),range:vi.fn().mockResolvedValue({data,count:data.length,error:null})};for(const key of ["select","eq","in","gte","lte","order"] as const)chain[key].mockReturnValue(chain);return chain;};
 const roster=make([athlete]),readings=make([measurement]);mocks.from.mockImplementation(table=>table==="athletes"?roster:readings);mocks.access.mockResolvedValue({supabase:{from:mocks.from}});
 const staff=await loadCoachingData();expect(staff.players[0].secondaryPosition).toBe("");expect(staff.readings).toHaveLength(1);expect(staff.games).toEqual([]);
 const result=await loadAnalytics();expect(result.players).toHaveLength(1);expect(result.readings[0].value).toBe(180);expect(Object.keys(result.players[0]).sort()).toEqual(["id","code","name","academicClass","position","playerType","bats","throws"].sort());expect(readings.in).toHaveBeenCalledWith("athlete_id",[id]);expect(readings.gte).toHaveBeenCalledWith("measured_at","2026-06-01");
});

it("offers all current-season identities for comparison while keeping progress/cohort eligibility unchanged",async()=>{
 const makeAthlete=(id:string,status:string)=>({id,athlete_code:`SYN-${status}`,first_name:"Fictional",last_name:status,preferred_name:null,athlete_seasons:[{season:"2026-27",academic_class:"freshman",primary_position:"OF",secondary_position:null,player_type:"position",bats:"R",throws:"R",roster_status:status}]});
 const all=[makeAthlete("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","active"),makeAthlete("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","inactive")];
 mocks.from.mockImplementation(table=>{const data=table==="athletes"?all:[];const chain={select:vi.fn(),eq:vi.fn(),in:vi.fn(),gte:vi.fn(),lte:vi.fn(),order:vi.fn(),range:vi.fn().mockResolvedValue({data,count:data.length,error:null})};for(const k of ["select","eq","in","gte","lte","order"] as const)chain[k].mockReturnValue(chain);return chain;});
 mocks.access.mockResolvedValue({supabase:{from:mocks.from}});
 const coverage=await loadDataCoverage();expect(coverage.rows).toHaveLength(1);expect(mocks.games).not.toHaveBeenCalled();expect(coverage.rows[0].cells.renpho.status).toBe("missing");
 const comparison=await loadComparisonData();expect(comparison.players).toHaveLength(2);expect(comparison.readings).toEqual([]);
 expect((await loadCoachingData()).players).toHaveLength(1);expect((await loadAnalytics()).players).toHaveLength(1);
 expect(JSON.stringify(comparison)).not.toContain("email");expect(JSON.stringify(comparison)).not.toContain("roster_status");
});

it("accepts validated signed Blast angles without allowing arbitrary negative readings",async()=>{
 const id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
 const athlete={id,athlete_code:"SYN-001",first_name:"Fictional",last_name:"Player",preferred_name:null,athlete_seasons:[{season:"2026-27",academic_class:null,primary_position:"OF",player_type:"position",bats:null,throws:null,roster_status:"active"}]};
 const measurement={observation_id:"fictional-angle",athlete_id:id,metric_key:"blast_vertical_bat_angle",metric:"Vertical Bat Angle",unit:"deg",value:-30,measured_at:"2026-09-20",source:"Blast Motion · Average · 2026-09-13:2026-09-20",imported_at:"2026-09-20T12:00:00Z"};
 mocks.from.mockImplementation(table=>{const data=table==="athletes"?[athlete]:[measurement];const chain={select:vi.fn(),eq:vi.fn(),in:vi.fn(),gte:vi.fn(),lte:vi.fn(),order:vi.fn(),range:vi.fn().mockResolvedValue({data,count:data.length,error:null})};for(const k of ["select","eq","in","gte","lte","order"] as const)chain[k].mockReturnValue(chain);return chain;});mocks.access.mockResolvedValue({supabase:{from:mocks.from}});
 await expect(loadCoachingData()).resolves.toBeDefined();measurement.source="RENPHO";await expect(loadCoachingData()).rejects.toThrow("could not be verified");
});

it("bounds parallel pages to three and preserves source order despite out-of-order completion",async()=>{
 const pending=new Map<number,()=>void>();const requested:number[]=[];let active=0,peak=0;
 const request=(from:number)=>{requested.push(from);if(from===0)return Promise.resolve({data:Array.from({length:500},(_,i)=>i),count:2001,error:null});active++;peak=Math.max(peak,active);return new Promise<{data:number[];count:number;error:null}>(resolve=>pending.set(from,()=>{active--;pending.delete(from);resolve({data:Array.from({length:Math.min(500,2001-from)},(_,i)=>from+i),count:2001,error:null});}));};
 const result=analyticsPages(request,x=>x,3000);
 await vi.waitFor(()=>expect(pending.size).toBe(3));expect(requested).toEqual([0,500,1000,1500]);
 pending.get(1500)!();pending.get(1000)!();expect(requested).not.toContain(2000);pending.get(500)!();
 await vi.waitFor(()=>expect(pending.has(2000)).toBe(true));pending.get(2000)!();
 expect(await result).toEqual(Array.from({length:2001},(_,i)=>i));expect(peak).toBe(3);
});
it("rejects any incomplete or changed parallel page and never fans out an oversized or empty source",async()=>{
 for(const change of [{data:[1],count:2000,error:null},{data:Array(500).fill(1),count:2001,error:null},{data:null,count:2000,error:"unavailable"}]){
  const request=vi.fn(async(from:number)=>from===1000?change:{data:Array(500).fill(1),count:2000,error:null});
  await expect(analyticsPages(request,x=>x,3000)).rejects.toThrow("could not be verified");
 }
 const empty=vi.fn(async()=>({data:[],count:0,error:null}));expect(await analyticsPages(empty,x=>x,3000)).toEqual([]);expect(empty).toHaveBeenCalledTimes(1);
 const oversized=vi.fn(async()=>({data:Array(500).fill(1),count:3001,error:null}));await expect(analyticsPages(oversized,x=>x,3000)).rejects.toThrow("could not be verified");expect(oversized).toHaveBeenCalledTimes(1);
});

it("projects the full staff comparison arsenal without exposing file identities or pooling contexts",async()=>{
 const id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
 const athlete={id,athlete_code:"SYN-001",first_name:"Fictional",last_name:"Pitcher",preferred_name:null,athlete_seasons:[{season:"2026-27",academic_class:"freshman",primary_position:"P",secondary_position:null,player_type:"pitcher",bats:"R",throws:"R",roster_status:"active"}]};
 const session=(hash:string,date:string,source:string,average:number,count:number)=>CLASSIFIED_METRICS.map((metric,i)=>({observation_id:`fictional-${hash[0]}-${i}`,athlete_id:id,metric_key:metric.key,metric:metric.label,unit:metric.unit,value:metric.key==="classified_avg_velocity"?average:metric.key==="classified_max_velocity"?average+3:metric.key==="classified_avg_spin"?2000:metric.key==="classified_max_spin"?2200:count,measured_at:date,source,imported_at:`${date}T12:00:00Z`,file_hash:hash}));
 const rows=[...session("a".repeat(64),"2026-09-11","Full Swing · Intrasquad · Fastball",80,10),...session("b".repeat(64),"2026-09-23","Full Swing · Intrasquad · Fastball",84,30),...session("c".repeat(64),"2026-09-11","Full Swing · Intrasquad · Curveball",68,8),...session("d".repeat(64),"2026-09-23","Full Swing · Practice · Fastball",90,5)];
 const selections:string[]=[];
 mocks.from.mockImplementation(table=>{const data=table==="athletes"?[athlete]:rows;const chain={select:vi.fn((fields:string)=>{if(table==="performance_measurements")selections.push(fields);return chain;}),eq:vi.fn(),in:vi.fn(),gte:vi.fn(),lte:vi.fn(),order:vi.fn(),range:vi.fn().mockResolvedValue({data,count:data.length,error:null})};for(const k of ["eq","in","gte","lte","order"] as const)chain[k].mockReturnValue(chain);return chain;});
 mocks.access.mockResolvedValue({supabase:{from:mocks.from}});
 const comparison=await loadComparisonData();
 expect(comparison.arsenals).toHaveLength(1);expect(comparison.arsenals[0].athleteId).toBe(id);
 const pitches=comparison.arsenals[0].pitches;
 expect(pitches).toHaveLength(3);
 expect(pitches.find(p=>p.source==="Full Swing · Intrasquad · Fastball")).toMatchObject({averageVelocity:83,maxVelocity:87,velocityReadings:40,velocityBasis:"fall"});
 expect(pitches.find(p=>p.pitchType==="Curveball")).toMatchObject({averageVelocity:68,lastDate:"2026-09-11"});
 expect(pitches.find(p=>p.category==="Practice")).toMatchObject({averageVelocity:90});
 expect(comparison.readings).toEqual([]);expect(JSON.stringify(comparison)).not.toContain("file_hash");expect(JSON.stringify(comparison)).not.toContain("a".repeat(64));expect(selections[0]).toContain("file_hash");
 await loadAnalytics();expect(selections.at(-1)).not.toContain("file_hash");
 rows[0].file_hash="invalid";await expect(loadComparisonData()).rejects.toThrow("could not be verified");
 rows[0].file_hash="a".repeat(64);Reflect.set(rows[0],"metric","Unsupported label");await expect(loadComparisonData()).rejects.toThrow("could not be verified");
});
