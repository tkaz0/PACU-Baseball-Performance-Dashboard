import { UUID_PATTERN } from "@/lib/types";
export const BATTING_FIELDS={pa:"PA",ab:"AB",h:"Hits",doubles:"Doubles",triples:"Triples",hr:"HR",bb:"BB",hbp:"HBP",sf:"Sac Fly",sh:"Sac Bunt",k:"K",sb:"SB",gdp:"GDP",rbi:"RBI"} as const;
export const PITCHING_FIELDS={pitches:"Pitches",strikes:"Strikes",bf:"Batters Faced",k:"K",bb:"BB",h:"Hits Allowed",r:"Runs",er:"Earned Runs",outs:"Outs Recorded"} as const;
export type GameCounts=Record<string,number>;
export type GameLogInput={requestId:string;id:string;expectedVersion:number;athleteId:string;playedOn:string;opponent:string;gameNumber:number;kind:"game"|"intrasquad";batting:GameCounts;pitching:GameCounts};
export type GameLog=Omit<GameLogInput,"requestId"|"expectedVersion">&{version:number;updatedAt:string};
export type GameLogSaveResult={status:"saved";id:string;version:number}|{status:"invalid"|"uncertain";error:string};
export const pacificGameDate=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/Los_Angeles",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
export function countIssues(b:GameCounts,p:GameCounts):string[]{
 const issues:string[]=[];
 const check=(v:GameCounts,left:string,right:string,message:string)=>{if(v[left]!==undefined&&v[right]!==undefined&&v[left]>v[right])issues.push(message);};
 check(b,"ab","pa","AB exceeds PA.");check(b,"h","ab","Hits exceed AB.");check(b,"k","ab","Strikeouts exceed AB.");check(b,"hr","h","Home runs exceed hits.");
 for(const key of ["bb","hbp","sf","sh"])check(b,key,"pa",`${BATTING_FIELDS[key as keyof typeof BATTING_FIELDS]} exceeds PA.`);
 if(b.h!==undefined&&b.k!==undefined&&b.ab!==undefined&&b.h+b.k>b.ab)issues.push("Hits + strikeouts exceeds AB.");
 for(const k of ["doubles","triples"])check(b,k,"h",`${k==='doubles'?'Doubles':'Triples'} exceed hits.`);
 if(["doubles","triples","hr","h"].every(k=>b[k]!==undefined)&&b.doubles+b.triples+b.hr>b.h)issues.push("Extra-base hits exceed total hits.");
 if(["ab","bb","hbp","sf","pa"].every(k=>b[k]!==undefined)&&b.ab+b.bb+b.hbp+b.sf>b.pa)issues.push("AB + BB + HBP + Sac Fly exceeds PA.");
 if(!issues.includes("AB + BB + HBP + Sac Fly exceeds PA.")&&["ab","bb","hbp","sf","sh","pa"].every(k=>b[k]!==undefined)&&b.ab+b.bb+b.hbp+b.sf+b.sh>b.pa)issues.push("Recorded batting outcomes exceed PA.");
 check(p,"strikes","pitches","Strikes exceed pitches.");check(p,"er","r","Earned runs exceed runs.");
 for(const k of ["k","bb","h"])check(p,k,"bf",`${PITCHING_FIELDS[k as keyof typeof PITCHING_FIELDS]} exceeds batters faced.`);
 if(["k","bb","h","bf"].every(k=>p[k]!==undefined)&&p.k+p.bb+p.h>p.bf)issues.push("K + BB + hits exceeds batters faced.");
 return issues;
}
export function validateGameLog(value:unknown,today=pacificGameDate()):GameLogInput {
 if(!object(value)||Object.keys(value).sort().join()!=="athleteId,batting,expectedVersion,gameNumber,id,kind,opponent,pitching,playedOn,requestId")throw Error("Review the game entry format.");
 for(const k of ["requestId","id","athleteId"])if(typeof value[k]!=="string"||!UUID_PATTERN.test(value[k] as string))throw Error("Choose a rostered player and refresh the entry.");
 if(!Number.isSafeInteger(value.expectedVersion)||(value.expectedVersion as number)<0||(value.expectedVersion as number)>1000000)throw Error("Refresh this game's saved version.");
 const date=value.playedOn;
 if(typeof date!=="string"||!/^2026-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date<"2026-09-01"||date>"2026-12-31"||date>today)throw Error("Use an actual Fall 2026 game date, no later than today.");
 if(typeof value.opponent!=="string"||/[\u0000-\u001f\u007f]/.test(value.opponent))throw Error("Enter the opponent or intrasquad teams.");
 const opponent=value.opponent.trim().replace(/\s+/g," ");if(!opponent||opponent.length>80)throw Error("Enter an opponent of 1–80 characters.");
 if(!Number.isInteger(value.gameNumber)||(value.gameNumber as number)<1||(value.gameNumber as number)>3||!["game","intrasquad"].includes(value.kind as string))throw Error("Choose the game type and number (1–3).");
 for(const [field,catalog]of [["batting",BATTING_FIELDS],["pitching",PITCHING_FIELDS]] as const){const v=value[field];if(!object(v)||Object.entries(v).some(([key,n])=>!Object.hasOwn(catalog,key)||!Number.isSafeInteger(n)||(n as number)<0||(n as number)>1000))throw Error("Use whole counts from 0 to 1,000. Leave unknown counts blank.");}
 const b=value.batting as GameCounts,p=value.pitching as GameCounts;if(!Object.keys(b).length&&!Object.keys(p).length)throw Error("Enter at least one recorded game count.");
 const issues=countIssues(b,p);if(issues.length)throw Error(issues.join(" "));
 return {...value,opponent,batting:{...b},pitching:{...p}} as GameLogInput;
}
export type LogRate={label:string;value:number;unit:"avg"|"%";opportunities:number;opportunityLabel:string};
/** Aggregate only complete metric inputs from the explicitly selected dated games. */
export function loggedBattingRates(logs:readonly GameLog[]):LogRate[]{
 if(!logs.length||new Set(logs.map(l=>l.athleteId)).size!==1)return [];
 const totals:GameCounts={};for(const key of Object.keys(BATTING_FIELDS))if(logs.every(l=>l.batting[key]!==undefined))totals[key]=logs.reduce((sum,l)=>sum+l.batting[key],0);
 const rates:LogRate[]=[];const add=(label:string,keys:string[],top:number,bottom:number,unit:"avg"|"%",opportunityLabel:string)=>{if(keys.every(k=>totals[k]!==undefined)&&bottom>0)rates.push({label,value:top/bottom*(unit==="%"?100:1),unit,opportunities:bottom,opportunityLabel});};
 const v=totals;add("AVG",["h","ab"],v.h,v.ab,"avg","AB");add("OBP",["h","bb","hbp","ab","sf"],v.h+v.bb+v.hbp,v.ab+v.bb+v.hbp+v.sf,"avg","OBP opportunities");
 const tb=v.h+v.doubles+2*v.triples+3*v.hr;add("SLG",["h","doubles","triples","hr","ab"],tb,v.ab,"avg","AB");add("ISO",["doubles","triples","hr","ab"],v.doubles+2*v.triples+3*v.hr,v.ab,"avg","AB");
 add("HR %",["hr","pa"],v.hr,v.pa,"%","PA");add("BB %",["bb","pa"],v.bb,v.pa,"%","PA");add("K %",["k","pa"],v.k,v.pa,"%","PA");return rates;
}

export function loggedPitchingRates(logs:readonly GameLog[]):LogRate[]{
 if(!logs.length||new Set(logs.map(l=>l.athleteId)).size!==1)return [];
 const rates:LogRate[]=[];
 for(const [label,top,bottom,opportunityLabel] of [["Strike %","strikes","pitches","pitches"],["Pitching K %","k","bf","batters faced"],["Pitching BB %","bb","bf","batters faced"]]){
  if(!logs.every(l=>l.pitching[top]!==undefined&&l.pitching[bottom]!==undefined))continue;
  const numerator=logs.reduce((sum,l)=>sum+l.pitching[top],0),denominator=logs.reduce((sum,l)=>sum+l.pitching[bottom],0);
  if(denominator>0)rates.push({label,value:100*numerator/denominator,unit:"%",opportunities:denominator,opportunityLabel});
 }
 return rates;
}
