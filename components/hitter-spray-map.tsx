import type { SavedContact } from "@/lib/full-swing-contacts-server";

/** Positive source Direction points toward first base, confirmed by the owner. */
export function HitterSprayMap({ contacts }: { contacts: readonly SavedContact[] }) {
  const rows=contacts.filter(row=>row.direction!==null&&row.distance!==null);
  if(!rows.length)return <p className="rounded-xl border border-dashed border-[var(--line-subtle)] p-4 text-sm text-[var(--text-secondary)]">No reviewed direction-and-distance pairs are saved for this selection yet.</p>;
  const radius=Math.max(400,Math.ceil(Math.max(...rows.map(row=>row.distance!))/100)*100);
  const scale=270/radius, originX=350,originY=330;
  const coords=(degrees:number,feet:number)=>({x:originX+Math.sin(degrees*Math.PI/180)*feet*scale,y:originY-Math.cos(degrees*Math.PI/180)*feet*scale});
  const arc=(feet:number)=>{
    const parts=Array.from({length:49},(_,i)=>coords(-60+i*2.5,feet));
    return `M ${parts.map(point=>`${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" L ")}`;
  };
  return <div className="mt-4 overflow-x-auto"><svg viewBox="0 0 700 375" role="img" aria-label={`Spray plot of ${rows.length} balls using their recorded direction and distance; positive direction faces first base`} className="min-w-[530px] w-full rounded-xl bg-[var(--surface-raised)]">
    <path d={`M ${coords(-45,radius).x} ${coords(-45,radius).y} L ${originX} ${originY} L ${coords(45,radius).x} ${coords(45,radius).y}`} fill="none" stroke="var(--text-secondary)" strokeWidth="1.5"/>
    {[100,200,300,400].filter(feet=>feet<=radius).map(feet=><g key={feet}><path d={arc(feet)} fill="none" stroke="var(--line-subtle)" strokeDasharray="4 5"/><text x={originX+5} y={coords(0,feet).y-4} fill="var(--text-secondary)" fontSize="11">{feet} ft</text></g>)}
    <path d={`M ${originX} ${originY-74*scale} L ${originX+63*scale} ${originY-63*scale} L ${originX} ${originY-52*scale} L ${originX-63*scale} ${originY-63*scale} Z`} fill="none" stroke="var(--line-subtle)" strokeWidth="1.2"/>
    <circle cx={originX} cy={originY} r="4" fill="var(--text-primary)"/>
    {rows.map(row=>{const point=coords(row.direction!,row.distance!);return <circle key={`${row.fileHash}:${row.sourceRow}`} cx={point.x} cy={point.y} r="5.5" fill="var(--accent-readable)" fillOpacity=".85" stroke="var(--surface-panel)" strokeWidth="1.5"><title>{`${row.playedOn} · Pitch ${row.pitchNumber} · ${row.distance!.toFixed(1)} ft · ${row.direction!.toFixed(1)}°`}</title></circle>;})}
    <text x="350" y="362" textAnchor="middle" fill="var(--text-secondary)" fontSize="12">Home plate · direction 0° points to center</text>
    <text x="70" y="310" fill="var(--text-secondary)" fontSize="12">Third-base side (−)</text><text x="505" y="310" fill="var(--text-secondary)" fontSize="12">First-base side (+)</text>
  </svg><p className="muted mb-0 mt-2 text-xs">Field lines are a visual reference, not a measured ballpark boundary. Points use the CSV’s Direction and Distance on the same row; they do not indicate hit outcomes or where the ball landed.</p></div>;
}
