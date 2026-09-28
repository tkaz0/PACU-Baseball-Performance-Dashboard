import type { PlayerGoalData,PlayerNumericGoal } from "@/lib/player-goals";
export const fictionalGoalAthleteId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const base:PlayerNumericGoal={id:"bbbbbbbb-bbbb-4bbb-8bbb-000000000001",athleteId:fictionalGoalAthleteId,title:"Fictional exit-speed goal",metricKey:"max_exit_velocity",metricLabel:"Max Exit Velocity",source:"Full Swing · Intrasquad",unit:"mph",period:"fall_2026",baselineValue:80,baselineDate:"2026-09-11",baselineValid:true,targetValue:90,targetDate:"2026-10-15",staffNote:"Fictional staff-only coaching note",shared:true,completedAt:null,revision:1,createdAt:"2026-09-25T00:00:00Z",currentValue:86,currentDate:"2026-09-23"};
export const fictionalPlayerGoals:PlayerGoalData={goals:[base,
 {...base,id:"bbbbbbbb-bbbb-4bbb-8bbb-000000000002",title:"Fictional home-to-first goal",metricKey:"home_to_first",metricLabel:"Home to First",source:"Fictional stopwatch testing",unit:"s",baselineValue:4.6,targetValue:4.2,currentValue:4.4,staffNote:null},
 {...base,id:"bbbbbbbb-bbbb-4bbb-8bbb-000000000003",title:"Fictional private target",shared:false,currentValue:78},
 {...base,id:"bbbbbbbb-bbbb-4bbb-8bbb-000000000004",title:"Fictional completed target",completedAt:"2026-09-24T00:00:00Z",currentValue:92},
 ],choices:[{observationId:"fictional-observation-choice",metricKey:"max_exit_velocity",metricLabel:"Max Exit Velocity",source:base.source,unit:"mph",value:86,measuredAt:"2026-09-23"}]};
