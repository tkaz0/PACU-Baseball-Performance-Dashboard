import type { GraphicsMetric, GraphicsPlayerData, GraphicsLeaderboard, GraphicsArsenal } from "@/lib/graphics-data";
import type { GraphicsCard } from "@/lib/graphics-renderer";
import { formatMetricNumber } from "@/lib/measurement-display";

export type GraphicsTemplate = GraphicsCard["kind"];
export const GRAPHICS_TEMPLATES: { id: GraphicsTemplate; label: string; description: string; staffOnly?: boolean }[] = [
  { id: "dashboard", label: "About PACU", description: "Share the dashboard." },
  { id: "player", label: "Player Card", description: "A player and their stats." },
  { id: "spotlight", label: "One Stat", description: "Put one number up front." },
  { id: "percentiles", label: "Team Percentiles", description: "Compare matching team results." },
  { id: "arsenal", label: "Pitch Arsenal", description: "Velocity and spin by pitch." },
  { id: "trend", label: "Progress", description: "Results across testing dates." },
  { id: "leaderboard", label: "Team Leaders", description: "Share a team ranking.", staffOnly: true },
  { id: "comparison", label: "Compare Players", description: "Two players. Matching stats.", staffOnly: true },
];
const labels: Record<GraphicsMetric["category"], string> = { physicality: "Physicality", hitting: "Hitting", pitching: "Pitching", "game-hitting": "Batting", "game-pitching": "Pitching" };
export const graphicsGroupKey = (metric: GraphicsMetric) => JSON.stringify([metric.category, metric.source, metric.context]);

/** Short display labels only; exact source/context strings still control grouping and comparisons. */
export function graphicsContextLabel(value: { source: string; context: string; date?: string; period?: string }): string {
  const source = value.source.trim(), context = value.context.trim();
  const weeklyBlast = /^Blast Motion · (Average|P95) · (\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/i.exec(source);
  const dates = [...`${value.date ?? ""} ${source}`.matchAll(/\b(\d{4})-(\d{2})-\d{2}\b/g)];
  const sameYear = dates.length && dates.every(date => date[1] === dates[0][1]);
  const dateSeason = sameYear && dates.every(date => Number(date[2]) >= 9 && Number(date[2]) <= 12) ? `Fall ${dates[0][1]}`
    : sameYear && dates.every(date => Number(date[2]) >= 6 && Number(date[2]) <= 8) ? `Summer ${dates[0][1]}` : "";
  const stated = `${value.period ?? ""} ${context} ${source}`;
  const season = /(?:Summer|June[–-]August)\s+(\d{4})/i.exec(stated);
  const fall = /Fall\s+(\d{4})/i.exec(stated);
  const period = season ? `Summer ${season[1]}` : fall ? `Fall ${fall[1]}` : dateSeason;
  const base = weeklyBlast ? "Blast · Practice" : source.replace(/^Blast Motion\b/i, "Blast").replace(/\s*·\s*(?:Fall|Summer)\s+\d{4}\b/gi, "");
  const basis = /95th|\bP95\b/i.test(context) || weeklyBlast?.[1].toLowerCase() === "p95" ? "Weekly P95"
    : /weighted/i.test(context) ? "Weighted avg" : weeklyBlast ? "Weekly avg" : /best time/i.test(context) ? "Best time" : /Fall average/i.test(context) ? "Avg" : /latest profile result/i.test(context) ? "Latest" : "";
  // Keep unfamiliar protocols visible instead of folding them into a known source.
  const extra = context.split(/\s*·\s*/).filter(part => part && !/^(?:Fall\s+\d{4}|Summer\s+\d{4}|June[–-]August\s+\d{4}|latest profile result|recorded results|to date|team ranking|.*weighted.*|.*95th.*|.*\bP95\b.*|best time|Fall average)$/i.test(part) && !base.toLowerCase().includes(part.toLowerCase()));
  return [...new Set([base, ...extra, period, basis].filter(Boolean))].join(" · ");
}
/** Fast selector wording; season/basis are added only when useful to distinguish choices. */
export function graphicsResultLabel(value: Pick<GraphicsMetric, "category" | "source" | "context"> & { date?: string; period?: string }): string {
  const badge = graphicsContextLabel(value);
  const session = /\b(Intrasquad|Practice|Game)\b/i.exec(`${value.source} · ${value.context}`)?.[1];
  const displaySession = session ? /^game$/i.test(session) ? "In-Game" : session[0].toUpperCase() + session.slice(1).toLowerCase() : "";
  const vendor = /^Blast(?: Motion)?(?:\b| ·)/i.test(value.source) ? "Blast" : /^Full Swing(?:\b| ·)/i.test(value.source) ? "Full Swing" : value.source.replace(/\s*·\s*(?:Fall|Summer)\s+\d{4}\b/gi, "");
  const summer = /Summer\s+\d{4}/.exec(badge)?.[0];
  const basis = /Weekly P95/.test(badge) ? "P95" : /Best time/.test(badge) ? "Best time" : "";
  return [`${labels[value.category]}${displaySession ? ` · ${displaySession}` : ""} (${vendor})`, summer, basis].filter(Boolean).join(" · ");
}
export function graphicsMetricGroups(metrics: GraphicsMetric[]) {
  const unique = [...new Map(metrics.map(metric => [graphicsGroupKey(metric), { key: graphicsGroupKey(metric), label: graphicsResultLabel(metric), source: metric.source, context: metric.context }])).values()];
  const labels = unique.map(group => group.label);
  for (const group of unique) if (labels.filter(label => label === group.label).length > 1) group.label += ` · ${/weighted/i.test(group.context) ? "Weighted avg" : /latest/i.test(group.context) ? "Latest" : /Fall average/i.test(group.context) ? "Fall avg" : group.context}`;
  // Exact source labels resolve the rare remaining collision without changing the partition key.
  const qualified = unique.map(group => group.label);
  for (const group of unique) if (qualified.filter(label => label === group.label).length > 1) group.label += ` · ${group.source}`;
  return unique.sort((a, b) => a.label.localeCompare(b.label));
}
export function selectedGraphicsMetrics(data: GraphicsPlayerData | null, groupKey: string, keys: string[], template: GraphicsTemplate): GraphicsMetric[] {
  const available = (data?.metrics ?? []).filter(metric => graphicsGroupKey(metric) === groupKey && (template !== "percentiles" || metric.percentile !== null));
  const selected = available.filter(metric => keys.includes(metric.key));
  return (selected.length ? selected : available).slice(0, template === "spotlight" ? 1 : 6);
}
const comparisonMatches = (first: GraphicsMetric, second: GraphicsMetric) => first.key === second.key && first.unit === second.unit && first.source === second.source && first.context === second.context;
/** The UI may offer this intersection; the builder still requires every selected metric to match. */
export function comparableGraphicsMetrics(metrics: readonly GraphicsMetric[], second: GraphicsPlayerData | null): GraphicsMetric[] {
  return second ? metrics.filter(metric => second.metrics.some(other => comparisonMatches(metric, other))) : [];
}

/** Keep actual denominators and early-sample labels inline; report counts and dates live in the caption. */
export function compactGraphicsSample(sample: string): string {
  return sample.split(/\s*·\s*/).flatMap(part => {
    if (/^\d[\d,.]* comparable players$/i.test(part)) return [part.replace("comparable players", "players")];
    if (/^\d[\d,.]* (?:swings|pitches|trials|AB|PA|IP|walks|contacts|classified contacts|OBP opportunities|HH opportunities)$/i.test(part)) return [part.replace("classified contacts", "contacts").replace("OBP opportunities", "OBP opp.").replace("HH opportunities", "HH opp.")];
    return /^Early sample$/i.test(part) ? ["Early sample"] : [];
  }).join(" · ");
}
function metricNotes(metrics: Pick<GraphicsMetric, "key">[]): string[] {
  const keys = metrics.map(metric => metric.key), notes: string[] = [];
  if (keys.some(key => /batting_est_(slg|iso)/.test(key))) notes.push("SLG / ISO count each double or triple as two bases; home runs as four.");
  if (keys.some(key => key.includes("wobacon"))) notes.push("wOBAcon uses fixed MLB reference weights and treats doubles/triples as doubles.");
  if (keys.some(key => key.includes("production_plus"))) notes.push("PAC Production+ is a Pacific team index (100 = team); not MLB wRC+.");
  return notes;
}
const metricDetail = (metric: GraphicsMetric) => `${metric.label}: ${metric.formatted} · ${metric.source} · ${metric.context} · ${metric.date}${metric.sample ? ` · ${metric.sample}` : ""}${metric.percentile !== null ? ` · Team percentile ${metric.percentile.toLocaleString("en-US", { maximumFractionDigits: 1 })}/100` : ""}`;
const windowLabel = (first: string | null, last: string | null) => first ? first === last || !last ? first : `${first} to ${last}` : "Date unavailable";
const pitchBasis = (basis: GraphicsArsenal["velocityBasis"]) => basis === "fall" ? "Fall avg" : basis === "latest" ? "Latest avg" : "Avg unavailable";
function compactPitchBasis(pitch: GraphicsArsenal): string {
  const average = pitch.velocityBasis === pitch.spinBasis ? pitchBasis(pitch.velocityBasis) : `Velo: ${pitchBasis(pitch.velocityBasis)} · Spin: ${pitchBasis(pitch.spinBasis)}`;
  return `${average} · Fall max`;
}
const pitchValue = (value: number | null, unit: string) => value === null ? "unavailable" : `${value.toFixed(1)} ${unit}`;
function pitchDetail(pitch: GraphicsArsenal): string {
  return `${pitch.label} · ${pitch.source}\nAverage velocity: ${pitchValue(pitch.averageVelocity, "mph")} · ${pitchBasis(pitch.velocityBasis)} · ${pitch.velocityCount ?? "Unknown"} velocity readings · ${windowLabel(pitch.velocityFirstDate, pitch.velocityLastDate)}\nAverage spin: ${pitchValue(pitch.averageSpin, "rpm")} · ${pitchBasis(pitch.spinBasis)} · ${pitch.spinCount ?? "Unknown"} spin readings · ${windowLabel(pitch.spinFirstDate, pitch.spinLastDate)}\nMaximum velocity: ${pitchValue(pitch.maxVelocity, "mph")} · ${pitch.maxVelocityDate ?? "Date unavailable"}\nMaximum spin: ${pitchValue(pitch.maxSpin, "rpm")} · ${pitch.maxSpinDate ?? "Date unavailable"}\n${pitch.basis} · Recorded ${windowLabel(pitch.firstDate, pitch.lastDate)}`;
}

export type GraphicsCardOptions = { template: GraphicsTemplate; player: GraphicsPlayerData | null; second: GraphicsPlayerData | null; metrics: GraphicsMetric[]; board: GraphicsLeaderboard | null; topCount: number; arsenalContext: string; trendKey: string; headline: string };
/** The image is a compact view. Caption-only details preserve evidence without exposing stored identities. */
export function buildGraphicsCard(options: GraphicsCardOptions): GraphicsCard | null {
  const { template, player, second, metrics, board, headline } = options;
  if (template === "dashboard") return { kind: "dashboard", title: headline || "PEOPLE LIE.\nNUMBERS DON’T.", subtitle: "Pacific Baseball Performance", kicker: "Built for baseball", metrics: [{ label: "Game Stats", value: "Track Production" }, { label: "Player Profiles", value: "Know Your Game" }, { label: "Pitch & Swing Design", value: "Build Your Approach" }, { label: "Team Comparisons", value: "See the Difference" }, { label: "Training Results", value: "Measure Progress" }, { label: "Coach Tools", value: "Turn Data Into Action" }], source: "Built for players and coaches", footerNotes: [] };
  if (template === "leaderboard") {
    if (!board?.rows.length) return null;
    const rows = board.rows.slice(0, options.topCount);
    return { kind: template, title: headline || board.label, subtitle: "TEAM LEADERS", kicker: graphicsContextLabel(board), source: `${board.source} · ${board.context}`, updated: board.date, metrics: [],
      ranking: rows.map(row => ({ name: row.name, value: row.formatted, rank: row.rank, sample: compactGraphicsSample(row.sample) })),
      captionDetails: [`${board.rows.length} measured players in this ranking; ${rows.length} shown.`, ...rows.map(row => `#${row.rank} ${row.name}: ${row.formatted} · ${row.sample} · ${row.date}`)], footerNotes: metricNotes([{ key: board.key }]) };
  }
  if (!player) return null;
  const identity = { name: player.player.name, meta: [player.player.position, player.player.secondaryPosition, player.player.academicClass].filter(Boolean).join(" · ") };
  if (template === "arsenal") {
    const pitches = player.arsenals.filter(pitch => pitch.category === options.arsenalContext); if (!pitches.length) return null;
    return { kind: template, title: headline || "THE ARSENAL", subtitle: "", ...identity, kicker: graphicsContextLabel({ source: `Full Swing · ${options.arsenalContext}`, context: "Fall 2026" }), source: `Full Swing · ${options.arsenalContext}`, updated: [...new Set(pitches.map(pitch => pitch.lastDate))].sort().at(-1), metrics: [],
      pitches: pitches.map(pitch => ({ name: pitch.label, velocity: pitch.averageVelocity, maxVelocity: pitch.maxVelocity, spin: pitch.averageSpin, maxSpin: pitch.maxSpin, sample: `Avg n: ${pitch.velocityCount ?? "—"} velo / ${pitch.spinCount ?? "—"} spin`, context: compactPitchBasis(pitch) })),
      captionDetails: pitches.map(pitchDetail), footerNotes: ["Fall averages are count-weighted when complete; otherwise the labeled latest verified average is shown. Maximums are Fall bests. Spin is descriptive."] };
  }
  if (template === "trend") {
    const trend = player.trends.find(item => item.key === options.trendKey); if (!trend || trend.points.length < 2) return null;
    return { kind: template, title: headline || "PROGRESS REPORT", subtitle: "", ...identity, kicker: graphicsContextLabel({ ...trend, date: trend.points.at(-1)!.date }), metrics: [], source: trend.source, updated: trend.points.at(-1)!.date, trend: trend.points, trendLabel: trend.label, trendUnit: trend.unit,
      captionDetails: [`${trend.label} · ${trend.source} · ${trend.context}`, ...trend.points.map(point => `${point.date}: ${formatMetricNumber(point.value, trend.label, trend.source, point.value.toLocaleString("en-US", { maximumFractionDigits: 3 }))}${trend.unit === "%" ? "%" : ` ${trend.unit}`}`)],
      footerNotes: ["Recorded results on distinct testing dates, using the same source, units and period."] };
  }
  if (!metrics.length || new Set(metrics.map(graphicsGroupKey)).size !== 1) return null;
  const dates = [...new Set(metrics.map(metric => metric.date))].sort();
  const base: GraphicsCard = { kind: template, title: headline || (template === "spotlight" ? "STAT SPOTLIGHT" : template === "percentiles" ? "TEAM PERCENTILES" : `${labels[metrics[0].category].toUpperCase()} STATS`), subtitle: "", ...identity,
    kicker: graphicsContextLabel(metrics[0]), source: `${metrics[0].source} · ${metrics[0].context}`, updated: dates.join(" / "),
    metrics: metrics.map(metric => ({ label: metric.label, value: metric.formatted, percentile: metric.percentile, sample: compactGraphicsSample(metric.sample) })), captionDetails: metrics.map(metricDetail),
    footerNotes: [...metricNotes(metrics), ...(template === "percentiles" ? ["Percentiles compare matching Pacific team results, not national rankings. Body, spin and angle percentiles are descriptive."] : [])] };
  if (template === "comparison") {
    if (!second || second.player.id === player.player.id) return null;
    if (comparableGraphicsMetrics(metrics, second).length !== metrics.length) return null;
    const matches = metrics.map(metric => ({ metric, match: second.metrics.find(other => comparisonMatches(metric, other))! }));
    return { ...base, title: headline || "HEAD-TO-HEAD", name: undefined, meta: undefined, metrics: [], updated: [...new Set(matches.flatMap(row => [row.metric.date, row.match.date]))].sort().join(" / "),
      comparison: { names: [player.player.name, second.player.name], rows: matches.map(({ metric, match }) => ({ label: metric.label, a: metric.formatted, b: match.formatted, aSample: compactGraphicsSample(metric.sample), bSample: compactGraphicsSample(match.sample) })) },
      captionDetails: matches.flatMap(({ metric, match }) => [`${player.player.name} · ${metricDetail(metric)}`, `${second.player.name} · ${metricDetail(match)}`]),
      footerNotes: [...metricNotes(matches.map(row => row.metric)), "Recorded results shown side by side. Check dates and sample sizes."] };
  }
  return base;
}
export function graphicsCaption(card: GraphicsCard): string {
  const details = card.captionDetails ?? card.metrics.map(metric => `${metric.label}: ${metric.value}${metric.sample ? ` (${metric.sample})` : ""}`);
  const title = card.kind === "dashboard" ? "Pacific Baseball Performance — a dashboard for players and coaches." : `${card.name ? `${card.name} | ` : ""}${card.title.replaceAll("\n", " ")}`;
  return [title, card.subtitle, card.source ? `Source: ${card.source}` : "", card.updated ? `Results: ${card.updated}` : "", ...details, ...(card.footerNotes ?? []), "Explore the project: https://pacubaseballperformance.com", "Independent project for Pacific Baseball. Not an official university application."].filter(Boolean).join("\n");
}

/** Ready-to-post wording from the displayed card; full evidence remains in graphicsCaption. */
export function graphicsSocialCaption(card: GraphicsCard): string {
  const title = `${card.name ? `${card.name} | ` : ""}${card.title.replaceAll("\n", " ")}`;
  const withSample = (value: string, sample?: string) => `${value}${sample ? ` (${sample})` : ""}`;
  let lines = card.metrics.map(metric => {
    const percentile = card.kind === "percentiles" && metric.percentile != null ? `Team percentile ${metric.percentile.toLocaleString("en-US", { maximumFractionDigits: 1 })}/100` : "";
    return `${metric.label}: ${withSample(metric.value, [percentile, metric.sample].filter(Boolean).join(" · "))}`;
  });
  let dates = card.updated ? `Results: ${card.updated}` : "";
  if (card.kind === "leaderboard") lines = (card.ranking ?? []).map(row => `#${row.rank} ${row.name}: ${withSample(row.value, row.sample)}`);
  if (card.kind === "comparison" && card.comparison) {
    const { names, rows } = card.comparison;
    lines = [`${names[0]} / ${names[1]}`, ...rows.map(row => `${row.label}: ${withSample(row.a, row.aSample)} / ${withSample(row.b, row.bSample)}`)];
  }
  if (card.kind === "arsenal") {
    const number = (value: number | null) => value === null ? "—" : value.toFixed(1);
    lines = (card.pitches ?? []).map(pitch => `${pitch.name}: ${number(pitch.velocity)} avg / ${number(pitch.maxVelocity)} max mph · ${number(pitch.spin)} avg / ${number(pitch.maxSpin)} max rpm${pitch.context ? ` · ${pitch.context}` : ""}${pitch.sample ? ` · ${pitch.sample}` : ""}`);
  }
  if (card.kind === "trend" && card.trend?.length) {
    const points = [...card.trend].sort((a, b) => a.date.localeCompare(b.date)), first = points[0], last = points.at(-1)!;
    const value = (value: number) => formatMetricNumber(value, card.trendLabel ?? "", card.source, value.toLocaleString("en-US", { maximumFractionDigits: 3 }));
    lines = [`${card.trendLabel ?? "Recorded results"}: ${value(first.value)} → ${value(last.value)}${card.trendUnit === "%" ? "%" : card.trendUnit ? ` ${card.trendUnit}` : ""} · ${points.length} tests`];
    dates = `Results: ${windowLabel(first.date, last.date)}`;
  }
  const caveats = (card.footerNotes ?? []).filter(note => /SLG \/ ISO|wOBAcon|PAC Production\+|Percentiles compare/.test(note));
  if (card.kind === "arsenal") caveats.push("Fall averages are count-weighted; latest averages use the verified fallback. Spin is descriptive.");
  return [title, card.kind === "dashboard" ? card.subtitle : "", card.kicker ?? "", ...lines, dates, ...caveats, "https://pacubaseballperformance.com"].filter(Boolean).join("\n");
}
