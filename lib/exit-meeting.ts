import type { Measurement } from "@/lib/imports/engine";
import type { ImportBatch } from "@/lib/local-workspace";
import { athleteName, type RosterAthlete } from "@/lib/types";
import { getPlayerPerformance, normalizePlayerMetric, type PlayerPercentileOverride } from "@/lib/player-performance";
import { getPlayerProfileLayout, getSessionPerformance, withoutWeeklyBlastCards } from "@/lib/player-profile-layout";
import { getPlayerInsights } from "@/lib/player-insights";
import { formatHeight, formatMetricNumber } from "@/lib/measurement-display";
import { profileMetricLabel } from "@/lib/profile-metric-label";
import { gameOverviewMetrics } from "@/lib/game-overview";
import { gameOpportunityLabel } from "@/lib/game-opportunities";
import { gameValue, type GameComparison } from "@/lib/game-metrics";
import type { SharedGameStat } from "@/lib/game-server";
import { cumulativePitching } from "@/lib/pitching-cumulative";
import { formatInnings, pitchSplits } from "@/lib/pitching-stats";
import { blastFallSummary } from "@/lib/blast-fall";
import { blastPracticeReports, blastUnit, formatBlastValue } from "@/lib/blast-metrics";
import { classifiedPitchSource } from "@/lib/imports/classified-pitch-results";
import { arsenalPitches } from "@/lib/pitch-arsenal";
import { getRenphoChartReadings, getRenphoReports } from "@/lib/renpho-charts";
import { getRenphoMuscleBalance } from "@/lib/renpho-muscle-balance";
import { isMovementRom, MOVEMENT_LABELS, movementTone, type MovementColor, type MovementReport } from "@/lib/movement-screening";
import type { SavedContact } from "@/lib/full-swing-contacts-server";
import { contactQuality } from "@/lib/contact-quality";
import { compactExitMeetingReport } from "@/lib/exit-meeting-compact";

export type ExitMeetingRow = {
  label: string; value: string; source: string; date: string; basis: string;
  percentile: number | null; peers: number | null; sample: string | null;
  tone?: MovementColor; trend?: { date: string; value: number }[];
  metricKey?: string;
};
export type ExitMeetingSection = { id: string; title: string; subtitle: string; rows: ExitMeetingRow[]; note?: string };
export type ExitMeetingInsight = { label: string; detail: string; percentile: number | null };
export type ExitMeetingReport = {
  format: ExitMeetingFormat;
  name: string; code: string; jersey: string; position: string; academicClass: string; batsThrows: string;
  season: string; generatedAt: string; lastTested: string | null; lastGameUpdate: string | null;
  strengths: ExitMeetingInsight[]; development: ExitMeetingInsight[]; jumps: ExitMeetingInsight[];
  sections: ExitMeetingSection[]; missing: string[]; notes: string[];
};
export type ExitMeetingFormat = "meeting" | "detailed";
export type ExitMeetingOptions = { meetingDate: string; talkingPoints: string; format?: ExitMeetingFormat };
export function exitMeetingFormat(value: unknown): ExitMeetingFormat {
  if (value === undefined || value === "meeting") return "meeting";
  if (value === "detailed") return "detailed";
  throw new Error("Choose Meeting Summary or Detailed Report.");
}
export const EXIT_MEETING_NOTES_LIMIT = 1600;
export function parseExitMeetingOptions(value: Record<string, unknown>): ExitMeetingOptions {
  const meetingDate = value.meetingDate, talkingPoints = value.talkingPoints ?? "";
  if (typeof meetingDate !== "string" || !/^20\d\d-\d\d-\d\d$/.test(meetingDate) || !Number.isFinite(Date.parse(meetingDate)) || new Date(meetingDate).toISOString().slice(0, 10) !== meetingDate
    || typeof talkingPoints !== "string" || talkingPoints.length > EXIT_MEETING_NOTES_LIMIT || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(talkingPoints)) throw new Error("Choose a valid meeting date and keep talking points under 1,600 characters.");
  return { meetingDate, talkingPoints: talkingPoints.trim(), format: exitMeetingFormat(value.format) };
}
const row = (label: string, value: string, source: string, date: string, basis = "Latest saved result", extra: Partial<ExitMeetingRow> = {}): ExitMeetingRow => ({ label, value, source, date, basis, percentile: null, peers: null, sample: null, ...extra });
const displayReading = (value: number, metric: string, unit: string, source: string) => metric === "height" ? formatHeight(value, unit) ?? `${value} ${unit}` : `${formatMetricNumber(value, metric, source, value.toLocaleString("en-US", { maximumFractionDigits: unit === "s" ? 3 : 2 }))}${unit === "%" ? "" : " "}${unit}`;
export const exitMeetingPacificDate = (stamp: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(stamp));
const dateOf = (rows: readonly SharedGameStat[]) => { const stamp = rows.map(r => r.fetched_at).sort().at(-1); return stamp ? exitMeetingPacificDate(stamp) : ""; };
const gameLabels: Record<string, string> = { pa: "Plate Appearances", qpa: "Quality Plate Appearances", ab: "At Bats", hh_base_hit: "HH Base Hit", hh_extra_base_hit: "HH Extra Base Hit", pumps: "Home Runs", base_hit: "Hits", three_eight_hh: "3-8 Hard Hit", eight_plus_pitches: "8+ Pitch Appearances", bb: "Walks", rbi: "RBI", sac_bunt: "Sacrifice Bunts", moving_runner: "Moved Runner", hbp: "Hit by Pitch", punchies: "Strikeouts", ab_control: "AB Control", sb: "Stolen Bases", gdp: "Grounded into Double Play", sac_fly: "Sacrifice Flies", qpa_pct: "QPA %", pitches: "Pitches", strikes: "Strikes", fb: "Fastballs", fb_k: "Fastball Strikes", bb_pitch_family: "Breaking Balls", bb_pitch_family_k: "Breaking Ball Strikes", ch: "Changeups", ch_k: "Changeup Strikes", baf: "BAF (Sheet Label)", fps: "FPS (Sheet Label)", h: "Hits Allowed", r: "Runs Allowed", bb_outcome: "Walks Allowed", k: "Strikeouts", innings_outs: "Innings Pitched", weak_contact: "Weak Contacts", hard_contact: "Hard Contacts", strike_pct: "Strike %" };

/** A shareable, numerical report projection. Never serialize source files, hashes, rows, emails, or staff-only notes. */
export function buildExitMeetingReport(input: {
  athlete: RosterAthlete; measurements: readonly Measurement[]; batches: readonly ImportBatch[];
  percentileOverrides: readonly PlayerPercentileOverride[]; games: readonly SharedGameStat[];
  comparisons: readonly GameComparison[]; movement: MovementReport | null; contacts?: readonly SavedContact[]; generatedAt: string;
}, format: ExitMeetingFormat = "meeting"): ExitMeetingReport {
  const { athlete } = input;
  if (input.measurements.some(r => r.athlete_code !== athlete.athlete_code) || input.games.some(r => r.athlete_id !== athlete.id) || input.movement && input.movement.athleteCode !== athlete.athlete_code) throw new Error("Report player identity could not be verified.");
  const season = athlete.athlete_seasons.find(s => s.season === "2026-27");
  const performance = getPlayerPerformance({ readings: input.measurements, batches: input.batches, athleteCode: athlete.athlete_code, cohortAthleteCodes: [], percentileOverrides: input.percentileOverrides });
  const clean = withoutWeeklyBlastCards(performance), layout = getPlayerProfileLayout(clean, season);
  const pitchingRole = season?.player_type?.trim().toLowerCase() === "pitcher" || season?.player_type?.trim().toLowerCase() === "two_way" || [season?.primary_position, season?.secondary_position].some(position => position?.trim().toUpperCase() === "P");
  const report: ExitMeetingReport = { format, name: athleteName(athlete), code: athlete.athlete_code, jersey: season?.jersey_number == null ? "" : `#${season.jersey_number}`, position: [season?.primary_position, season?.secondary_position].filter(Boolean).join(" / ") || "Position not recorded", academicClass: season?.academic_class ?? "Class not recorded", batsThrows: `Bats ${season?.bats ?? "-"} / Throws ${season?.throws ?? "-"}`, season: "Fall 2026", generatedAt: input.generatedAt, lastTested: null, lastGameUpdate: null, strengths: [], development: [], jumps: [], sections: [], missing: [], notes: [] };
  const add = (id: string, title: string, subtitle: string, rows: ExitMeetingRow[], note?: string) => { if (rows.length) report.sections.push({ id, title, subtitle, rows, note }); };
  const cards = [...layout.physicality, ...layout.additionalBody, ...layout.speedAgility, ...(layout.showHitting ? [...layout.hitting, ...layout.otherHitting] : []), ...layout.fieldThrowing, ...layout.pitching];
  const insights = getPlayerInsights(cards.filter(card => card.metric.group !== "body"));
  const insight = (item: typeof insights.strengths[number]): ExitMeetingInsight => ({ label: item.metric.label, detail: `${displayReading(item.latest.value, item.metric.key, item.latest.unit, item.latest.source)} · ${item.latest.source} · ${item.latest.measuredAt} · ${item.percentile.sampleSize} teammates`, percentile: item.percentile.value });
  report.strengths = insights.strengths.map(insight); report.development = insights.weaknesses.map(insight);
  report.jumps = insights.biggestJumps.map(item => ({ label: item.metric.label, detail: `${displayReading(item.previous.value, item.metric.key, item.previous.unit, item.previous.source)} → ${displayReading(item.latest.value, item.metric.key, item.latest.unit, item.latest.source)} · ${item.previous.measuredAt} to ${item.latest.measuredAt} · ${item.latest.source}`, percentile: null }));
  function cardRows(selected: typeof cards) { return selected.flatMap(card => card.sourceCards ?? [card]).filter(c => c.latest).map(card => {
    const latest = card.latest!, value = displayReading(latest.value, card.metric.key, latest.unit, latest.source);
    const percentile = card.percentileStatus === "available" && card.percentile && card.percentile.sampleSize >= 5 ? card.percentile : null;
    const history = card.history.filter(r => r.period === latest.period && r.source.trim().toLowerCase() === latest.source.trim().toLowerCase() && r.unit === latest.unit).sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
    const distinct = new Map(history.map(r => [r.measuredAt, { date: r.measuredAt, value: r.value }]));
    return row(profileMetricLabel(card.metric.key, card.metric.label, latest.source), value, latest.source, card.timedTrials?.lastTested ?? latest.measuredAt,
      card.timedTrials ? `Best time · Average ${displayReading(card.timedTrials.average, card.metric.key, latest.unit, latest.source)}` : latest.period === "summer_2026" ? "Last tested · Before Fall" : "Latest profile result", {
        metricKey: card.metric.key,
        percentile: percentile?.value ?? null, peers: percentile?.sampleSize ?? (card.cohortSampleSize && card.cohortSampleSize > 0 ? card.cohortSampleSize : null),
        sample: card.timedTrials ? `${card.timedTrials.count} trials` : /^full swing/i.test(latest.source) ? "Session sample not shown" : null,
        trend: distinct.size >= 2 ? [...distinct.values()].slice(-8) : undefined,
      });
  }); }
  add("physicality", "Physicality", "Latest measurements, with exact team comparisons where available", cardRows([...layout.physicality, ...layout.additionalBody, ...performance.body.filter(c => c.metric.key === "body_score" && c.latest)]), "Body comparisons describe team position, not health or playing ability. Lower body fat ranks higher; body metrics are not used to label strengths or weaknesses.");
  add("testing", "Running & Position Throwing", "Best timed trial, trial average, and position-specific throwing", cardRows([...layout.speedAgility, ...layout.fieldThrowing]));
  for (const context of ["in_game", "practice"] as const) {
    const contextual = getPlayerProfileLayout(getSessionPerformance(clean, context), season), caption = context === "in_game" ? "In-Game" : "Practice";
    add(`hitting-${context}`, `Hitting · ${caption}`, "Latest saved profile summaries; each device and source stays separate", cardRows(contextual.showHitting ? [...contextual.hitting, ...contextual.otherHitting] : []));
    add(`throwing-${context}`, `Throwing · ${caption}`, "Latest saved profile summaries", cardRows(contextual.pitching));
  }
  const gameMetrics = gameOverviewMetrics(input.games, input.comparisons).filter(g => g.source === "qpa_fall_2026" ? layout.showHitting : pitchingRole);
  for (const source of ["qpa_fall_2026", "pitching_fall_2026"] as const) {
    const relevant = gameMetrics.filter(g => g.source === source);
    add(`game-${source}`, `Game Stats · ${source === "qpa_fall_2026" ? "Hitting" : "Pitching"}`, "Fall to date · Current approved team-sheet totals", relevant.map(g => row(g.label, g.unit === "ratio" ? g.value.toFixed(3) : gameValue(g.value, g.unit), source === "qpa_fall_2026" ? "QPA Fall Sheet" : "Pitching Fall Sheet", exitMeetingPacificDate(g.updatedAt), "Updated snapshot", { metricKey: g.metric, percentile: g.comparison?.percentile ?? null, peers: g.comparison?.sampleSize ?? null, sample: g.opportunities === null ? null : `${g.opportunities} ${gameOpportunityLabel(g.source, g.metric) ?? "opportunities"}` })), "These are cumulative totals, not a dated game log. Counting stats depend on playing opportunities. ISO, SLG, OPS and wOBA are unavailable because doubles and triples are not recorded.");
    for (const g of relevant.filter(g => g.insightEligible && g.direction !== "neutral" && g.comparison?.percentile != null && g.opportunities !== null)) {
      const item = { label: `${g.label} · ${source === "qpa_fall_2026" ? "Hitting" : "Pitching"}`, detail: `${gameValue(g.value, g.unit)} · ${g.comparison!.sampleSize} teammates · ${g.opportunities ?? "Unrecorded"} ${gameOpportunityLabel(g.source, g.metric) ?? "opportunities"} · Updated ${exitMeetingPacificDate(g.updatedAt)}`, percentile: g.comparison!.percentile };
      if (g.comparison!.percentile! >= 75) report.strengths.push(item); if (g.comparison!.percentile! <= 25) report.development.push(item);
    }
  }
  const cumulative = cumulativePitching(input.games);
  if (gameMetrics.some(g => g.source === "pitching_fall_2026")) add("pitch-splits", "Pitch Execution", "Pitching sheet · Fall to date", pitchSplits(cumulative).flatMap(p => p.strikePct === null ? [] : [row(`${p.label} Strike %`, `${p.strikePct.toFixed(1)}%`, "Pitching Fall Sheet", dateOf(cumulative), "Updated snapshot", { sample: `${p.strikes} strikes / ${p.pitches} pitches` })]));
  // Keep each classified session separate, including multiple files on the same day.
  const classified = input.measurements.filter(r => pitchingRole && classifiedPitchSource(r.source) && r.measured_at >= "2026-09-01" && r.measured_at <= "2026-12-31");
  const sessions = new Map<string, Measurement[]>();
  for (const reading of classified) { const key = JSON.stringify([reading.measured_at, reading.file_hash, classifiedPitchSource(reading.source)!.category]); sessions.set(key, [...(sessions.get(key) ?? []), reading]); }
  [...sessions.values()].sort((a, b) => b[0].measured_at.localeCompare(a[0].measured_at)).forEach((readings, index) => {
    const context = classifiedPitchSource(readings[0].source)!.category;
    add(`arsenal-${index}`, `Pitch Arsenal · ${context === "Practice" ? "Practice" : "In-Game"}`, `${readings[0].measured_at} · Session ${index + 1} · Staff-classified pitches`, arsenalPitches(readings).flatMap(p => [
      ["Average Velocity", p.averageVelocity, "mph", p.velocityReadings], ["Max Velocity", p.maxVelocity, "mph", p.velocityReadings], ["Average Spin", p.averageSpin, "rpm", p.spinReadings], ["Max Spin", p.maxSpin, "rpm", p.spinReadings],
    ].flatMap(([metric, value, unit, count]) => typeof value !== "number" ? [] : [row(`${p.pitchType} · ${metric}`, `${value.toFixed(1)} ${unit}`, `Full Swing · ${context}`, readings[0].measured_at, "Saved session", { sample: typeof count === "number" ? `${count} readings` : "Reading count unavailable" })])), "Only staff-classified pitches are included. Spin is descriptive; a higher spin rate is not automatically better.");
  });
  if (layout.showHitting) {
    const blast = blastFallSummary(input.measurements);
    if (blast) {
      add("blast-fall", "Blast · Fall Practice", "Swing-weighted averages across reviewed, non-overlapping weekly exports", blast.metrics.flatMap(m => m.average === null ? [] : [row(m.label, `${formatBlastValue(m.average, m.unit)} ${blastUnit(m.unit)}`, "Blast Motion · Practice", `${blast.firstDate} to ${blast.lastDate}`, "Fall weighted average", { sample: `${blast.totalSwings} swings · ${blast.reportCount} reports` })]), "Weekly 95th percentiles are not averaged into a Fall peak. Angles are descriptive and have no invented ideal range.");
      if (blast.issues.length) report.notes.push("Blast Fall averages need a report/count review. Valid weekly values remain below.");
      blastPracticeReports(input.measurements).forEach((period, index) => { for (const kind of ["average", "p95"] as const) {
        const readings = period[kind], counts = readings.filter(r => r.metric === "Blast Swing Count");
        const weekComparison = (reading: Measurement) => {
          const metric = normalizePlayerMetric(reading.metric, reading.unit);
          const candidates = performance.hitting.flatMap(card => card.sourceCards ?? [card]).filter(card => card.metric.key === metric?.key && card.latest?.source === reading.source && card.latest?.unit === reading.unit && card.latest?.value === reading.value && card.latest?.measuredAt === reading.measured_at);
          const card = candidates.length === 1 ? candidates[0] : null;
          return card?.percentileStatus === "available" && card.percentile && card.percentile.sampleSize >= 5 ? { percentile: card.percentile.value, peers: card.percentile.sampleSize } : {};
        };
        add(`blast-${index}-${kind}`, `Blast Weekly · ${kind === "average" ? "Average" : "Peak (95th Percentile)"}`, `${period.start} to ${period.end} · Practice`, readings.filter(r => r.unit !== "count").map(r => row(r.metric, `${formatBlastValue(r.value, r.unit)} ${blastUnit(r.unit)}`, "Blast Motion · Practice", `${period.start} to ${period.end}`, kind === "average" ? "Weekly average" : "Weekly 95th percentile, not a maximum", { ...weekComparison(r), sample: counts.length === 1 ? `${counts[0].value} swings` : "Swing count unavailable" })));
      } });
    }
    for (const context of ["in_game", "practice"] as const) {
        const contacts = (input.contacts ?? []).filter(c => c.playedOn >= "2026-09-01" && c.playedOn <= "2026-12-31" && (c.category === "practice" ? "practice" : "in_game") === context), quality = contactQuality(contacts);
        if (quality.count) add(`contact-${context}`, `Contact Quality · ${context === "in_game" ? "In-Game" : "Practice"}`, "Full Swing · Saved paired exit velocity and launch angle", [["Hard Hit · 90+ mph", quality.hardHitPct], ["Launch Angle · 8-32°", quality.sweetSpotPct], ["Both Windows", quality.bothPct]].map(([label, value]) => row(String(label), `${Number(value).toFixed(1)}%`, "Full Swing", `${contacts.map(c => c.playedOn).sort()[0]} to ${contacts.map(c => c.playedOn).sort().at(-1)}`, "Fall saved contacts", { sample: `${quality.count} paired contacts` })), "These percentages describe batted balls with both readings. They are not batting average, hit outcomes, or the QPA sheet's HH %.");
    }
  }
  const renpho = getRenphoReports(input.measurements.filter(r => r.measured_at >= "2026-06-01" && r.measured_at <= "2026-12-31"), [...input.batches], athlete.athlete_code)[0];
  if (renpho) {
    add("renpho-detail", "Body Composition · Full Report", "Latest RENPHO report · Recorded values", getRenphoChartReadings(renpho).map(r => row(r.metric, displayReading(r.value, r.metric === "Height" ? "height" : r.metric, r.unit, r.source), "RENPHO", r.measured_at)), "RENPHO readings are body-composition estimates. No diagnosis or medical interpretation is generated.");
    const balance = getRenphoMuscleBalance(renpho);
    add("balance", "Muscle Balance", "Left/right values from the same report and unit", balance.pairs.flatMap(p => p.difference === null ? [] : [row(p.part === "arm" ? "Arms" : "Legs", `${p.difference.toFixed(1)}% difference`, "RENPHO", balance.date, `Left ${p.left!.value} ${p.left!.unit} / Right ${p.right!.value} ${p.right!.unit}`, { tone: p.review ? "yellow" : "none" })]), "Difference = (larger - smaller) / larger. The 10% review flag is a team setting, not a medical cutoff; it does not measure strength or injury risk.");
  }
  if (input.movement) add("movement", "Movement Screening", `Capstone · ${input.movement.screenedOn}`, input.movement.readings.filter(r => r.value !== null).map(r => row(MOVEMENT_LABELS[r.row - 2], `${r.value}${isMovementRom(r.row) ? "°" : /^[1-5]$/.test(r.value!) ? " / 5" : ""}`, "Capstone", input.movement!.screenedOn, isMovementRom(r.row) ? "Range of motion" : "Recorded rating", { tone: movementTone(r) })), "Color preserves the source review rating: green good, yellow middle, red watch. Ratings use 1-5; shoulder/hip range of motion uses degrees. Ankle flexion/extension use ratings. This is not a diagnosis.");
  for (const [source, counts] of [["qpa_fall_2026", input.games.filter(g => g.source === "qpa_fall_2026")], ["pitching_fall_2026", cumulative]] as const) {
    if (source === "qpa_fall_2026" ? !layout.showHitting : !pitchingRole) continue;
    add(`counts-${source}`, `${source === "qpa_fall_2026" ? "Hitting" : "Pitching"} · Supporting Totals`, "Fall to date · All recorded supporting counts", counts.filter(g => g.metric !== "earned_runs").map(g => row(gameLabels[g.metric] ?? g.metric, g.metric === "innings_outs" ? formatInnings(g.value) : gameValue(g.value, g.unit), source === "qpa_fall_2026" ? "QPA Fall Sheet" : "Pitching Fall Sheet", dateOf(counts), "Updated snapshot")));
  }
  report.strengths.sort((a, b) => (b.percentile ?? 0) - (a.percentile ?? 0)); report.strengths = report.strengths.slice(0, 5);
  report.development.sort((a, b) => (a.percentile ?? 100) - (b.percentile ?? 100)); report.development = report.development.slice(0, 5);
  report.lastTested = report.sections.flatMap(s => s.rows).filter(r => r.basis !== "Updated snapshot").flatMap(r => /^2026-\d\d-\d\d$/.test(r.date) ? [r.date] : /^2026-\d\d-\d\d to 2026-\d\d-\d\d$/.test(r.date) ? [r.date.slice(-10)] : []).filter(d => d >= "2026-06-01" && d <= "2026-12-31").sort().at(-1) ?? null;
  report.lastGameUpdate = input.games.map(g => g.fetched_at).sort().at(-1) ?? null;
  if (!report.sections.some(s => s.id === "physicality")) report.missing.push("Physicality measurements");
  if (layout.showHitting && !gameMetrics.some(g => g.source === "qpa_fall_2026")) report.missing.push("Hitting game stats");
  if (layout.showHitting && !report.sections.some(s => s.id === "blast-fall")) report.missing.push("Complete Blast Fall averages");
  if (pitchingRole && !gameMetrics.some(g => g.source === "pitching_fall_2026")) report.missing.push("Pitching game stats");
  if (pitchingRole && !report.sections.some(s => s.id.startsWith("arsenal-"))) report.missing.push("Classified pitch results");
  if (!input.movement) report.missing.push("Movement screening");
  report.notes.push("Percentiles compare at least five eligible teammates with the same metric, source, unit and period. Blue means a lower team rank; red means higher. A blank percentile means there is no verified comparison.", "Strengths are at or above the 75th team percentile; development areas are at or below the 25th, for directional baseball metrics only. They describe the saved sample and are conversation starters, not training prescriptions.", "Profile readings use latest saved results and best timed trials. They may differ from leaderboards using Fall-wide bests or weighted averages. Empty results stay missing; no zeros or estimates are added.");
  return format === "meeting" ? compactExitMeetingReport(report, pitchingRole ? classified : []) : report;
}
