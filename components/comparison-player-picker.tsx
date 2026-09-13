"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import type { CoachingPlayer } from "@/lib/coaching-tools";
import styles from "./coaching-tools.module.css";
export function filterComparisonPlayers(players:readonly CoachingPlayer[],query:string){
 const normalize=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
 const terms=normalize(query).trim().split(/\s+/).filter(Boolean);
 return players.filter(p=>terms.every(term=>normalize(`${p.name} ${p.code}`).includes(term)));
}
export function ComparisonPlayerPicker({players,value,onChange,label}:{players:readonly CoachingPlayer[];value:string;onChange:(id:string)=>void;label:string}){
 const id=useId(),trigger=useRef<HTMLButtonElement>(null),search=useRef<HTMLInputElement>(null);
 const [open,setOpen]=useState(false),[query,setQuery]=useState(""),[active,setActive]=useState(-1);
 const selected=players.find(p=>p.id===value),matches=filterComparisonPlayers(players,query);
 useEffect(()=>{if(open)search.current?.focus();},[open]);
 useEffect(()=>{if(open&&active>=0)document.getElementById(`${id}-option-${active}`)?.scrollIntoView({block:"nearest"});},[open,active,id]);
 function close(){setOpen(false);trigger.current?.focus();}
 function choose(player:CoachingPlayer){onChange(player.id);close();}
 return <div className={styles.picker} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOpen(false);}} onKeyDown={e=>{if(e.key==="Escape"&&open){e.preventDefault();close();}}}>
  <span id={`${id}-label`} className={styles.pickerLabel}>{label}</span>
  <button ref={trigger} type="button" className={styles.pickerTrigger} aria-labelledby={`${id}-label ${id}-selected`} aria-haspopup="dialog" aria-expanded={open} aria-controls={open?`${id}-dialog`:undefined} onClick={()=>{setQuery("");setActive(-1);setOpen(!open);}}><span id={`${id}-selected`}>{selected?.name??"Choose a player"}</span><ChevronDown size={16} aria-hidden="true"/></button>
  {open&&<div id={`${id}-dialog`} role="dialog" aria-label={`Choose ${label}`} className={styles.pickerMenu}>
   <div className={styles.pickerSearch}><Search size={15} aria-hidden="true"/><input ref={search} aria-label={`Search ${label}`} role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls={`${id}-list`} aria-activedescendant={active>=0&&matches[active]?`${id}-option-${active}`:undefined} value={query} autoComplete="off" spellCheck={false} placeholder="Search name or PAC ID" onChange={e=>{setQuery(e.target.value);setActive(-1);}} onKeyDown={e=>{
    if(e.nativeEvent.isComposing)return;
    if((e.key==="ArrowDown"||e.key==="ArrowUp")&&matches.length){e.preventDefault();setActive(n=>e.key==="ArrowDown"?(n+1)%matches.length:(n<=0?matches.length:n)-1);}
    if(e.key==="Enter"&&active>=0&&matches[active]){e.preventDefault();choose(matches[active]);}
   }}/></div>
   <p className={styles.pickerCount} role="status">{query?`${matches.length} of ${players.length} players`:`Full roster · ${players.length} players`}</p>
   <div role="listbox" id={`${id}-list`} aria-label={`${label} roster`} className={styles.pickerList}>{matches.map((p,i)=><button type="button" role="option" id={`${id}-option-${i}`} tabIndex={-1} aria-selected={p.id===value} data-active={i===active} key={p.id} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(p)}><span><strong>{p.name}</strong><small>{[p.code,p.position].filter(Boolean).join(" · ")}</small></span>{p.id===value&&<Check size={16} aria-hidden="true"/>}</button>)}</div>
   {!matches.length&&<p className={styles.pickerEmpty}>No matches. Try a first name, last name, or PAC ID.</p>}
  </div>}
 </div>;
}
