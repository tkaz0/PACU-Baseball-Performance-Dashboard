import type { CoachingData, CoachingPlayer, CoachingGame } from "@/lib/coaching-tools";
import { fictionalComparisonPitch } from "./comparison-arsenal";
// Entirely fictional examples for comparison logic and layout verification.
export const groupPlayers:CoachingPlayer[]=Array.from({length:8},(_,i)=>({id:`fictional-group-${i}`,code:`SYN-${String(i+1).padStart(3,"0")}`,name:`Example ${["North","West","South","East","River","Valley","Cedar","Stone"][i]}`,position:["SS","2B","3B","OF","C","P","P","1B"][i],secondaryPosition:i===3?"SS":"",playerType:i===6?"two_way":i===5?"pitcher":"position",academicClass:["Junior","Senior","Sophomore","Freshman"][i%4],bats:i%2?"L":"R",throws:"R"}));
export const groupGames:CoachingGame[]=groupPlayers.filter((_,i)=>i!==5).flatMap((p,i)=>[
 {metric:"batting_avg",label:"AVG",value:.2+i*.027,unit:"avg",opportunities:12+i*4,direction:"higher"},
 {metric:"batting_obp",label:"OBP",value:.28+i*.025,unit:"avg",opportunities:15+i*5,direction:"higher"},
 {metric:"batting_est_slg",label:"SLG",value:.32+i*.042,unit:"avg",opportunities:12+i*4,direction:"higher"},
 {metric:"batting_est_iso",label:"ISO",value:.12+i*.015,unit:"avg",opportunities:12+i*4,direction:"higher"},
 {metric:"batting_k_pct",label:"K%",value:22-i*1.4,unit:"%",opportunities:15+i*5,direction:"lower"},
 {metric:"batting_bb_pct",label:"BB%",value:5+i*1.6,unit:"%",opportunities:15+i*5,direction:"higher"},
 {metric:"pumps",label:"HR",value:i%3,unit:"count",opportunities:15+i*5,direction:"higher"},
].map(r=>({...r,athleteId:p.id,snapshotId:"fictional-current",source:"qpa_fall_2026",eventId:"",updatedAt:"2026-09-29T01:00:00Z",playedOn:null,insightEligible:r.unit!=="count"}) as CoachingGame));
export const groupData:CoachingData={players:groupPlayers,games:groupGames,readings:groupPlayers.flatMap((p,i)=>[
 {id:`synthetic-muscle-${i}`,athleteId:p.id,metric:"muscle_mass",label:"Muscle Mass",value:120+i*5,unit:"lb",source:"RENPHO",date:"2026-09-20",importedAt:"2026-09-21T00:00:00Z"},
 {id:`synthetic-weight-${i}`,athleteId:p.id,metric:"weight",label:"Weight",value:160+i*6,unit:"lb",source:"RENPHO",date:"2026-09-20",importedAt:"2026-09-21T00:00:00Z"},
 {id:`synthetic-bat-${i}`,athleteId:p.id,metric:"avg_bat_speed",label:"Average Bat Speed",value:60+i*.45,unit:"mph",source:"Full Swing · Intrasquad",date:"2026-09-11",importedAt:"2026-09-21T00:00:00Z"},
]),arsenals:groupPlayers.slice(5,7).map((p,i)=>({athleteId:p.id,pitches:[fictionalComparisonPitch({pitchType:"Four-Seam Fastball",source:"Full Swing · Intrasquad · Four-Seam Fastball",averageVelocity:80+i*2}),fictionalComparisonPitch({pitchType:"Slider",source:"Full Swing · Intrasquad · Slider",averageVelocity:70+i})]}))};
