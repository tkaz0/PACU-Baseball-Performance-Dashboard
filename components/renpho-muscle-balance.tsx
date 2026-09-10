import { TriangleAlert } from "lucide-react";
import type { RenphoChartReport } from "@/lib/renpho-charts";
import { getRenphoMuscleBalance } from "@/lib/renpho-muscle-balance";
import { MUSCLE_BALANCE_REVIEW_PERCENT } from "@/lib/renpho-segments";

export function RenphoMuscleBalance({ report }: { report?: RenphoChartReport }) {
  if (!report) return null;
  const balance = getRenphoMuscleBalance(report);
  const hasReadings = balance.trunk || balance.pairs.some(pair => pair.left || pair.right);
  return <section aria-label="Muscle Balance" className="rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-panel)] p-5 sm:p-6" data-testid="muscle-balance">
    <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="m-0 text-lg font-bold">Muscle Balance</h2><p className="m-0 text-xs text-[var(--text-secondary)]">Last Tested: <time dateTime={balance.date}>{new Date(`${balance.date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}</time></p></div>
    {!hasReadings ? <p className="mb-0 text-sm text-[var(--text-secondary)]">Muscle-balance readings haven’t been added for this report yet.</p> : <>
      <div className="mt-5 grid gap-6 md:grid-cols-2">{balance.pairs.map(pair => {
        const maximum = Math.max(pair.left?.value ?? 0, pair.right?.value ?? 0, 1);
        return <div key={pair.part} data-testid={`muscle-balance-${pair.part}`}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="m-0 text-sm font-bold">{pair.part === "arm" ? "Arms" : "Legs"}</h3><span className="text-xs tabular-nums text-[var(--text-secondary)]">{pair.difference === null ? "Comparison Unavailable" : `${pair.difference.toFixed(1)}% Difference`}</span></div>
          <div className="space-y-3">{(["left", "right"] as const).map(side => {
            const reading = pair[side];
            return <div key={side}><div className="mb-1 flex justify-between gap-2 text-xs"><span>{side === "left" ? "Left" : "Right"}</span><strong className="tabular-nums">{reading ? `${reading.value} ${reading.unit}` : "Not Available"}</strong></div><div className="h-2 overflow-hidden rounded-full bg-[var(--line-subtle)]" aria-hidden="true">{reading && pair.difference !== null && <div className={`h-full rounded-full ${side === "left" ? "bg-[#477ec1]" : "bg-[#cf4b55]"}`} style={{ width: `${reading.value / maximum * 100}%` }} />}</div></div>;
          })}</div>
          {pair.review && <p className="mb-0 mt-3 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs leading-5"><TriangleAlert size={15} className="mt-0.5 shrink-0 text-amber-500" aria-hidden="true" /><span><strong>Review Difference</strong> · {Math.abs(pair.left!.value - pair.right!.value).toFixed(1)} {pair.left!.unit} gap. Confirm the readings and repeat under consistent testing conditions.</span></p>}
        </div>;
      })}</div>
      {balance.trunk && <p className="mb-0 mt-5 border-t border-[var(--line-subtle)] pt-4 text-sm">Trunk Muscle Mass <strong className="ml-2 tabular-nums">{balance.trunk.value} {balance.trunk.unit}</strong></p>}
      <details className="mt-4 text-xs leading-5 text-[var(--text-secondary)]"><summary className="cursor-pointer">About This Comparison</summary><p>Left and right are the player’s sides. Each pair uses the same zero-based scale and the same report and unit. Difference = (larger − smaller) ÷ larger × 100. Missing or conflicting readings are not compared.</p><p className="mb-0">The {MUSCLE_BALANCE_REVIEW_PERCENT}% review setting is a team dashboard flag, not a medical cutoff. RENPHO estimates muscle mass, not strength or injury risk. Hydration and recent exercise can affect readings. Blue and red identify sides, not good or bad results.</p></details>
    </>}
  </section>;
}
