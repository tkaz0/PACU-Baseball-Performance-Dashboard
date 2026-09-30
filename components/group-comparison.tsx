"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, SlidersHorizontal, X, Users } from "lucide-react";
import { GroupPlayerPicker } from "@/components/group-player-picker";
import { CoachingTabs } from "@/components/team-progress";
import { StatInfo } from "@/components/stat-info";
import { coachingValue, playerGameSources, type CoachingCategory, type CoachingData } from "@/lib/coaching-tools";
import { buildGroupComparison, groupPresets, type GroupComparisonGroup, type GroupComparisonColumn } from "@/lib/group-comparison";
import styles from "./group-comparison.module.css";

export function visibleGroupColumns(group:GroupComparisonGroup|undefined,saved:string[]|undefined):string[]{
 if(!group)return [];
 const current=saved?.filter(key=>group.columns.some(column=>column.key===key))??[];
 return current.length?[...new Set(current)]:group.columns.slice(0,6).map(column=>column.key);
}

function GroupTable({ group, data, selectedColumns, showDetails }: { group: GroupComparisonGroup; data: CoachingData; selectedColumns: string[]; showDetails: boolean }) {
 const [sort, setSort] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
 const columns = group.columns.filter(column => selectedColumns.includes(column.key));
 const activeSort=sort&&columns.some(column=>column.key===sort.key)?sort:null;
 const rows = [...group.rows].sort((a,b) => {
  const av = activeSort ? a.cells[activeSort.key]?.value : null, bv = activeSort ? b.cells[activeSort.key]?.value : null;
  if (activeSort && av != null && bv != null && av !== bv) return activeSort.direction === "asc" ? av-bv : bv-av;
  if (activeSort && av != null && bv == null) return -1;
  if (activeSort && av == null && bv != null) return 1;
  return (data.players.find(p=>p.id===a.playerId)?.name ?? "").localeCompare(data.players.find(p=>p.id===b.playerId)?.name ?? "");
 });
 const extent = (column: GroupComparisonColumn) => {
  const values = group.rows.flatMap(row => row.cells[column.key]?.value != null ? [row.cells[column.key].value!] : []);
  return { min: Math.min(...values), max: Math.max(...values), count: values.length };
 };
 const toggleSort = (column: GroupComparisonColumn) => setSort(current => ({key:column.key, direction:current?.key===column.key ? current.direction === "asc" ? "desc" : "asc" : column.direction==="lower" ? "asc" : "desc"}));
 return <div className={styles.tableScroll} role="region" aria-label={`${group.label} comparison table`} tabIndex={0}>
  <table className={styles.table}>
   <caption className={styles.srOnly}>{group.label}. Compare selected players. Select a stat heading to sort; missing results stay last.</caption>
   <thead><tr><th scope="col" className={styles.playerColumn}><button type="button" onClick={()=>setSort(null)}>Player <ArrowUpDown size={13}/></button></th>{columns.map(column=><th key={column.key} scope="col" aria-sort={sort?.key===column.key ? sort.direction==="asc" ? "ascending" : "descending" : "none"}>
    <div className={styles.columnHeading}><button type="button" onClick={()=>toggleSort(column)}>{column.label}{sort?.key===column.key ? sort.direction==="asc" ? <ArrowUp size={13}/> : <ArrowDown size={13}/> : <ArrowUpDown size={13}/>}</button><StatInfo metric={column.metric} label={column.label} source={group.source} unit={column.unit}/></div>
    <span className={styles.columnNote}>{column.direction==="neutral" ? "Recorded value" : !column.comparable ? "Separate results" : column.direction==="higher" ? "Higher leads" : "Lower leads"}</span>
   </th>)}</tr></thead>
   <tbody>{rows.map(row=>{
    const player = data.players.find(p=>p.id===row.playerId); if(!player) return null;
    return <tr key={row.playerId}><th scope="row" className={styles.playerColumn}><Link prefetch={false} href={`/athletes/${player.id}`}>{player.name}<span aria-hidden="true">↗</span></Link><span className={styles.playerMeta}>{[player.position,player.secondaryPosition,player.academicClass].filter(Boolean).join(" · ")}</span></th>
     {columns.map(column=>{
      const cell = row.cells[column.key]; const value=cell?.value ?? null; const range=extent(column);
      const leads=column.comparable && column.direction!=="neutral" && value!==null && range.count>=2 && Math.abs(value-(column.direction==="higher"?range.max:range.min))<1e-10;
      // Magnitude bars use a true zero baseline and never grade signed angles or neutral body/spin values.
      const bar = column.comparable && column.direction!=="neutral" && value!==null && range.min>=0 && range.max>0;
      return <td key={column.key} className={leads?styles.leading:""}>
       <div className={styles.result}><strong>{value!==null?coachingValue(value,column.metric,column.unit,group.source):"—"}</strong>{leads&&<span className={styles.best}>Group Best</span>}</div>
       {bar&&<span className={styles.bar} aria-hidden="true"><i style={{width:`${100*value!/range.max}%`}}/></span>}
       {value===null?<span className={styles.cellNote}>{!cell?.eligible?"Not applicable":cell?.review?"Needs review":"Not recorded"}</span>:<>{cell.sample&&<span className={styles.cellSample}>{cell.sample}</span>}{(showDetails||cell.context.startsWith("Latest session"))&&cell.context&&<span className={styles.cellNote}>{cell.context}</span>}</>}
      </td>;
     })}
    </tr>;
   })}</tbody>
  </table>
 </div>;
}

export function GroupComparison({data,today}:{data:CoachingData;today:string}) {
 const [selectedIds,setSelectedIds]=useState<string[]>(()=>groupPresets(data.players).find(group=>group.id==="hitters")?.playerIds ?? data.players.map(player=>player.id));
 const [category,setCategory]=useState<CoachingCategory|"Game Stats">("Game Stats");
 const [gameSource,setGameSource]=useState<"qpa"|"pitching">("qpa");
 const [maxGap,setMaxGap]=useState(30);
 const [groupId,setGroupId]=useState("");
 const [columnSelections,setColumnSelections]=useState<Record<string,string[]>>({});
 const [showDetails,setShowDetails]=useState(false);
 const availableSources=(["qpa","pitching"] as const).filter(source=>data.players.some(player=>selectedIds.includes(player.id)&&playerGameSources(player).includes(source==="qpa"?"qpa_fall_2026":"pitching_fall_2026")));
 const effectiveSource=availableSources.includes(gameSource)?gameSource:availableSources[0]??gameSource;
 const model=useMemo(()=>buildGroupComparison(data,selectedIds,category,today,maxGap,effectiveSource),[data,selectedIds,category,today,maxGap,effectiveSource]);
 const group=model.groups.find(item=>item.id===groupId)??model.groups[0];
 const visibleColumns=visibleGroupColumns(group,group?columnSelections[group.id]:undefined);
 const withResults=group?.rows.filter(row=>Object.values(row.cells).some(cell=>cell.value!==null)).length??0;
 function choosePlayers(ids:string[]){
  setSelectedIds(ids);
  const players=data.players.filter(player=>ids.includes(player.id));
  if(players.length&&players.every(player=>playerGameSources(player).includes("pitching_fall_2026")))setGameSource("pitching");
  else if(players.length&&players.every(player=>playerGameSources(player).includes("qpa_fall_2026")))setGameSource("qpa");
 }
 function toggleColumn(key:string){if(!group)return;setColumnSelections(current=>({...current,[group.id]:visibleColumns.includes(key)?visibleColumns.length>1?visibleColumns.filter(value=>value!==key):visibleColumns:[...visibleColumns,key]}));}
 return <div className={styles.groupView}>
  <section className={styles.selectionPanel} aria-label="Comparison roster">
   <div className={styles.selectionHeading}><div><span className={styles.eyebrow}>BUILD YOUR GROUP</span><h2>Compare the Options</h2><p>Select a position group or mix players from across the roster.</p></div><GroupPlayerPicker players={data.players} selectedIds={selectedIds} onChange={choosePlayers}/></div>
   <div className={styles.selectionFooter}><span className={styles.selectionCount}><Users size={15}/><strong>{model.players.length}</strong> players selected</span><details className={styles.selectedPlayers}><summary>Review Selection</summary><div className={styles.chips}>{model.players.map(player=><button type="button" key={player.id} onClick={()=>setSelectedIds(ids=>ids.filter(id=>id!==player.id))} aria-label={`Remove ${player.name} from comparison`}>{player.name}<X size={12}/></button>)}{!model.players.length&&<span>No players selected.</span>}</div></details></div>
  </section>
  <CoachingTabs games value={category} onChange={value=>{setCategory(value as CoachingCategory|"Game Stats");setGroupId("");}}/>
  {model.players.length>=2?<>
   <div className={styles.controls}>
    {category==="Game Stats"?<label className={styles.field}>Game Stats<select aria-label="Group game stats source" value={effectiveSource} onChange={event=>{setGameSource(event.target.value as "qpa"|"pitching");setGroupId("");}}>{availableSources.map(source=><option key={source} value={source}>{source==="qpa"?"Hitting":"Pitching"} · Fall to Date</option>)}</select></label>:<label className={styles.field}>Test Date Window<select value={maxGap} onChange={event=>setMaxGap(Number(event.target.value))}>{[7,14,30,60].map(days=><option key={days} value={days}>{days} days</option>)}</select></label>}
    {model.groups.length>1&&<label className={`${styles.field} ${styles.sourceField}`}>Results<select aria-label="Group comparison results" value={group?.id??""} onChange={event=>setGroupId(event.target.value)}>{model.groups.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>}
    {group&&<details className={styles.metricMenu}><summary><SlidersHorizontal size={14}/>Stats <span>{visibleColumns.length}</span></summary><div className={styles.metricChoices}>{group.columns.map(column=><label key={column.key}><input type="checkbox" checked={visibleColumns.includes(column.key)} disabled={visibleColumns.length===1&&visibleColumns.includes(column.key)} onChange={()=>toggleColumn(column.key)}/>{column.label}</label>)}</div></details>}
    <label className={styles.detailToggle}><input type="checkbox" checked={showDetails} onChange={event=>setShowDetails(event.target.checked)}/>Show Dates & Details</label>
   </div>
   {group?<section className={styles.board} aria-label="Group results">
    <header className={styles.boardHeading}><div><span className={styles.eyebrow}>{category.toUpperCase()}</span><h2>{group.label}</h2></div><span className={styles.coverage}>{withResults} of {model.players.length} with results</span></header>
    <p className={styles.tableHelp}>Select a stat heading to sort. <span>Highlighted values lead this group; samples stay visible.</span></p>
    <GroupTable key={group.id} group={group} data={data} selectedColumns={visibleColumns} showDetails={showDetails}/>
    <footer className={styles.boardFoot}>Only matching results receive a Group Best highlight. Body measurements, spin, angles, and counting stats are descriptive. {category==="Game Stats"?"Rates reflect the opportunities shown; no minimum sample is required.":"Practice and in-game results stay separate. Open dates and details to check the testing window."}</footer>
   </section>:<div className={styles.empty}><Users size={28}/><h3>No Matching Results Yet</h3><p>{category==="Game Stats"?`This group has no recorded ${effectiveSource==="qpa"?"hitting":"pitching"} game stats. Choose another category or adjust the players.`:"Choose another category or add players with recorded results."}</p></div>}
  </>:<div className={styles.empty}><Users size={28}/><h3>Choose at Least Two Players</h3><p>Use a position group to get started, then add or remove individual players.</p></div>}
 </div>;
}
