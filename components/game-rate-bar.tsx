import { gameRateWidth } from "@/lib/profile-trends";
/** A recorded rate, separate from the blue/red team percentile scale. */
export function GameRateBar({ value, unit, label }: { value: number | null; unit: string; label: string }) {
  const width = gameRateWidth(value, unit);
  if (width === null) return null;
  return <div className="my-3" role="img" aria-label={`${label}: ${unit === "avg" ? value!.toFixed(3) : `${value!.toFixed(1)}%`}, on a ${unit === "avg" ? "0 to 1.000" : "0 to 100%"} scale. Recorded rate, not a percentile.`}>
    <div className="relative h-2 overflow-hidden rounded-full bg-[var(--line-subtle)]"><span className="absolute inset-y-0 left-0 rounded-full bg-[#c84959]" style={{ width: `${width}%` }}/><span className="absolute inset-y-0 left-1/2 w-px bg-[var(--surface-panel)]"/></div>
    <div aria-hidden="true" className="mt-1 flex justify-between text-[9px] text-[var(--text-secondary)]"><span>0</span><span>Recorded rate</span><span>{unit === "avg" ? "1.000" : "100%"}</span></div>
  </div>;
}
