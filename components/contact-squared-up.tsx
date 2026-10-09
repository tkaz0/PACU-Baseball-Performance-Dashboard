import { Sparkline } from "@/components/charts/sparkline";
import { StatInfo } from "@/components/stat-info";
import type { SavedContact } from "@/lib/full-swing-contacts-server";
import { contactSessionTrends, squaredUpSummary } from "@/lib/contact-trends";

const one = (value: number | null, suffix = "") => value === null ? "—" : `${value.toFixed(1)}${suffix}`;
const shortDate = (value: string) => new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export function ContactSquaredUp({ contacts }: { contacts: readonly SavedContact[] }) {
  const s = squaredUpSummary(contacts);
  if (!s.count) return null;
  const tile = (label: string, value: string, note: string, metric?: string) => <div className="rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-raised)] p-3"><p className="m-0 text-xs font-semibold text-[var(--text-secondary)]">{label}{metric && <StatInfo metric={metric} label={label}/>}</p><strong className="mt-1 block text-2xl tabular-nums">{value}</strong><p className="muted m-0 text-xs">{note}</p></div>;
  return <section className="mt-4" aria-label="Squared up and potential exit velocity" data-testid="contact-squared-up">
    <h3 className="m-0 text-base font-bold">Quality of Contact</h3>
    <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
      {tile("Squared Up", one(s.avgSquaredUp, "%"), `Average of ${s.count} batted ${s.count === 1 ? "ball" : "balls"}`, "squared_up")}
      {tile("Potential EV", one(s.avgPotential, " mph"), "Average at 100% squared up", "potential_exit_velocity")}
      {tile("Top Potential EV", one(s.maxPotential, " mph"), "Highest single swing")}
      {tile("EV Left on the Table", one(s.avgGap, " mph"), "Average potential minus actual")}
    </div>
    {s.count < s.total && <p className="muted mb-0 mt-2 text-xs">{s.total - s.count} of {s.total} batted balls have no saved Squared Up reading and are left out.</p>}
  </section>;
}

/** Session-by-session lines for the selected contact view; each point is one Full Swing date. */
export function ContactSessionTrends({ contacts }: { contacts: readonly SavedContact[] }) {
  const trends = contactSessionTrends(contacts);
  if (!trends.length) return null;
  return <section className="mt-4 rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-raised)] p-4" aria-label="Session trends" data-testid="contact-session-trends">
    <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="m-0 text-base font-bold">Session Trends</h3><span className="text-xs text-[var(--text-secondary)]">One point per Full Swing date · {shortDate(trends[0].points[0].date)} to {shortDate(trends[0].points.at(-1)!.date)}</span></div>
    <ul className="m-0 mt-3 grid list-none gap-3 p-0 sm:grid-cols-2">{trends.map(trend => { const first = trend.points[0], last = trend.points.at(-1)!;
      const fmt = (v: number) => `${v.toFixed(1)}${trend.unit === "mph" ? " mph" : trend.unit}`;
      return <li key={trend.key} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-panel)] p-3" data-trend={trend.key}>
        <div className="min-w-0"><p className="m-0 text-xs font-semibold text-[var(--text-secondary)]">{trend.label}</p><p className="m-0 mt-1 text-sm tabular-nums">{fmt(first.value)} <span className="muted">→</span> <strong>{fmt(last.value)}</strong></p><p className="muted m-0 text-xs">{trend.points.length} sessions · latest {last.count} {last.count === 1 ? "ball" : "balls"}</p></div>
        <Sparkline points={trend.points} width={130} height={36} label={trend.label} direction={trend.key === "launch" ? "neutral" : "higher"} format={fmt} noun="sessions"/>
      </li>; })}</ul>
    <p className="muted mb-0 mt-2 text-xs">Lines follow the Balls in Play / All Contact choice above. Small sessions swing quickly; launch angle is descriptive.</p>
  </section>;
}
