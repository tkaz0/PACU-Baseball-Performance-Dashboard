import { beforeEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({access:vi.fn(),from:vi.fn(),games:vi.fn()}));
vi.mock("server-only",()=>({}));vi.mock("@/lib/render-access",()=>({requireRenderImportAccess:mocks.access}));
vi.mock("@/lib/game-server",()=>({loadGameStats:mocks.games}));
import { analyticsPages, loadTopPerformersData, loadAnalytics, loadCoachingData, loadComparisonData, loadDataCoverage, loadStaffHomeSummary } from "@/lib/analytics-server";
import { CLASSIFIED_METRICS } from "@/lib/imports/classified-pitch-results";
beforeEach(()=>{vi.resetAllMocks();mocks.games.mockResolvedValue([]);});
it("denies unauthorized access before any team query",async()=>{mocks.access.mockRejectedValue(Error("DENIED"));await expect(loadTopPerformersData()).rejects.toThrow("DENIED");await expect(loadAnalytics()).rejects.toThrow("DENIED");await expect(loadCoachingData()).rejects.toThrow("DENIED");await expect(loadComparisonData()).rejects.toThrow("DENIED");await expect(loadDataCoverage()).rejects.toThrow("DENIED");expect(mocks.from).not.toHaveBeenCalled();expect(mocks.games).not.toHaveBeenCalled();});
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
 mocks.from.mockClear();expect((await loadTopPerformersData()).players).toHaveLength(1);expect(mocks.from.mock.calls.every(([table])=>table==="athletes")).toBe(true);
 expect(JSON.stringify(comparison)).not.toContain("email");expect(JSON.stringify(comparison)).not.toContain("roster_status");
});

it("accepts validated signed Blast angles without allowing arbitrary negative readings",async()=>{
 const id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
 const athlete={id,athlete_code:"SYN-001",first_name:"Fictional",last_name:"Player",preferred_name:null,athlete_seasons:[{season:"2026-27",academic_class:null,primary_position:"OF",player_type:"position",bats:null,throws:null,roster_status:"active"}]};
 const measurement={observation_id:"fictional-angle",athlete_id:id,metric_key:"blast_vertical_bat_angle",metric:"Vertical Bat Angle",unit:"deg",value:-30,measured_at:"2026-09-20",source:"Blast Motion · Average · 2026-09-13:2026-09-20",imported_at:"2026-09-20T12:00:00Z"};
 mocks.from.mockImplementation(table=>{const data=table==="athletes"?[athlete]:[measurement];const chain={select:vi.fn(),eq:vi.fn(),in:vi.fn(),gte:vi.fn(),lte:vi.fn(),order:vi.fn(),range:vi.fn().mockResolvedValue({data,count:data.length,error:null})};for(const k of ["select","eq","in","gte","lte","order"] as const)chain[k].mockReturnValue(chain);return chain;});mocks.access.mockResolvedValue({supabase:{from:mocks.from}});
 await expect(loadCoachingData()).resolves.toBeDefined();
 const visit={since:"2026-09-19T00:00:00Z",viewedAt:"2026-09-27T00:00:00Z",record:true};
 expect((await loadStaffHomeSummary(visit)).visitDigest).toMatchObject({newResults:1,updatedPlayers:1,newBests:0});
 athlete.athlete_seasons[0].player_type="pitcher";athlete.athlete_seasons[0].primary_position="P";
 expect((await loadStaffHomeSummary(visit)).visitDigest).toMatchObject({newResults:0,updatedPlayers:0,newBests:0});
 measurement.source="RENPHO";await expect(loadCoachingData()).rejects.toThrow("could not be verified");
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

it("reports safe query failure reasons without echoing provider messages or data",async()=>{
 for(const error of [{code:"57014",message:"private provider detail"},{code:"PGRST301",details:"private row"},{code:"private-name",message:"private provider detail"},{code:"57014\n",message:"private provider detail"}]){
  const result=analyticsPages(async()=>({data:null,count:null,error}),x=>x,1000);
  await expect(result).rejects.toThrow(["private-name","57014\n"].includes(error.code)?"source-query:unknown":`source-query:${error.code}`);
  await expect(result).rejects.not.toThrow(/private/);
 }
 await expect(analyticsPages(async()=>({data:[],count:1001,error:null}),x=>x,1000)).rejects.toThrow("source-limit");
});

const fictionalRoster=(count:number)=>Array.from({length:count},(_,index)=>({id:`00000000-0000-4000-8000-${String(index+1).padStart(12,"0")}`,athlete_code:`SYN-${index+1}`,first_name:"Fictional",last_name:`Player ${index+1}`,preferred_name:null,athlete_seasons:[{season:"2026-27",academic_class:null,primary_position:"P",secondary_position:null,player_type:"pitcher",bats:null,throws:null,roster_status:"active"}]}));
const fictionalMeasurement=(athleteId:string,index:number)=>({observation_id:`fictional-${athleteId}-${index}`,athlete_id:athleteId,metric_key:"weight",metric:"Weight",unit:"lb",value:180,measured_at:"2026-09-06",source:"RENPHO",imported_at:"2026-09-06T00:00:00Z",file_hash:"a".repeat(64)});
type PageResult={data:unknown;count:number|null;error:unknown};
function teamQueries(roster:ReturnType<typeof fictionalRoster>,respond:(ids:string[],from:number,to:number)=>Promise<PageResult>|PageResult){
 const calls:{ids:string[];from:number;to:number;fields:string;count:unknown;bounds:[string,string,string][]}[]=[];
 mocks.from.mockImplementation(table=>{
  let ids:string[]=[],fields="",count:unknown;const bounds:[string,string,string][]=[];
  const chain={select:vi.fn((selection:string,options:{count:unknown})=>{fields=selection;count=options.count;return chain;}),eq:vi.fn(),in:vi.fn((_key:string,value:string[])=>{ids=value;return chain;}),gte:vi.fn((key:string,value:string)=>{bounds.push(["gte",key,value]);return chain;}),lte:vi.fn((key:string,value:string)=>{bounds.push(["lte",key,value]);return chain;}),order:vi.fn(),range:vi.fn((from:number,to:number)=>{
   if(table==="athletes")return Promise.resolve({data:roster.slice(from,to+1),count:roster.length,error:null});
   calls.push({ids:[...ids],from,to,fields,count,bounds});return Promise.resolve(respond(ids,from,to));
  })};
  for(const key of ["eq","order"] as const)chain[key].mockReturnValue(chain);return chain;
 });
 mocks.access.mockResolvedValue({supabase:{from:mocks.from}});return calls;
}
const timeoutPage=():PageResult=>({data:null,count:null,error:{code:"57014",message:"fictional private provider detail"}});

it("reads disjoint groups of ten sequentially with the unchanged exact-count projection and date bounds",async()=>{
 const roster=fictionalRoster(23);let active=0,peak=0;
 const calls=teamQueries(roster,async(ids,from,to)=>{active++;peak=Math.max(peak,active);await Promise.resolve();active--;const rows=ids.map(id=>fictionalMeasurement(id,0));return {data:rows.slice(from,to+1),count:rows.length,error:null};});
 const result=await loadAnalytics();
 expect(calls.map(c=>c.ids.length)).toEqual([10,10,3]);expect(calls.flatMap(c=>c.ids)).toEqual(roster.map(r=>r.id));expect(peak).toBe(1);
 expect(result.readings).toHaveLength(23);expect(new Set(result.readings.map(r=>r.id)).size).toBe(23);
 for(const call of calls){expect(call.count).toBe("exact");expect(call.bounds).toEqual([["gte","measured_at","2026-06-01"],["lte","measured_at","2026-12-31"]]);expect(call.fields).toBe("observation_id,athlete_id,metric_key,metric,unit,value,measured_at,source,imported_at");expect(call.to-call.from).toBe(499);}
});

it("drains timed-out parallel pages before splitting and discards all partial arsenal samples",async()=>{
 const roster=fictionalRoster(2),id=roster[0].id;
 const pitches=CLASSIFIED_METRICS.map((metric,index)=>({...fictionalMeasurement(id,index),metric_key:metric.key,metric:metric.label,unit:metric.unit,source:"Full Swing · Practice · Slider",value:metric.key==="classified_avg_velocity"?80:metric.key==="classified_max_velocity"?83:metric.key==="classified_avg_spin"?2000:metric.key==="classified_max_spin"?2200:10}));
 const rows=[...pitches,...Array.from({length:994},(_,i)=>fictionalMeasurement(id,i+7))];
 let release:(()=>void)|undefined,active=0,peak=0;
 const calls=teamQueries(roster,async(ids,from,to)=>{
  active++;peak=Math.max(peak,active);
  try{
   if(ids.length===2&&from===500)return timeoutPage();
   if(ids.length===2&&from===1000)await new Promise<void>(resolve=>{release=resolve;});
   const own=rows.filter(row=>ids.includes(row.athlete_id));return {data:own.slice(from,to+1),count:own.length,error:null};
  }finally{active--;}
 });
 const pending=loadComparisonData();let settled=false;void pending.then(()=>{settled=true;},()=>{settled=true;});
 await vi.waitFor(()=>expect(release).toBeDefined());expect(calls.every(c=>c.ids.length===2)).toBe(true);expect(settled).toBe(false);
 release!();const result=await pending;
 expect(calls.map(c=>[c.ids.length,c.from])).toEqual([[2,0],[2,500],[2,1000],[1,0],[1,500],[1,1000],[1,0]]);
 expect(peak).toBeLessThanOrEqual(3);expect(active).toBe(0);
 expect(result.arsenals).toHaveLength(1);expect(result.arsenals[0].pitches).toHaveLength(1);
 expect(result.arsenals[0].pitches[0]).toMatchObject({averageVelocity:80,velocityReadings:10,averageSpin:2000,spinReadings:10,velocityBasis:"fall"});
 expect(result.readings).toHaveLength(994);expect(new Set(result.readings.map(r=>r.id)).size).toBe(994);
 expect(JSON.stringify(result)).not.toContain("file_hash");
});

it("spends at most one split per team load and never retries either half recursively",async()=>{
 const roster=fictionalRoster(20);
 const calls=teamQueries(roster,ids=>ids.length===10?timeoutPage():{data:[],count:0,error:null});
 await expect(loadAnalytics()).rejects.toThrow("source-query:57014");
 expect(calls.map(c=>c.ids.length)).toEqual([10,5,5,10]);
 const failedHalf=teamQueries(fictionalRoster(10),()=>timeoutPage());
 await expect(loadAnalytics()).rejects.toThrow("source-query:57014");expect(failedHalf.map(c=>c.ids.length)).toEqual([10,5]);
 const single=teamQueries(fictionalRoster(1),()=>timeoutPage());
 await expect(loadAnalytics()).rejects.toThrow("source-query:57014");expect(single).toHaveLength(1);
});

it("does not retry other query errors, malformed codes, incomplete pages or untyped thrown errors",async()=>{
 const roster=fictionalRoster(2);
 for(const response of [
  {data:null,count:null,error:{code:"42501"}},
  {data:null,count:null,error:{code:"PGRST301"}},
  {data:null,count:null,error:{code:57014}},
  {data:null,count:null,error:{code:"57014\n"}},
  {data:[],count:1,error:null},
  {data:null,count:0,error:null},
 ]){
  const calls=teamQueries(roster,()=>response);await expect(loadAnalytics()).rejects.toThrow("could not be verified");expect(calls).toHaveLength(1);
 }
 const calls=teamQueries(roster,()=>Promise.reject(new Error("source-query:57014")));
 await expect(loadAnalytics()).rejects.toThrow("source-query:57014");expect(calls).toHaveLength(1);
});

it("keeps changed-count and invalid-row failures nonretryable even beside a timeout",async()=>{
 const roster=fictionalRoster(2);
 for(const invalid of ["count","row"]){
  const calls=teamQueries(roster,(_ids,from)=>{
   if(from===500)return timeoutPage();
   const data=Array.from({length:500},(_,i)=>fictionalMeasurement(roster[0].id,from+i));
   if(from===1000&&invalid==="row")data[0].value=NaN;
   return {data,count:from===1000&&invalid==="count"?1501:1500,error:null};
  });
  await expect(loadAnalytics()).rejects.toThrow(invalid==="count"?"source-changed":"invalid-reading");
  expect(calls).toHaveLength(3);expect(calls.every(c=>c.ids.length===2)).toBe(true);
 }
});

it.each([false,true])("enforces the aggregate 20,000 cap across batches and retry halves (split=%s)",async(split)=>{
 const roster=fictionalRoster(split?10:20);
 const calls=teamQueries(roster,(ids,from,to)=>{
  if(split&&ids.length===10)return timeoutPage();
  const count=ids[0]===roster[0].id?11000:9001;
  return {data:Array.from({length:Math.min(to-from+1,count-from)},(_,i)=>fictionalMeasurement(ids[0],from+i)),count,error:null};
 });
 await expect(loadAnalytics()).rejects.toThrow("source-limit");
 expect(calls.filter(c=>c.ids[0]===roster[split?5:10].id)).toHaveLength(1);
 expect(calls.every(c=>c.ids.length===(split&&c.ids.length!==10?5:10))).toBe(true);
});

it("still rejects duplicate observation identities across smaller athlete batches",async()=>{
 const roster=fictionalRoster(11);
 const calls=teamQueries(roster,ids=>({data:[{...fictionalMeasurement(ids[0],0),observation_id:"fictional-duplicate"}],count:1,error:null}));
 await expect(loadAnalytics()).rejects.toThrow("invalid-reading");expect(calls).toHaveLength(2);
});
