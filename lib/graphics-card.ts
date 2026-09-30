import type { GraphicsMetric, GraphicsPlayerData, GraphicsLeaderboard } from "@/lib/graphics-data";
import type { GraphicsCard } from "@/lib/graphics-renderer";

export type GraphicsTemplate=GraphicsCard["kind"];
export const GRAPHICS_TEMPLATES:{id:GraphicsTemplate;label:string;description:string;staffOnly?:boolean}[]=[
 {id:"dashboard",label:"Dashboard Showcase",description:"Introduce the project and its tools."},
 {id:"player",label:"Player Snapshot",description:"A player and their key numbers."},
 {id:"spotlight",label:"Stat Spotlight",description:"One result. Big impact."},
 {id:"percentiles",label:"Percentile Card",description:"A visual look at team percentiles."},
 {id:"arsenal",label:"Pitch Arsenal",description:"Every pitch, velocity, and spin."},
 {id:"trend",label:"Progress Report",description:"Show change across testing dates."},
 {id:"leaderboard",label:"Team Leaderboard",description:"Share the leaders in one stat.",staffOnly:true},
 {id:"comparison",label:"Head-to-Head",description:"Two players, the same stats.",staffOnly:true},
];
const labels:Record<GraphicsMetric["category"],string>={physicality:"Physicality",hitting:"Hitting",pitching:"Pitching","game-hitting":"Game Stats · Hitting","game-pitching":"Game Stats · Pitching"};
export const graphicsGroupKey=(metric:GraphicsMetric)=>JSON.stringify([metric.category,metric.source,metric.context]);
export function graphicsMetricGroups(metrics:GraphicsMetric[]){
 const unique=[...new Map(metrics.map(metric=>[graphicsGroupKey(metric),{key:graphicsGroupKey(metric),label:`${labels[metric.category]} · ${metric.context || metric.source}`,source:metric.source}])).values()];
 return unique.sort((a,b)=>a.label.localeCompare(b.label));
}
export function selectedGraphicsMetrics(data:GraphicsPlayerData|null,groupKey:string,keys:string[],template:GraphicsTemplate):GraphicsMetric[]{
 const available=(data?.metrics??[]).filter(metric=>graphicsGroupKey(metric)===groupKey&&(template!=="percentiles"||metric.percentile!==null));
 const selected=available.filter(metric=>keys.includes(metric.key));
 return (selected.length?selected:available).slice(0,template==="spotlight"?1:6);
}
function metricNotes(metrics:GraphicsMetric[]):string[]{
 const keys=metrics.map(metric=>metric.key);
 const notes:string[]=[];
 if(keys.some(key=>/batting_est_(slg|iso)/.test(key)))notes.push("SLG / ISO count each double or triple as two bases; home runs as four.");
 if(keys.some(key=>key.includes("wobacon")))notes.push("wOBAcon uses fixed MLB reference weights and treats doubles/triples as doubles.");
 if(keys.some(key=>key.includes("production_plus")))notes.push("PAC Production+ is a Pacific team index (100 = team); not MLB wRC+.");
 return notes;
}
export type GraphicsCardOptions={template:GraphicsTemplate;player:GraphicsPlayerData|null;second:GraphicsPlayerData|null;metrics:GraphicsMetric[];board:GraphicsLeaderboard|null;topCount:number;arsenalContext:string;trendKey:string;headline:string};
/** Export only explicitly visible display fields; roster IDs and source provenance stay out of images. */
export function buildGraphicsCard(options:GraphicsCardOptions):GraphicsCard|null{
 const {template,player,second,metrics,board,headline}=options;
 if(template==="dashboard")return {kind:"dashboard",title:headline||"PEOPLE LIE.\nNUMBERS DON’T.",subtitle:"Pacific Baseball Performance",meta:"Player Development · Fall 2026",metrics:[{label:"Game Stats",value:"Track Production"},{label:"Player Profiles",value:"Know Your Game"},{label:"Pitch & Swing Design",value:"Build Your Approach"},{label:"Team Comparisons",value:"See the Difference"},{label:"Training Results",value:"Measure Progress"},{label:"Coach Tools",value:"Turn Data Into Action"}],source:"Built for players and coaches",footerNotes:[]};
 if(template==="leaderboard"){
  if(!board?.rows.length)return null;
  return {kind:template,title:headline||board.label,subtitle:"TEAM LEADERS",source:`${board.source} · ${board.context}`,meta:board.period,updated:board.date,metrics:[],ranking:board.rows.slice(0,options.topCount).map(row=>({name:row.name,value:row.formatted,rank:row.rank,sample:[row.sample,row.date].filter(Boolean).join(" · ")})),footerNotes:metricNotes([{key:board.key} as GraphicsMetric])};
 }
 if(!player)return null;
 const identity={name:player.player.name,meta:[player.player.position,player.player.secondaryPosition,player.player.academicClass].filter(Boolean).join(" · ")};
 if(template==="arsenal"){
  const pitches=player.arsenals.filter(p=>p.category===options.arsenalContext);if(!pitches.length)return null;
  return {kind:template,title:headline||"THE ARSENAL",subtitle:options.arsenalContext==="Practice"?"PRACTICE":"IN-GAME",...identity,source:`Full Swing · ${options.arsenalContext}`,updated:[...new Set(pitches.map(p=>p.lastDate))].sort().at(-1),metrics:[],pitches:pitches.map(p=>({name:p.label,velocity:p.averageVelocity,maxVelocity:p.maxVelocity,spin:p.averageSpin,maxSpin:p.maxSpin,sample:`${p.velocityCount??"—"} velo / ${p.spinCount??"—"} spin average readings`,context:[p.basis,p.velocityFirstDate?`Velo average: ${p.velocityFirstDate}${p.velocityLastDate!==p.velocityFirstDate?` to ${p.velocityLastDate}`:""}.`:"",p.spinFirstDate?`Spin average: ${p.spinFirstDate}${p.spinLastDate!==p.spinFirstDate?` to ${p.spinLastDate}`:""}.`:"",p.maxVelocityDate?`Max velo: ${p.maxVelocityDate}.`:"",p.maxSpinDate?`Max spin: ${p.maxSpinDate}.`:""].filter(Boolean).join(" ")})),footerNotes:["Fall averages are count-weighted when complete; otherwise the labeled latest verified average is shown. Maximums are Fall bests.",...(pitches.some(p=>p.velocityBasis==="latest"||p.spinBasis==="latest")?["Latest-session averages are labeled when Fall averages are unavailable."]:[])]};
 }
 if(template==="trend"){
  const trend=player.trends.find(t=>t.key===options.trendKey);if(!trend||trend.points.length<2)return null;
  return {kind:template,title:headline||"BUILDING MOMENTUM",subtitle:"PROGRESS REPORT",...identity,metrics:[],source:trend.source,updated:trend.points.at(-1)!.date,trend:trend.points,trendLabel:trend.label,trendUnit:trend.unit,footerNotes:["Recorded results on distinct testing dates, using the same source and units."]};
 }
 if(!metrics.length)return null;
 const dates=[...new Set(metrics.map(metric=>metric.date))].sort();
 const base:GraphicsCard={kind:template,title:headline||(template==="spotlight"?metrics[0].label:template==="percentiles"?"THE PLAYER REPORT":"KNOW YOUR GAME"),subtitle:template==="spotlight"?"STAT SPOTLIGHT":template==="percentiles"?"TEAM PERCENTILES":"PLAYER SNAPSHOT",...identity,source:`${metrics[0].source} · ${metrics[0].context}`,updated:dates.join(" / "),metrics:metrics.map(metric=>({label:metric.label,value:metric.formatted,percentile:metric.percentile,sample:[metric.sample,dates.length>1?metric.date:""].filter(Boolean).join(" · ")})),footerNotes:[...metricNotes(metrics),...(template==="percentiles"?["Percentiles compare matching Pacific team results, not national rankings."]:[])]};
 if(template==="comparison"){
  if(!second||second.player.id===player.player.id)return null;
  const matches=metrics.flatMap(metric=>{const match=second.metrics.find(other=>other.key===metric.key&&other.unit===metric.unit&&other.source===metric.source&&other.context===metric.context);return match?[{metric,match}]:[];});
  if(!matches.length)return null;
  return {...base,title:headline||"HEAD-TO-HEAD",name:undefined,meta:undefined,metrics:[],updated:[...new Set(matches.flatMap(row=>[row.metric.date,row.match.date]))].sort().join(" / "),comparison:{names:[player.player.name,second.player.name],rows:matches.map(({metric,match})=>({label:metric.label,a:metric.formatted,b:match.formatted,aSample:[metric.sample,metric.date].filter(Boolean).join(" · "),bSample:[match.sample,match.date].filter(Boolean).join(" · ")}))},footerNotes:[...metricNotes(matches.map(row=>row.metric)),"Recorded results shown side by side. Check dates and sample sizes."]};
 }
 return base;
}
export function graphicsCaption(card:GraphicsCard):string{
 const lines=[card.kind==="dashboard"?"Introducing Pacific Baseball Performance — a dashboard built to turn baseball data into useful feedback for players and coaches.":`${card.name?`${card.name} | `:""}${card.title.replaceAll("\n"," ")}`,card.subtitle,...card.metrics.map(metric=>`${metric.label}: ${metric.value}${metric.sample?` (${metric.sample})`:""}`),card.source??"",card.updated?`Results updated: ${card.updated}`:"",...(card.footerNotes??[]),"Explore the project: https://pacubaseballperformance.com","Independent project for Pacific Baseball. Not an official university application."];
 return lines.filter(Boolean).join("\n");
}
