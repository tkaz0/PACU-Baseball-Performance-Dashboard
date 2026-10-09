import { battedBallProfile, type BattedBallReading } from "@/lib/batted-ball-profile";

const TYPE_COLORS = ["#7a8597", "#e0485a", "#c8102e", "#a26bd6"];
const ZONE_COLORS = ["#c8102e", "#7a8597", "#3979b7"];
const pct = (value: number) => `${value.toFixed(0)}%`;

function StackedBar({ label, parts, colors }: { label: string; parts: readonly { label: string; count: number; pct: number }[]; colors: readonly string[] }) {
  return <div>
    <div className="flex h-3 overflow-hidden rounded-full bg-[var(--surface-raised)]" role="img" aria-label={`${label}: ${parts.map(part => `${part.label} ${pct(part.pct)} (${part.count})`).join(", ")}`}>
      {parts.map((part, index) => part.count > 0 && <span key={part.label} style={{ width: `${part.pct}%`, background: colors[index] }} />)}
    </div>
    <ul className="m-0 mt-2 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-xs text-[var(--text-secondary)]">
      {parts.map((part, index) => <li key={part.label} className="flex items-center gap-1.5"><span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: colors[index] }} />{part.label} <strong className="tabular-nums text-[var(--text-primary)]">{pct(part.pct)}</strong><span className="tabular-nums">({part.count})</span></li>)}
    </ul>
  </div>;
}

/** Descriptive launch-angle and direction mix for the selected contact; not hit outcomes. */
export function BattedBallProfile({ contacts, bats }: { contacts: readonly BattedBallReading[]; bats?: string | null }) {
  const profile = battedBallProfile(contacts, bats);
  if (!profile.count) return null;
  return <section className="mt-4 rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-raised)] p-4" aria-label="Batted ball profile" data-testid="batted-ball-profile">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h3 className="m-0 text-base font-bold">Batted Ball Profile</h3>
      <span className="text-xs text-[var(--text-secondary)]">{profile.count} {profile.count === 1 ? "ball" : "balls"} · launch angle{profile.directedCount ? ` · ${profile.directedCount} with direction` : ""}</span>
    </div>
    <div className="mt-3 grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-start">
      <div><p className="m-0 mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Type</p><StackedBar label="Batted ball type" parts={profile.types} colors={TYPE_COLORS} /></div>
      {profile.directedCount > 0
        ? <div><p className="m-0 mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Direction{profile.battingSide ? ` · bats ${profile.battingSide}` : ""}</p><StackedBar label="Batted ball direction" parts={profile.zones} colors={ZONE_COLORS} /></div>
        : <p className="m-0 text-xs text-[var(--text-secondary)]">Direction appears once batted balls with a recorded direction are saved.</p>}
      {profile.airPullPct !== null && <div className="md:text-right"><p className="m-0 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Pulled Air Balls</p><strong className="block text-3xl tabular-nums leading-none" data-testid="air-pull-pct">{pct(profile.airPullPct)}</strong><p className="m-0 mt-1 text-xs text-[var(--text-secondary)]">{profile.airPull} of {profile.directedCount} · 10°+ to the pull side</p></div>}
    </div>
    <p className="m-0 mt-3 text-xs text-[var(--text-secondary)]">Types use MLB Statcast launch-angle ranges: ground ball below 10°, line drive 10–25°, fly ball 25–50°, pop-up above 50°. Direction uses the spray chart&apos;s ±15° middle.{profile.battingSide ? "" : " Pull side needs a recorded batting side (R or L), so field sides are shown instead."} These describe how the ball left the bat, not hit results.</p>
  </section>;
}
