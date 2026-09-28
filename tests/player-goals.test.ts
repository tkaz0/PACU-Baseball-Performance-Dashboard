import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect,it,vi } from "vitest";
import { formatGoalValue,playerGoalProgress,type PlayerNumericGoal } from "@/lib/player-goals";
vi.mock("@/app/(workspace)/athletes/[id]/goal-actions",()=>({saveNumericGoal:vi.fn()}));
import { PlayerGoals } from "@/components/player-goals";
const goal:PlayerNumericGoal={id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",athleteId:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",title:"Fictional exit-speed target",metricKey:"max_exit_velocity",metricLabel:"Max Exit Velocity",source:"Full Swing · Intrasquad",unit:"mph",period:"fall_2026",baselineValue:80,baselineDate:"2026-09-11",baselineValid:true,targetValue:90,targetDate:"2026-10-15",staffNote:"Fictional private note",shared:true,completedAt:null,revision:1,createdAt:"2026-09-20T00:00:00Z",currentValue:85,currentDate:"2026-09-23"};
it("calculates goal progress from the recorded baseline rather than dividing by the target",()=>{
 expect(playerGoalProgress(goal)).toEqual({percent:50,barPercent:50,status:"toward",remaining:5});
 expect(playerGoalProgress({...goal,currentValue:95})).toEqual({percent:150,barPercent:100,status:"reached",remaining:0});
 expect(playerGoalProgress({...goal,currentValue:78})).toEqual({percent:-20,barPercent:0,status:"away",remaining:12});
 expect(playerGoalProgress({...goal,currentValue:80,currentDate:goal.baselineDate})).toMatchObject({percent:0,status:"awaiting"});
});
it("supports explicit lower targets without presuming every metric is higher-is-better",()=>{
 const timing={...goal,baselineValue:5,targetValue:4,currentValue:4.5};
 expect(playerGoalProgress(timing)).toEqual({percent:50,barPercent:50,status:"toward",remaining:.5});
 expect(playerGoalProgress({...timing,currentValue:5.5})).toMatchObject({percent:-50,barPercent:0,status:"away"});
 expect(playerGoalProgress({...timing,currentValue:3.9})).toMatchObject({barPercent:100,status:"reached",remaining:0});
});
it.each([{baselineValid:false},{targetValue:80},{currentValue:null},{currentDate:null},{currentValue:NaN},{targetValue:Infinity}])("withholds unsupported progress instead of manufacturing a bar %#",change=>{
 expect(playerGoalProgress({...goal,...change})).toEqual({percent:null,barPercent:0,status:"unavailable",remaining:null});
});
it("renders a labeled accessible bar, dates and exact source without private notes or staff controls",()=>{
 const html=renderToStaticMarkup(createElement(PlayerGoals,{athleteId:goal.athleteId,data:{goals:[goal,{...goal,id:"cccccccc-cccc-4ccc-8ccc-cccccccccccc",title:"Fictional unshared target",shared:false}],choices:[]},staff:false}));
 expect(html).toContain('role="progressbar"');expect(html).toContain('aria-valuenow="50"');expect(html).toContain("85.0 mph");expect(html).toContain("Full Swing · Intrasquad");expect(html).toContain("Sep 11, 2026");expect(html).toContain("Sep 23, 2026");
 for(const value of ["Fictional private note","Fictional unshared target","Add Numeric Goal","Edit Goal","staff_save_numeric_goal"])expect(html).not.toContain(value);
});
it("leaves a changed baseline uncharted and distinguishes completion from attaining a target",()=>{
 const missing=renderToStaticMarkup(createElement(PlayerGoals,{athleteId:goal.athleteId,data:{goals:[{...goal,baselineValid:false,currentValue:null,currentDate:null}],choices:[]},staff:false}));
 expect(missing).not.toContain('role="progressbar"');expect(missing).toContain("Starting reading needs review");
 const completed=renderToStaticMarkup(createElement(PlayerGoals,{athleteId:goal.athleteId,data:{goals:[{...goal,completedAt:"2026-09-25T00:00:00Z"}],choices:[]},staff:false}));
 expect(completed).toContain("Coach marked complete");expect(completed).toContain("At Completion");expect(completed).not.toContain("Target reached");
});
it("never suggests a numeric target or pre-shares a new goal",()=>{
 const html=renderToStaticMarkup(createElement(PlayerGoals,{athleteId:goal.athleteId,data:{goals:[],choices:[{observationId:"fictional-id",metricKey:"max_exit_velocity",metricLabel:"Max Exit Velocity",source:goal.source,unit:"mph",value:80,measuredAt:"2026-09-11"}]},staff:true}));
 expect(html).toContain("Add Numeric Goal");expect(html).toMatch(/name="target"[^>]*value=""/);expect(html).not.toMatch(/name="shared"[^>]*checked/);
});
it("uses one decimal for all bat speeds and Full Swing values and feet/inches for height",()=>{
 expect(formatGoalValue(71.456,"avg_bat_speed","mph","Fictional manual testing")).toBe("71.5 mph");
 expect(formatGoalValue(81.456,"classified_max_velocity","mph","Full Swing · Intrasquad · Fastball")).toBe("81.5 mph");
 expect(formatGoalValue(71,"height","in","RENPHO")).toBe("5′ 11″");
});
