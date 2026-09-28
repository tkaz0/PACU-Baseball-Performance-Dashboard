import type { ExitMeetingReport, ExitMeetingRow, ExitMeetingSection } from "@/lib/exit-meeting";
import type { Measurement } from "@/lib/imports/engine";
import { classifiedPitchSource } from "@/lib/imports/classified-pitch-results";

const physicality = new Set(["height", "weight", "muscle_mass", "body_score", "body_fat_pct", "grip_strength", "grip_dominant", "grip_non_dominant"]);
const testing = new Set(["home_to_first", "home_to_second", "boxer_t", "infield_velocity", "outfield_velocity"]);
const hitting = new Set(["max_exit_velocity", "avg_exit_velocity", "avg_bat_speed", "max_bat_speed", "max_distance"]);
const batting = new Set(["batting_avg", "batting_obp", "qpa_pct", "batting_hh_pct", "batting_bb_pct", "batting_k_pct", "pumps", "sb"]);
const pitching = new Set(["pitching_k9", "pitching_bb9", "pitching_r9", "strike_pct", "weak_contact_pct", "hard_contact_pct"]);

/** Exact source + pitch type partitions; means require every contributing file's matching count. */
export function compactExitMeetingArsenal(readings: readonly Measurement[]): ExitMeetingSection[] {
  const output = new Map<string, ExitMeetingRow[]>();
  for (const source of [...new Set(readings.map(r => r.source))].sort()) {
    const pitch = classifiedPitchSource(source); if (!pitch) continue;
    const sourceRows = readings.filter(r => r.source === source && r.measured_at >= "2026-09-01" && r.measured_at <= "2026-12-31");
    const sessions = [...new Set(sourceRows.map(r => r.file_hash))].map(hash => sourceRows.filter(r => r.file_hash === hash));
    if (!sessions.length || sessions.some(rows => new Set(rows.map(r => r.measured_at)).size !== 1 || new Set(rows.map(r => `${r.metric}:${r.unit}`)).size !== rows.length)) continue;
    const read = (rows: Measurement[], metric: string, unit: string) => { const found = rows.filter(r => r.metric === metric && r.unit === unit && Number.isFinite(r.value) && r.value >= 0); return found.length === 1 ? found[0].value : null; };
    for (const family of ["Velocity", "Spin"] as const) {
      const unit = family === "Velocity" ? "mph" : "rpm";
      const values = sessions.map(rows => ({ date: rows[0].measured_at, average: read(rows, `Pitch Type Average ${family}`, unit), max: read(rows, `Pitch Type Max ${family}`, unit), count: read(rows, `Pitch Type ${family} Readings`, "count") }));
      const relevant = values.filter(v => v.average !== null || v.max !== null || (v.count ?? 0) > 0);
      if (!relevant.length) continue;
      const dates = relevant.map(value => value.date).sort();
      const countsComplete = relevant.every(v => v.count !== null && Number.isSafeInteger(v.count) && v.count > 0);
      const total = countsComplete ? relevant.reduce((n, v) => n + v.count!, 0) : null;
      const count = total !== null && Number.isSafeInteger(total) ? total : null;
      const average = count !== null && count > 0 && relevant.every(v => v.average !== null) ? relevant.reduce((n, v) => n + v.average! * v.count! / count, 0) : null;
      const maxima = relevant.flatMap(v => v.max === null ? [] : [v.max]);
      const maximum = maxima.length ? Math.max(...maxima) : null;
      if (average === null && maximum === null) continue;
      const rows = output.get(pitch.category) ?? [];
      rows.push({ label: `${pitch.pitchType} · ${family}`, value: `${average === null ? "—" : average.toFixed(1)} avg / ${maximum === null ? "—" : maximum.toFixed(1)} max ${unit}`, source: `Full Swing · ${pitch.category}`, date: dates[0] === dates.at(-1) ? dates[0] : `${dates[0]} to ${dates.at(-1)}`, basis: average === null ? "Fall best · Average needs complete counts" : "Fall weighted average / best", percentile: null, peers: null, sample: count === null ? `Reading count unavailable · ${relevant.length} ${relevant.length === 1 ? "session" : "sessions"}` : `${count} ${family.toLowerCase()} readings · ${relevant.length} ${relevant.length === 1 ? "session" : "sessions"}`, metricKey: `compact_pitch_${family.toLowerCase()}` });
      output.set(pitch.category, rows);
    }
  }
  return [...output].map(([category, rows]) => ({ id: `arsenal-summary-${category.toLowerCase()}`, title: `Pitch Arsenal · ${category === "Practice" ? "Practice" : "In-Game"}`, subtitle: `Full Swing ${category} · Fall averages and bests`, rows, note: "Average / max stay within the same classified pitch and source. Spin describes the pitch; higher is not automatically better." }));
}

/** Meeting-first projection. All excluded detail remains in the explicit Detailed Report and saved sources. */
export function compactExitMeetingReport(report: ExitMeetingReport, classified: readonly Measurement[]): ExitMeetingReport {
  const sections: ExitMeetingSection[] = report.sections.flatMap(section => {
    let keys: ReadonlySet<string>;
    if (section.id === "physicality") keys = physicality;
    else if (section.id === "testing") keys = testing;
    else if (section.id === "game-qpa_fall_2026") keys = batting;
    else if (section.id === "game-pitching_fall_2026") keys = pitching;
    else if (section.id === "hitting-in_game") keys = hitting;
    else if (section.id === "blast-fall") return [{ ...section, title: "Hitting · Blast Practice", note: undefined }];
    else return [];
    const rows = section.rows.filter(row => row.metricKey && keys.has(row.metricKey));
    return rows.length ? [{ ...section, rows, note: undefined }] : [];
  });
  const order = ["physicality", "game-qpa_fall_2026", "game-pitching_fall_2026", "hitting-in_game", "blast-fall", "testing"];
  sections.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  sections.push(...compactExitMeetingArsenal(classified));
  const needed: string[] = [];
  if (report.sections.some(s => s.id.startsWith("blast-") && s.id !== "blast-fall") && !sections.some(s => s.id === "blast-fall")) needed.push("Blast Fall averages need complete, non-overlapping reports; weekly detail remains in Detailed Report.");
  const lastTested = sections.flatMap(s => s.rows).filter(r => r.basis !== "Updated snapshot").flatMap(r => /^2026-\d\d-\d\d$/.test(r.date) ? [r.date] : /^2026-\d\d-\d\d to 2026-\d\d-\d\d$/.test(r.date) ? [r.date.slice(-10)] : []).filter(d => d >= "2026-06-01" && d <= "2026-12-31").sort().at(-1) ?? null;
  return { ...report, format: "meeting", lastTested, sections, strengths: report.strengths.slice(0, 2), development: report.development.slice(0, 2), jumps: report.jumps.slice(0, 2), missing: report.missing.filter(m => m !== "Movement screening"), notes: [
    ...needed,
    "Percentiles: red is higher, blue lower; at least five teammates in the same test/source/unit/period. Unranked means no verified comparison. Body and spin ranks are descriptive, not strengths or weaknesses.",
    "Game stats are Fall to date. Profile test values are latest results; timed tests use best time. Pitch arsenal uses Fall weighted averages and saved bests. In-Game and Practice are separate. Empty readings stay missing.",
    "Meeting Summary shows the coaching priorities. Detailed Report includes all saved weekly Blast/P95, RENPHO details, movement screening, supporting counts and per-session pitching results.",
  ] };
}
