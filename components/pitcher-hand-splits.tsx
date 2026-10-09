import { battedBallType } from "@/lib/batted-ball-profile";
import type { SavedContact } from "@/lib/full-swing-contacts-server";

/** Splits use the linked roster pitcher's throwing hand; contacts without a linked pitcher are counted, not guessed. */
export function pitcherHandSplits(contacts: readonly SavedContact[]) {
  const side = (hand: "R" | "L") => {
    const rows = contacts.filter(row => row.pitcherThrows === hand);
    const speeds = rows.map(row => row.exitVelocity);
    return {
      hand, count: rows.length,
      avgEv: rows.length ? speeds.reduce((a, b) => a + b, 0) / rows.length : null,
      maxEv: rows.length ? Math.max(...speeds) : null,
      avgLa: rows.length ? rows.reduce((a, row) => a + row.launchAngle, 0) / rows.length : null,
      hardHitPct: rows.length ? 100 * rows.filter(row => row.exitVelocity >= 90).length / rows.length : null,
      lineDrivePct: rows.length ? 100 * rows.filter(row => battedBallType(row.launchAngle) === "line").length / rows.length : null,
    };
  };
  return { sides: [side("R"), side("L")], unknown: contacts.filter(row => row.pitcherThrows !== "R" && row.pitcherThrows !== "L").length };
}

const one = (value: number | null, suffix = "") => value === null ? "—" : `${value.toFixed(1)}${suffix}`;

export function PitcherHandSplits({ contacts }: { contacts: readonly SavedContact[] }) {
  const splits = pitcherHandSplits(contacts);
  if (!splits.sides.some(side => side.count > 0)) return null;
  return <section className="mt-4 rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-raised)] p-4" aria-label="Splits by pitcher hand" data-testid="pitcher-hand-splits">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h3 className="m-0 text-base font-bold">vs RHP / LHP</h3>
      <span className="text-xs text-[var(--text-secondary)]">Pitcher hand from the roster{splits.unknown ? ` · ${splits.unknown} without a matched pitcher` : ""}</span>
    </div>
    <div className="table-wrap mt-3"><table><thead><tr><th>Split</th><th className="text-right">Batted Balls</th><th className="text-right">Avg EV</th><th className="text-right">Max EV</th><th className="text-right">Avg Launch</th><th className="text-right">Hard Hit</th><th className="text-right">Line Drive</th></tr></thead>
      <tbody>{splits.sides.map(side => <tr key={side.hand} data-split={side.hand}>
        <td className="font-semibold">vs {side.hand === "R" ? "RHP" : "LHP"}</td>
        <td className="text-right tabular-nums">{side.count}</td>
        <td className="text-right tabular-nums">{one(side.avgEv, " mph")}</td>
        <td className="text-right tabular-nums">{one(side.maxEv, " mph")}</td>
        <td className="text-right tabular-nums">{one(side.avgLa, "°")}</td>
        <td className="text-right tabular-nums">{one(side.hardHitPct, "%")}</td>
        <td className="text-right tabular-nums">{one(side.lineDrivePct, "%")}</td>
      </tr>)}</tbody></table></div>
    <p className="m-0 mt-2 text-xs text-[var(--text-secondary)]">Each batted ball is linked to the pitcher staff matched in that file; the hand comes from the roster. Machine BP and unmatched pitchers are not included. Hard hit is 90+ mph; line drive is 10–25°. Small samples swing quickly.</p>
  </section>;
}
