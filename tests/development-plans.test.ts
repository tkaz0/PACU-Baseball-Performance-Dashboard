import { expect,it } from "vitest";
import { developmentWeekStart,developmentWeekLabel,featuredDevelopmentPlan,parseDevelopmentPlans,validateDevelopmentPlanInput } from "@/lib/development-plans";
const athlete="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",plan={id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",athleteId:athlete,weekStart:"2026-09-28",focus:"Fictional focus",drills:[{id:"cccccccc-cccc-4ccc-8ccc-cccccccccccc",title:"Fictional drill",cue:null,completedAt:null}],staffNote:"Fictional staff note",shared:true,archived:false,revision:1,createdAt:"2026-09-29T00:00:00Z",updatedAt:"2026-09-29T00:00:00Z"};
it("uses calendar Monday boundaries without changing the entered week",()=>{expect(developmentWeekStart("2026-09-30")).toBe("2026-09-28");expect(developmentWeekStart("2026-10-04")).toBe("2026-09-28");expect(developmentWeekStart("2026-10-05")).toBe("2026-10-05");expect(developmentWeekLabel("2026-09-28")).toBe("Sep 28 – Oct 4");expect(()=>developmentWeekStart("2026-02-30")).toThrow();});
it("rejects invalid week dates, empty drills, duplicate IDs and control text",()=>{expect(validateDevelopmentPlanInput(plan)).toBe(true);for(const input of [{...plan,weekStart:"2026-09-29"},{...plan,weekStart:"2026-02-30"},{...plan,drills:[]},{...plan,drills:[plan.drills[0],plan.drills[0]]},{...plan,focus:"line\nline"}])expect(validateDevelopmentPlanInput(input)).toBe(false);});
it("strips staff notes and unknown fields for Player View and filters hidden plans",()=>{const projected=parseDevelopmentPlans([{...plan,secret:"must never leave server"}],athlete,false);expect(projected[0].staffNote).toBeNull();expect(projected[0]).not.toHaveProperty("secret");expect(parseDevelopmentPlans([{...plan,shared:false}],athlete,false)).toEqual([]);expect(parseDevelopmentPlans([{...plan,archived:true}],athlete,false)).toEqual([]);expect(parseDevelopmentPlans([plan],athlete,true)[0].staffNote).toBe(plan.staffNote);});
it("rejects malformed or cross-athlete RPC responses",()=>{for(const input of [[{...plan,athleteId:"different"}],[{...plan,revision:0}],[{...plan,drills:[{...plan.drills[0],completedAt:"invalid"}]}],[plan,plan]])expect(()=>parseDevelopmentPlans(input,athlete,true)).toThrow();});
it("features the nearest upcoming week when only future plans exist, retaining current and latest past priority",()=>{
 const nearest={...plan,weekStart:"2026-10-05"},furthest={...plan,weekStart:"2026-10-26"},past={...plan,weekStart:"2026-09-21"},old={...plan,weekStart:"2026-09-07"};
 expect(featuredDevelopmentPlan([furthest,nearest],"2026-09-30")).toBe(nearest);
 expect(featuredDevelopmentPlan([nearest,furthest],"2026-09-30")).toBe(nearest);
 expect(featuredDevelopmentPlan([furthest,nearest,{...plan,archived:true}],"2026-09-30")).toBe(nearest);
 expect(featuredDevelopmentPlan([furthest,nearest,plan,past],"2026-09-30")).toBe(plan);
 expect(featuredDevelopmentPlan([old,nearest,past],"2026-09-30")).toBe(past);
 expect(featuredDevelopmentPlan([{...plan,archived:true}],"2026-09-30")).toBeUndefined();
});
