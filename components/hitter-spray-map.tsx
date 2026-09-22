import type { SavedContact } from "@/lib/full-swing-contacts-server";
import { INFIELD_DISTANCE_FEET, MIDDLE_DIRECTION_DEGREES, spraySummary } from "@/lib/spray-zones";

/** Positive source Direction points toward first base, confirmed by the owner. */
export function HitterSprayMap({ contacts, bats }: { contacts: readonly SavedContact[]; bats?: string | null }) {
  const rows=contacts.filter(row=>row.direction!==null&&row.distance!==null);
  if(!rows.length)return <p className="rounded-xl border border-dashed border-[var(--line-subtle)] p-4 text-sm text-[var(--text-secondary)]">No batted balls with both direction and distance have been added here yet.</p>;
  const summary=spraySummary(contacts,bats);
  const radius=Math.max(400,Math.ceil(Math.max(...rows.map(row=>row.distance!))/100)*100);
  const scale=270/radius, originX=350,originY=330;
  const coords=(degrees:number,feet:number)=>({x:originX+Math.sin(degrees*Math.PI/180)*feet*scale,y:originY-Math.cos(degrees*Math.PI/180)*feet*scale});
  const arc=(feet:number)=>{
    const parts=Array.from({length:49},(_,i)=>coords(-60+i*2.5,feet));
    return `M ${parts.map(point=>`${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" L ")}`;
  };
  return <div className="mt-4"><div className="overflow-x-auto"><svg viewBox="0 0 700 375" role="img" aria-label={`Spray plot of ${rows.length} balls using their recorded direction and distance; positive direction faces first base`} className="min-w-[530px] w-full rounded-xl bg-[var(--surface-raised)]">
    <path d={`M ${coords(-45,radius).x} ${coords(-45,radius).y} L ${originX} ${originY} L ${coords(45,radius).x} ${coords(45,radius).y}`} fill="none" stroke="var(--text-secondary)" strokeWidth="1.5"/>
    {[100,200,300,400].filter(feet=>feet<=radius).map(feet=><g key={feet}><path d={arc(feet)} fill="none" stroke="var(--line-subtle)" strokeDasharray="4 5"/><text x={originX+5} y={coords(0,feet).y-4} fill="var(--text-secondary)" fontSize="11">{feet} ft</text></g>)}
    <path d={arc(INFIELD_DISTANCE_FEET)} fill="none" stroke="var(--accent-readable)" strokeWidth="1.5" strokeDasharray="5 5"/>
    {[-MIDDLE_DIRECTION_DEGREES,MIDDLE_DIRECTION_DEGREES].map(degrees=><path key={degrees} d={`M ${originX} ${originY} L ${coords(degrees,radius).x} ${coords(degrees,radius).y}`} fill="none" stroke="var(--line-subtle)" strokeDasharray="3 5"/>)}
    <path d={`M ${originX} ${originY-74*scale} L ${originX+63*scale} ${originY-63*scale} L ${originX} ${originY-52*scale} L ${originX-63*scale} ${originY-63*scale} Z`} fill="none" stroke="var(--line-subtle)" strokeWidth="1.2"/>
    <circle cx={originX} cy={originY} r="4" fill="var(--text-primary)"/>
    {rows.map(row=>{const point=coords(row.direction!,row.distance!);return <circle key={`${row.fileHash}:${row.sourceRow}`} cx={point.x} cy={point.y} r="5.5" fill="var(--accent-readable)" fillOpacity=".85" stroke="var(--surface-panel)" strokeWidth="1.5"><title>{`${row.playedOn} · Pitch ${row.pitchNumber} · ${row.distance!.toFixed(1)} ft · ${row.direction!.toFixed(1)}°`}</title></circle>;})}
    <text x="350" y="362" textAnchor="middle" fill="var(--text-secondary)" fontSize="12">Home plate · direction 0° points to center</text>
    <text x="70" y="310" fill="var(--text-secondary)" fontSize="12">Third-base side (−)</text><text x="505" y="310" fill="var(--text-secondary)" fontSize="12">First-base side (+)</text>
  </svg></div>
  <div className="mt-3 grid gap-3 sm:grid-cols-2" aria-label="Spray distribution">
    {summary.fields.map(group=><div key={group.field} className="rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-raised)] p-3">
      <div className="flex items-baseline justify-between gap-2"><h3 className="m-0 text-sm font-bold">{group.field === "infield" ? "Infield" : "Outfield"}</h3><span className="text-sm font-bold tabular-nums">{group.percentOfTotal.toFixed(1)}%</span></div>
      <p className="muted mb-2 mt-1 text-xs">{group.count} of {summary.count} plotted balls · {group.field === "infield" ? `under ${INFIELD_DISTANCE_FEET} ft` : `${INFIELD_DISTANCE_FEET}+ ft`}</p>
      {group.count ? <div className="space-y-2">{group.zones.map((zone,index)=><div key={zone.label}>
        <div className="flex justify-between gap-2 text-xs"><span>{zone.label}</span><span className="tabular-nums">{group.count ? `${zone.percentWithinField.toFixed(1)}%` : "—"} · {zone.count}/{group.count}</span></div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--line-subtle)]"><div className={["h-full rounded-full bg-[#b34454]","h-full rounded-full bg-[#b7903d]","h-full rounded-full bg-[#4479a7]"][index]} style={{width:`${zone.percentWithinField}%`}} /></div>
      </div>)}</div> : <p className="muted mb-0 text-xs">No plotted balls in this distance group.</p>}
    </div>)}
  </div>
  <p className="muted mb-0 mt-2 text-xs">Infield and outfield are divided at {INFIELD_DISTANCE_FEET} ft. Pull, middle, and opposite use ball direction beyond ±{MIDDLE_DIRECTION_DEGREES}° and the player’s batting side. {summary.battingSide ? "" : "Batting side is not confirmed, so this chart shows field sides instead. "}{summary.missing ? `${summary.missing} batted ${summary.missing===1?"ball has":"balls have"} no paired Direction and Distance and ${summary.missing===1?"is":"are"} excluded from these percentages. ` : ""}These are recorded ball flights, not confirmed hits or exact landing spots.</p>
  <p className="muted mb-0 mt-1 text-xs">Field lines are a visual reference, not a measured ballpark boundary. Points use Direction and Distance from the same CSV row.</p></div>;
}
