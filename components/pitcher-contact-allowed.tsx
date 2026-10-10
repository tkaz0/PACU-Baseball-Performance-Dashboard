import { ContactPitchSplits } from "@/components/contact-pitch-splits";
import { isLikelyFoul } from "@/lib/likely-foul";
import { StatInfo } from "@/components/stat-info";
import { contactAllowedSummary, type AllowedContact } from "@/lib/contacts-allowed";

const one = (value: number | null, suffix = "") => value === null ? "—" : `${value.toFixed(1)}${suffix}`;

export function PitcherContactAllowed({ contacts }: { contacts: readonly AllowedContact[] | null }) {
  if (!contacts) return null;
  const s = contactAllowedSummary(contacts);
  if (!s.count) return null;
  const tile = (label: string, value: string, note: string, lowerBetter = false) => <div className="rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-raised)] p-3"><p className="m-0 text-xs font-semibold text-[var(--text-secondary)]">{label}</p><strong className="mt-1 block text-2xl tabular-nums">{value}</strong><p className="muted m-0 text-xs">{note}{lowerBetter ? " · lower is better" : ""}</p></div>;
  return <section className="rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-panel)] p-4 sm:p-5" aria-label="Contact allowed" data-testid="contact-allowed">
    <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="m-0 text-xl font-bold">Contact Allowed<StatInfo metric="contact_allowed" label="Contact Allowed"/></h2><span className="text-xs text-[var(--text-secondary)]">{s.count} batted {s.count === 1 ? "ball" : "balls"} · {s.sessions} {s.sessions === 1 ? "session" : "sessions"} · Game &amp; intrasquad</span></div>
    <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
      {tile("Average EV Against", one(s.avgEv, " mph"), `Max ${one(s.maxEv, " mph")}`, true)}
      {tile("Hard Hit Against", one(s.hardHitPct, "%"), "90+ mph", true)}
      {tile("Squared Up Against", one(s.squaredUp, "%"), `${s.squaredCount} with a reading`, true)}
      {tile("Average Launch Angle", one(s.avgLaunch, "°"), "Descriptive")}
    </div>
    <div className="mt-3" aria-label="Batted ball mix against">
      <div className="flex h-3 overflow-hidden rounded-full bg-[var(--surface-raised)]" role="img" aria-label={`Ground balls ${one(s.groundPct, "%")}, line drives ${one(s.linePct, "%")}, fly balls ${one(s.flyPct, "%")}, pop-ups ${one(s.popupPct, "%")}`}>
        {[["ground", s.groundPct, "#367ea3"], ["line", s.linePct, "#c8102e"], ["fly", s.flyPct, "#e0a526"], ["popup", s.popupPct, "#8a8f98"]].map(([key, value, color]) => <span key={key as string} style={{ width: `${value ?? 0}%`, background: color as string }}/>)}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-secondary)]"><span>Ground {one(s.groundPct, "%")}</span><span>Line Drive {one(s.linePct, "%")}</span><span>Fly Ball {one(s.flyPct, "%")}</span><span>Pop-Up {one(s.popupPct, "%")}</span></div>
    </div>
    <ContactPitchSplits contacts={contacts.filter(row=>!isLikelyFoul(row))} against/>
    <p className="muted mb-0 mt-3 text-xs">Batted balls the Full Swing file linked to this pitcher. Likely fouls{s.fouls ? ` (${s.fouls})` : ""} are left out. Ground &lt;10°, line drive 10–25°, fly ball 25–50°, pop-up &gt;50°. Full Swing does not record whether a ball became a hit, and machine BP and unlinked contact are not included.</p>
  </section>;
}
