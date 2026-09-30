"use client";

import { useEffect, useState } from "react";
import { BarChart3, ChartNoAxesCombined, ChartSpline, Download, Image as ImageIcon, LayoutDashboard, LoaderCircle, Medal, Swords, Target, UserRound, Copy, Check, Search } from "lucide-react";
import type { StaffAthleteChoice } from "@/lib/staff-athlete-search";
import { matchesStaffAthlete } from "@/lib/staff-athlete-search";
import type { GraphicsPlayerData, GraphicsLeaderboard } from "@/lib/graphics-data";
import { GRAPHICS_TEMPLATES, buildGraphicsCard, graphicsCaption, graphicsMetricGroups, selectedGraphicsMetrics, type GraphicsTemplate } from "@/lib/graphics-card";
import { graphicsSize, renderGraphics, type GraphicsFormat, type GraphicsTheme } from "@/lib/graphics-renderer";
import styles from "./graphics-studio.module.css";

const icons={dashboard:LayoutDashboard,player:UserRound,spotlight:Medal,percentiles:BarChart3,arsenal:Target,trend:ChartSpline,leaderboard:ChartNoAxesCombined,comparison:Swords};
const formats:{key:GraphicsFormat;label:string;detail:string}[]=[{key:"square",label:"Square",detail:"1:1 · Posts"},{key:"portrait",label:"Portrait",detail:"4:5 · Feed"},{key:"story",label:"Story",detail:"9:16 · Stories"},{key:"landscape",label:"Widescreen",detail:"16:9 · Slides"}];

async function readGraphics(body:object,signal:AbortSignal){
 const response=await fetch("/graphics/data",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),signal,cache:"no-store"});
 if(!response.ok)throw new Error(response.status===401?"Sign in again to load your results.":response.status===403?"These graphics are not available for this account.":"Results could not be loaded. Please try again.");
 return response.json();
}
async function loadImage(source:string):Promise<HTMLImageElement>{
 return new Promise((resolve,reject)=>{const image=new window.Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error("The graphic could not be prepared. Try downloading the SVG instead."));image.src=source;});
}
async function brandImage(theme:GraphicsTheme){
 const image=await loadImage(`/brand/pacific-university${theme==="cream"?"":"-white"}.svg`);
 const canvas=document.createElement("canvas");canvas.width=488;canvas.height=332;
 const context=canvas.getContext("2d");if(!context)throw new Error("Image preview is unavailable.");context.drawImage(image,0,0,488,332);return canvas.toDataURL("image/png");
}
function saveBlob(blob:Blob,name:string){const url=URL.createObjectURL(blob),anchor=document.createElement("a");anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

function useGraphicsResource<T>(enabled:boolean,body:object,retry:number,fixture?:T){
 const serialized=JSON.stringify(body),key=`${serialized}:${retry}`;
 const [response,setResponse]=useState<{key:string;data:T|null;error:string}|null>(null);
 const fixtureMode=fixture!==undefined;
 useEffect(()=>{
  if(!enabled||fixtureMode)return;
  const controller=new AbortController();
  readGraphics(JSON.parse(serialized),controller.signal).then(data=>{if(!controller.signal.aborted)setResponse({key,data,error:""});}).catch(reason=>{if(!controller.signal.aborted)setResponse({key,data:null,error:reason instanceof Error?reason.message:"Results could not be loaded."});});
  return()=>controller.abort();
 },[enabled,fixtureMode,serialized,key]);
 return fixtureMode?{data:fixture,error:"",loading:false}:!enabled?{data:null,error:"",loading:false}:response?.key===key?{data:response.data,error:response.error,loading:false}:{data:null,error:"",loading:true};
}
function composePreview(card:ReturnType<typeof buildGraphicsCard>,options:Parameters<typeof renderGraphics>[1]){try{return {svg:card?renderGraphics(card,options):null,error:""};}catch(reason){return {svg:null,error:reason instanceof Error?reason.message:"Choose a taller format or fewer stats for this graphic."};}}

type StudioFixture={player?:GraphicsPlayerData;second?:GraphicsPlayerData;boards?:GraphicsLeaderboard[]};
export function GraphicsStudio({staff,players,ownAthleteId,fixture}:{staff:boolean;players:StaffAthleteChoice[];ownAthleteId:string|null;fixture?:StudioFixture}){
 const [template,setTemplate]=useState<GraphicsTemplate>(staff?"dashboard":"player");
 const [format,setFormat]=useState<GraphicsFormat>(staff?"square":"portrait");const [theme,setTheme]=useState<GraphicsTheme>("black");
 const [selectedId,setSelectedId]=useState(fixture?.player?.player.id??(!staff?ownAthleteId??"":""));
 const [secondId,setSecondId]=useState(fixture?.second?.player.id??"");
 const [retry,setRetry]=useState(0),[search,setSearch]=useState("");
 const playerResult=useGraphicsResource<{data:GraphicsPlayerData}>(!!selectedId,{kind:"player",athleteId:selectedId},retry,fixture?.player?{data:fixture.player}:undefined);
 const secondResult=useGraphicsResource<{data:GraphicsPlayerData}>(staff&&template==="comparison"&&!!secondId,{kind:"player",athleteId:secondId},retry,fixture?.second?{data:fixture.second}:undefined);
 const boardsResult=useGraphicsResource<{boards:GraphicsLeaderboard[]}>(staff&&template==="leaderboard",{kind:"leaderboards"},retry,fixture?.boards?{boards:fixture.boards}:undefined);
 const player=playerResult.data?.data??null,second=secondResult.data?.data??null,boards=boardsResult.data?.boards??[];
 const loading=playerResult.loading,loadingSecond=secondResult.loading,loadingBoards=boardsResult.loading;
 const error=playerResult.error,secondError=secondResult.error,boardError=boardsResult.error;
 const [groupKey,setGroupKey]=useState(""),[metricKeys,setMetricKeys]=useState<string[]>([]),[boardKey,setBoardKey]=useState(""),[topCount,setTopCount]=useState(5);
 const [arsenalContext,setArsenalContext]=useState(""),[trendKey,setTrendKey]=useState(""),[headline,setHeadline]=useState("");
 const [logo,setLogo]=useState<string|undefined>(),[downloading,setDownloading]=useState(false),[status,setStatus]=useState("");
 const [captionCopied,setCaptionCopied]=useState(false);
 useEffect(()=>{let live=true;brandImage(theme).then(value=>{if(live)setLogo(value);}).catch(()=>{if(live)setLogo(undefined);});return()=>{live=false;};},[theme]);
 const availableMetrics=(player?.metrics??[]).filter(metric=>template!=="percentiles"||metric.percentile!==null);
 const groups=graphicsMetricGroups(availableMetrics);
 const selectedGroup=groups.find(group=>group.key===groupKey)??groups[0];
 const metrics=selectedGraphicsMetrics(player,selectedGroup?.key??"",metricKeys,template);
 const metricChoices=availableMetrics.filter(metric=>selectedGroup?.key===JSON.stringify([metric.category,metric.source,metric.context]));
 const contexts=[...new Set(player?.arsenals.map(pitch=>pitch.category)??[])];
 const context=contexts.find(value=>value===arsenalContext)??contexts[0]??"";
 const selectedTrend=player?.trends.find(trend=>trend.key===trendKey)??player?.trends[0];
 const selectedBoard=boards.find(board=>board.key===boardKey)??boards[0]??null;
 const card=buildGraphicsCard({template,player:player?.player.id===selectedId?player:null,second:second?.player.id===secondId?second:null,metrics,board:selectedBoard,topCount,arsenalContext:context,trendKey:selectedTrend?.key??"",headline:headline.trim()});
 const rendered=composePreview(card,{format,theme,logoDataUrl:logo});
 const svg=rendered.svg;
 const size=graphicsSize(format);
 const source=svg?`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`:undefined;
 const busy=template==="leaderboard"?loadingBoards:template==="dashboard"?false:loading||(template==="comparison"&&loadingSecond);
 const currentError=template==="leaderboard"?boardError:template==="dashboard"?"":error||(template==="comparison"?secondError:"");
 const hasPlayer=!["dashboard","leaderboard"].includes(template);
 const visiblePlayers=players.filter(p=>matchesStaffAthlete(p,search));
 const selectedOption=players.find(p=>p.id===selectedId);
 const caption=card?graphicsCaption(card):"";

 function chooseTemplate(next:GraphicsTemplate){setTemplate(next);setFormat(next==="arsenal"?"story":next==="dashboard"||next==="spotlight"?"square":"portrait");setHeadline("");setStatus("");setCaptionCopied(false);setMetricKeys([]);}
 function toggleMetric(key:string){const current=metrics.map(metric=>metric.key);setMetricKeys(current.includes(key)?current.length>1?current.filter(item=>item!==key):current:[...current,key].slice(0,6));setStatus("");}
 async function download(kind:"png"|"svg"){
  if(!svg||!card||busy)return;setDownloading(true);setStatus("");
  const filename=`pacific-baseball-${template}-${format}.${kind}`;
  try{
   if(kind==="svg")saveBlob(new Blob([svg],{type:"image/svg+xml;charset=utf-8"}),filename);
   else{const url=URL.createObjectURL(new Blob([svg],{type:"image/svg+xml;charset=utf-8"}));try{const image=await loadImage(url);const canvas=document.createElement("canvas");canvas.width=size.width;canvas.height=size.height;const context=canvas.getContext("2d");if(!context)throw new Error("Image export is unavailable in this browser.");context.drawImage(image,0,0);const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error("Image export failed.")),"image/png"));saveBlob(blob,filename);}finally{URL.revokeObjectURL(url);}}
   setStatus(`${kind.toUpperCase()} downloaded. Ready to share.`);
  }catch(reason){setStatus(reason instanceof Error?reason.message:"The download did not finish. Please try again.");}finally{setDownloading(false);}
 }
 async function copyCaption(){try{await navigator.clipboard.writeText(caption);setCaptionCopied(true);setStatus("Caption copied.");}catch{setStatus("Select the caption below and copy it.");}}
 const emptyMessage=!selectedId&&hasPlayer?staff?"Choose a player to build this graphic.":"Your account needs a linked player profile.":template==="comparison"?!secondId?"Choose a second player to compare.":secondId===selectedId?"Choose two different players.":"These players need matching stats from the same source.":template==="percentiles"?"No verified team percentiles are available for this player yet.":template==="trend"?"A progress graphic needs at least two testing dates on the same test.":template==="arsenal"?"No classified pitch results have been saved for this player yet.":template==="leaderboard"?"No team rankings are available yet.":"No results are available for this selection yet.";

 return <div className={styles.studio}>
  <section aria-label="Graphic templates" className={styles.templates}>{GRAPHICS_TEMPLATES.filter(item=>staff||!item.staffOnly).map(item=>{const Icon=icons[item.id];return <button type="button" key={item.id} className={styles.template} aria-pressed={template===item.id} onClick={()=>chooseTemplate(item.id)}><span className={styles.templateIcon}><Icon size={20}/></span><span><strong>{item.label}</strong><small>{item.description}</small></span>{template===item.id&&<Check size={15} className={styles.selectedCheck}/>}</button>;})}</section>
  <div className={styles.workspace}>
   <section className={styles.controls} aria-label="Customize graphic">
    <header><span className={styles.step}>01</span><h2>Make It Yours</h2></header>
    {staff&&hasPlayer&&<><label className={styles.search}><Search size={15}/><input aria-label="Find a player for graphic" placeholder="Search player name" value={search} onChange={event=>setSearch(event.target.value)}/></label><label className={styles.field}>Player<select aria-label="Graphic player" value={selectedId} onChange={event=>{setSelectedId(event.target.value);setGroupKey("");setMetricKeys([]);setStatus("");}}><option value="">Choose a player</option>{visiblePlayers.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}{selectedOption&&!visiblePlayers.some(p=>p.id===selectedId)&&<option value={selectedId}>{selectedOption.name}</option>}</select></label></>}
    {!staff&&player&&hasPlayer&&<div className={styles.ownPlayer}><UserRound size={18}/><strong>{player.player.name}</strong></div>}
    {template==="comparison"&&<label className={styles.field}>Compare With<select aria-label="Second graphic player" value={secondId} onChange={event=>setSecondId(event.target.value)}><option value="">Choose another player</option>{players.filter(p=>p.id!==selectedId).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
    {hasPlayer&&!['arsenal','trend'].includes(template)&&groups.length>0&&<><label className={styles.field}>Results<select aria-label="Graphic results" value={selectedGroup?.key??""} onChange={event=>{setGroupKey(event.target.value);setMetricKeys([]);}}>{groups.map(group=><option key={group.key} value={group.key}>{group.label} · {group.source}</option>)}</select></label>{template==="spotlight"?<label className={styles.field}>Spotlight Stat<select aria-label="Spotlight stat" value={metrics[0]?.key??""} onChange={event=>setMetricKeys([event.target.value])}>{metricChoices.map(metric=><option key={metric.key} value={metric.key}>{metric.label}</option>)}</select></label>:<details className={styles.metricOptions}><summary>Choose Stats <span>{metrics.length} / 6</span></summary><div>{metricChoices.map(metric=><label key={metric.key}><input type="checkbox" checked={metrics.some(item=>item.key===metric.key)} disabled={(metrics.length===6&&!metrics.some(item=>item.key===metric.key))||(metrics.length===1&&metrics[0]?.key===metric.key)} onChange={()=>toggleMetric(metric.key)}/>{metric.label}</label>)}</div></details>}</>}
    {template==="arsenal"&&contexts.length>0&&<label className={styles.field}>Pitching Source<select aria-label="Graphic pitching source" value={context} onChange={event=>setArsenalContext(event.target.value)}>{contexts.map(value=><option key={value} value={value}>{value==="Practice"?value:`In-Game · ${value}`}</option>)}</select></label>}
    {template==="trend"&&!!player?.trends.length&&<label className={styles.field}>Progress Stat<select aria-label="Graphic progress stat" value={selectedTrend?.key??""} onChange={event=>setTrendKey(event.target.value)}>{player.trends.map(trend=><option key={trend.key} value={trend.key}>{trend.label} · {trend.source}</option>)}</select></label>}
    {template==="leaderboard"&&boards.length>0&&<><label className={styles.field}>Leaderboard<select aria-label="Graphic leaderboard" value={selectedBoard?.key??""} onChange={event=>setBoardKey(event.target.value)}>{boards.map(board=><option key={board.key} value={board.key}>{board.label} · {board.context} · {board.source}</option>)}</select></label><label className={styles.field}>Players to Show<select value={topCount} onChange={event=>{setTopCount(Number(event.target.value));if(Number(event.target.value)===10)setFormat("story");}}><option value={5}>Top 5</option><option value={10}>Top 10</option></select></label></>}
    <label className={styles.field}>Headline <span>Optional</span><input maxLength={56} value={headline} placeholder="Use template headline" onChange={event=>setHeadline(event.target.value)}/></label>
    <div className={styles.divider}/>
    <span className={styles.controlLabel}>Format</span><div className={styles.formats}>{formats.map(item=><button type="button" key={item.key} aria-pressed={format===item.key} onClick={()=>{setFormat(item.key);setStatus("");}}><span className={`${styles.formatShape} ${styles[item.key]}`} aria-hidden="true"/><strong>{item.label}</strong><small>{item.detail}</small></button>)}</div>
    <span className={styles.controlLabel}>Colorway</span><div className={styles.themes}>{(["black","red","cream"] as GraphicsTheme[]).map(color=><button key={color} type="button" aria-label={`${color} graphic theme`} aria-pressed={theme===color} onClick={()=>{setTheme(color);setStatus("");}}><span className={styles[color]}/>{color==="black"?"Boxer Black":color==="red"?"Pacific Red":"Classic Cream"}{theme===color&&<Check size={12}/>}</button>)}</div>
   </section>
   <section className={styles.previewPanel} aria-label="Graphic preview and download">
    <header className={styles.previewHeading}><div><span className={styles.step}>02</span><h2>Preview & Download</h2></div><span>{size.width} × {size.height} px</span></header>
    <div className={styles.previewStage} aria-busy={busy}>
     {busy?<div className={styles.empty}><LoaderCircle className={styles.spin} size={30}/><strong>Loading Saved Results</strong><p>Your graphic will use the selected player’s verified data.</p></div>:currentError?<div className={styles.empty}><ImageIcon size={30}/><strong>Couldn’t Load Results</strong><p>{currentError}</p><button className="btn btn-secondary" onClick={()=>setRetry(value=>value+1)}>Try Again</button></div>:rendered.error?<div className={styles.empty}><ImageIcon size={30}/><strong>Give This Graphic More Room</strong><p>{rendered.error}</p><button className="btn btn-secondary" onClick={()=>setFormat("story")}>Use Story Format</button></div>:source?<>
      {/* A self-contained SVG preview uses the same document as both downloads. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={source} alt={`${GRAPHICS_TEMPLATES.find(item=>item.id===template)?.label} preview${card?.name?` for ${card.name}`:""}`} className={styles.previewImage} style={{aspectRatio:`${size.width} / ${size.height}`}}/>
     </>:<div className={styles.empty}><ImageIcon size={34}/><strong>Ready When You Are</strong><p>{emptyMessage}</p></div>}
    </div>
    <div className={styles.exportBar}><button type="button" className="btn btn-primary" disabled={!svg||busy||!!currentError||downloading} onClick={()=>download("png")}>{downloading?<LoaderCircle size={16} className={styles.spin}/>:<Download size={16}/>}Download PNG</button><button type="button" className="btn btn-secondary" disabled={!svg||busy||!!currentError||downloading} onClick={()=>download("svg")}>Download SVG</button><span>PNG for sharing · SVG for editing</span></div>
    <p className={styles.status} role="status">{status}</p>
    {card&&!busy&&!currentError&&<details className={styles.caption}><summary>Suggested Caption</summary><textarea aria-label="Suggested graphic caption" readOnly value={caption} rows={5}/><button type="button" className="btn btn-secondary" onClick={copyCaption}>{captionCopied?<Check size={14}/>:<Copy size={14}/>}Copy Caption</button></details>}
   </section>
  </div>
 </div>;
}
