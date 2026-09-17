"use client";
import { useEffect, useState } from "react";
import { DEFAULT_PITCH_GUIDELINES, validPitchGuidelines, type PitchGuidelines, PITCH_TYPES, assignPitchRows, summarizeAssignedPitches, suggestPitchTypes, validatePitchAssignments, type PitchAssignment, type PitchAssignmentSnapshot, type PitchType } from "@/lib/imports/pitch-assignments";
import type { FullSwingSession, PitchRange } from "@/lib/imports/full-swing-session";
export type PitchAssignmentStore = {
  load: (hash: string) => Promise<PitchAssignmentSnapshot>;
  save: (hash: string, version: number, assignments: PitchAssignment[]) => Promise<PitchAssignmentSnapshot>;
};
function TypeSelect({ value, label, onChange }: { value: string; label: string; onChange: (value: PitchType | "") => void }) {
  return <select aria-label={label} className="min-w-40 text-sm" value={value} onChange={event=>onChange(event.target.value as PitchType|"")}>
    {value==="mixed" && <option value="mixed" disabled>Mixed types</option>}
    <option value="">Unassigned</option>{PITCH_TYPES.map(type=><option key={type} value={type}>{type}</option>)}
  </select>;
}
export function PitchAssignmentReview({ session, ranges, fileHash, store, search, spinUnit, rpmConfirmed, includedIdentities }: { session: FullSwingSession; includedIdentities?: string[]; ranges: PitchRange[]; fileHash?: string; store?: PitchAssignmentStore; search: string; spinUnit: string; rpmConfirmed: boolean }) {
  const [assignments,setAssignments]=useState<PitchAssignment[]>([]), [saved,setSaved]=useState<PitchAssignment[]>([]);
  const [version,setVersion]=useState(0), [loading,setLoading]=useState(Boolean(store && fileHash)), [ready,setReady]=useState(!store || !fileHash), [saving,setSaving]=useState(false), [error,setError]=useState(""), [message,setMessage]=useState(""), [retry,setRetry]=useState(0);
  useEffect(()=>{
    if(!store || !fileHash)return;
    let active=true;
    store.load(fileHash).then(snapshot=>{
      const valid=validatePitchAssignments(snapshot.assignments);
      if(valid.some(a=>!session.pitches.some(p=>p.sourceRow===a.sourceRow)))throw new Error("Saved labels do not match this file. Keep the original export for review.");
      if(active){setAssignments(valid);setSaved(valid);setVersion(snapshot.version);setReady(true);setError("");setLoading(false);}
    }).catch(error=>{if(active){setError(error instanceof Error?error.message:"Pitch labels could not be loaded.");setLoading(false);}});
    return ()=>{active=false;};
  },[fileHash,store,session,retry]);
  const [guidelines,setGuidelines]=useState<Record<string,PitchGuidelines>>({});
  const eligiblePitches=session.pitches.filter(p=>includedIdentities === undefined || includedIdentities.includes(p.identity));
  const pitchers=[...new Set(eligiblePitches.map(p=>p.identity))];
  const [requestedPitcher,setSelectedPitcher]=useState(pitchers[0]??"");
  const selectedPitcher=pitchers.includes(requestedPitcher)?requestedPitcher:pitchers[0]??"";
  const guide=guidelines[selectedPitcher]??DEFAULT_PITCH_GUIDELINES;
  const guideInput=(key:keyof PitchGuidelines,label:string)=><label className="text-xs">{label}<input type="number" step="any" min="0" value={Number.isNaN(guide[key])?"":guide[key]} onChange={e=>setGuidelines(current=>({...current,[selectedPitcher]:{...(current[selectedPitcher]??DEFAULT_PITCH_GUIDELINES),[key]:e.target.value===""?NaN:Number(e.target.value)}}))}/></label>;
  const types=new Map(assignments.map(a=>[a.sourceRow,a.pitchType]));
  const suggestions=rpmConfirmed?suggestPitchTypes(eligiblePitches,guidelines):[], suggested=new Map(suggestions.map(s=>[s.sourceRow,s]));
  const newSuggestions=suggestions.filter(s=>!types.has(s.sourceRow));
  const dirty=JSON.stringify(assignments)!==JSON.stringify(saved);
  const edit=(rows:number[],type:PitchType|"")=>{setAssignments(current=>assignPitchRows(current,rows,type));setMessage("");};
  async function save(){
    if(!store || !fileHash || !ready || saving)return;
    setSaving(true);setError("");setMessage("");
    try {const snapshot=await store.save(fileHash,version,assignments);setVersion(snapshot.version);setSaved(snapshot.assignments);setAssignments(snapshot.assignments);setMessage("Pitch assignments saved for the coaching staff.");}
    catch(error){setError(error instanceof Error?error.message:"The save could not be confirmed. Retry with these same labels.");}
    finally{setSaving(false);}
  }
  const visible=eligiblePitches.filter(p=>p.identity.toLowerCase().includes(search.trim().toLowerCase()));
  const summaries=summarizeAssignedPitches(visible,assignments);
  const assignedCount=eligiblePitches.filter(p=>types.has(p.sourceRow)).length;
  if (!eligiblePitches.length) return null;
  return <section className="mt-5 space-y-4 border-t border-[var(--line-subtle)] pt-5" aria-label="Assign pitch types">
    <div><h4 className="m-0 font-bold">Assign Pitch Types</h4><p className="muted mb-0 mt-1 text-sm">Choose a type for a range group, then adjust individual pitches if needed. Suggested types use your team’s speed and spin ranges; confirm them before saving.</p></div>
    {loading && <p role="status">Loading saved pitch labels…</p>}
    {error && <p role="alert" className="notice notice-error">{error}</p>}
    {!ready && !loading && <button type="button" className="btn btn-secondary" onClick={()=>{setLoading(true);setRetry(n=>n+1);}}>Reload Pitch Labels</button>}
    <fieldset disabled={!ready || loading || saving} className="min-w-0 space-y-4">
      <details className="rounded-lg border border-[var(--line-subtle)] p-4"><summary className="cursor-pointer font-semibold">Pitcher-Specific Guidelines</summary><p className="muted text-sm">Starting ranges for this review. Adjust each pitcher independently; saved pitch assignments stay unchanged.</p><label className="block max-w-md">Pitcher guidelines<select value={selectedPitcher} onChange={e=>setSelectedPitcher(e.target.value)}>{pitchers.map(name=><option key={name} value={name}>{name}</option>)}</select></label><div className="mt-4 grid gap-4 lg:grid-cols-3"><div className="space-y-2"><h5 className="font-bold">Fastball</h5>{guideInput("fastMin","Fastball minimum mph")}{guideInput("fastMax","Fastball maximum mph")}{guideInput("fastSpinMin","Fastball minimum RPM")}{guideInput("fastSpinMax","Fastball maximum RPM")}</div><div className="space-y-2"><h5 className="font-bold">Breaking Ball</h5>{guideInput("breakingMin","Breaking ball minimum mph")}{guideInput("breakingMax","Breaking ball maximum mph")}{guideInput("breakingSpinAbove","Breaking ball spin above RPM")}</div><div className="space-y-2"><h5 className="font-bold">Changeup</h5>{guideInput("changeMin","Changeup minimum mph")}{guideInput("changeMax","Changeup maximum mph")}{guideInput("changeSpinBelow","Changeup spin below RPM")}</div></div>{!validPitchGuidelines(guide)&&<p role="alert" className="notice notice-error">Enter valid ranges with the minimum no greater than the maximum. Suggestions for this pitcher are paused.</p>}<button type="button" className="btn btn-secondary mt-4" onClick={()=>setGuidelines(current=>({...current,[selectedPitcher]:{...DEFAULT_PITCH_GUIDELINES}}))}>Reset This Pitcher’s Guidelines</button><p className="muted mb-0 mt-3 text-xs">Missing measurements or multiple matching pitch types remain unknown. Guidelines reset when reopening a CSV; saved assignments are shared with staff.</p></details>
      {!rpmConfirmed && <p className="notice text-sm">Confirm RPM above to enable speed-and-spin suggestions. Manual assignments are available now.</p>}
      <div className="rounded-lg border border-[var(--line-subtle)] p-4"><p className="m-0 text-sm"><strong>{newSuggestions.length} suggested labels</strong> awaiting review. Unclear pitches stay unassigned.</p><button type="button" className="btn btn-secondary mt-3" disabled={!newSuggestions.length} onClick={()=>{setAssignments(current=>validatePitchAssignments([...current,...newSuggestions.map(s=>({sourceRow:s.sourceRow,pitchType:s.pitchType}))]));setMessage("");}}>Apply Suggestions to Unassigned Pitches</button><details className="mt-3 text-xs"><summary className="cursor-pointer font-semibold">Starting Pitch Rules</summary><p>Fastball: 75–85 mph and 1,900–2,200 RPM. Breaking ball: 65–70 mph and above 2,200 RPM. Changeup: 68–72 mph and below 1,900 RPM.</p><p>Pitcher-specific changes above override these starting ranges. These are heuristics for staff review, not verified pitch types. Missing spin, overlapping or unsupported patterns stay unknown. “Breaking Ball” does not distinguish a slider from a curveball. Applying suggestions preserves all existing assignments.</p></details></div>
      <p className="muted text-sm">{assignedCount} of {eligiblePitches.length} pitches assigned · {eligiblePitches.length-assignedCount} unassigned</p>
      <div className="table-wrap max-h-80 overflow-auto"><table><caption className="sr-only">Assign pitch types to range groups</caption><thead><tr><th>Pitcher</th><th>Velocity (mph)</th><th>Spin ({spinUnit})</th><th>Pitches</th><th>Assign Entire Group</th></tr></thead><tbody>{ranges.map(range=>{
        const groupPitches=session.pitches.filter(p=>range.sourceRows.includes(p.sourceRow));
        const speedValues=groupPitches.flatMap(p=>p.velocity===null?[]:[p.velocity]), spinValues=groupPitches.flatMap(p=>p.spin===null?[]:[p.spin]);
        const span=(values:number[])=>values.length?`${Math.min(...values).toFixed(1)}–${Math.max(...values).toFixed(1)}`:"Unknown";
        const values=new Set(range.sourceRows.map(row=>types.get(row)??"")),value=values.size===1?[...values][0]:"mixed";
        return <tr key={JSON.stringify([range.identity,range.velocityStart,range.spinStart])}><th scope="row">{range.identity}</th><td>{span(speedValues)}</td><td>{span(spinValues)}</td><td>{range.count}</td><td><TypeSelect value={value} label={`Assign group for ${range.identity}, CSV rows ${range.sourceRows.join(", ")}`} onChange={type=>edit(range.sourceRows,type)}/></td></tr>;
      })}</tbody></table></div>
      <details><summary className="cursor-pointer font-semibold">Individual Pitches · {visible.length}</summary><div className="table-wrap mt-3 max-h-96 overflow-auto"><table><caption className="sr-only">Individual pitch assignments</caption><thead><tr><th>Pitcher</th><th>Pitch #</th><th>CSV Row</th><th>Velocity (mph)</th><th>Spin ({spinUnit})</th><th>Pitch Type</th><th>Suggestion</th></tr></thead><tbody>{visible.map(p=><tr key={p.sourceRow}><th scope="row">{p.identity}</th><td>{p.pitchNumber}</td><td>{p.sourceRow}</td><td>{p.velocity?.toFixed(1)??"—"}</td><td>{p.spin?.toFixed(1)??"—"}</td><td><TypeSelect value={types.get(p.sourceRow)??""} label={`Pitch ${p.pitchNumber} type`} onChange={type=>edit([p.sourceRow],type)}/></td><td><span className="font-semibold">{suggested.get(p.sourceRow)?.pitchType??"Unknown"}</span><span className="muted block max-w-64 text-xs">{suggested.get(p.sourceRow)?.reason??"Needs staff review"}</span></td></tr>)}</tbody></table></div></details>
      {assignedCount > 0 && <details open><summary className="cursor-pointer font-semibold">Pitch-Type Summary</summary><div className="table-wrap mt-3"><table><caption className="sr-only">Reviewed pitch-type summaries</caption><thead><tr><th>Pitcher</th><th>Type</th><th>Pitches</th><th>Average Velocity (mph)</th><th>Average Spin ({spinUnit})</th></tr></thead><tbody>{summaries.map(s=><tr key={JSON.stringify([s.identity,s.pitchType])}><th scope="row">{s.identity}</th><td>{s.pitchType}</td><td>{s.count}</td><td>{s.averageVelocity?.toFixed(1)??"—"}</td><td>{s.averageSpin?.toFixed(1)??"—"}<span className="muted block text-xs">n={s.spinCount}</span></td></tr>)}</tbody></table></div></details>}
      {store && fileHash ? <div className="flex flex-wrap items-center gap-3"><button type="button" className="btn btn-primary" disabled={!dirty} onClick={()=>void save()}>{saving?"Saving…":"Save Pitch Assignments"}</button><span className="muted text-xs">Labels are saved separately from player measurements. Reopen this exact CSV to reuse them.</span></div>:<p className="muted text-xs">Preview only. Labels remain in this open review.</p>}
    </fieldset>
    {message && <p role="status" className="notice">{message}</p>}
  </section>;
}
