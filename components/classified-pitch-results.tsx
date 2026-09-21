import { leaderboardTestDate } from "@/lib/leaderboards";
import type { Measurement } from "@/lib/imports/engine";
import { CLASSIFIED_METRICS, classifiedPitchSource } from "@/lib/imports/classified-pitch-results";
import { formatSourceNumber } from "@/lib/measurement-display";

/** Own-athlete readings supplied by the authorized profile route, never a peer lookup. */
export function ClassifiedPitchResults({ readings, context = "in_game" }: { readings: readonly Measurement[]; context?: "in_game" | "practice" }) {
  const valid = readings.filter(r => classifiedPitchSource(r.source) && (classifiedPitchSource(r.source)!.category === "Practice" ? "practice" : "in_game") === context && CLASSIFIED_METRICS.some(m => m.label === r.metric && m.unit === r.unit) && r.measured_at >= "2026-09-01" && r.measured_at <= "2026-12-31");
  const latest = valid.map(r => r.measured_at).sort().at(-1);
  if (!latest) return null;
  const current = valid.filter(r => r.measured_at === latest);
  const sessions = [...new Set(current.map(r => r.file_hash))].map(hash => current.filter(r => r.file_hash === hash));
  return <section aria-label="Velocity and spin by pitch type" className="space-y-4">
    <header><h2 className="m-0 text-xl font-bold">Pitch Types · Velocity &amp; Spin</h2><p className="muted mb-0 mt-1 text-sm">Last Tested: <time dateTime={latest}>{leaderboardTestDate(latest)}</time> · Reviewed Full Swing classifications</p></header>
    {sessions.map(rows => <div className="rounded-xl border border-[var(--line-subtle)] p-4" key={rows[0].file_hash}>
      <h3 className="m-0 mb-3 text-sm font-semibold">{rows[0].source_file.replace(/\.csv$/i, "")}</h3>
      <div className="table-wrap"><table><caption className="sr-only">Maximum and average velocity and spin by pitch type</caption><thead><tr><th>Pitch Type</th><th>Pitches</th><th>Avg Velocity <span className="block text-xs">mph</span></th><th>Max Velocity <span className="block text-xs">mph</span></th><th>Avg Spin <span className="block text-xs">RPM</span></th><th>Max Spin <span className="block text-xs">RPM</span></th></tr></thead><tbody>{[...new Set(rows.map(r=>r.source))].map(source => {
        const group=rows.filter(r=>r.source===source), pitch=classifiedPitchSource(source)!;
        const value=(label:string) => { const entries=group.filter(r=>r.metric===label), values=[...new Set(entries.map(r=>r.value))]; return values.length===1?values[0]:null; };
        const show=(label:string)=>{const v=value(label);return v===null?"—":formatSourceNumber(v,source);};
        return <tr key={source}><th scope="row">{pitch.pitchType}<span className="muted block text-xs font-normal">{pitch.category}</span></th><td>{value("Pitch Type Count")??"—"}</td><td>{show("Pitch Type Average Velocity")}<span className="muted block text-xs">n={value("Pitch Type Velocity Readings")??"—"}</span></td><td>{show("Pitch Type Max Velocity")}</td><td>{show("Pitch Type Average Spin")}<span className="muted block text-xs">n={value("Pitch Type Spin Readings")??"—"}</span></td><td>{show("Pitch Type Max Spin")}</td></tr>;
      })}</tbody></table></div>
    </div>)}
    <p className="muted mb-0 text-xs">Averages use recorded readings within each reviewed pitch type. Missing readings and unassigned pitches are excluded.</p>
  </section>;
}
