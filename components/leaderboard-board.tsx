import Link from "next/link";
import { LeaderboardNavigation } from "@/components/leaderboard-navigation";
import { Trophy } from "lucide-react";
import { LeaderboardResults } from "@/components/leaderboard-results";
import { LEADERBOARD_METRICS, isPitchLeaderboardMetric, leaderboardPitchType, leaderboardGroupLabels, leaderboardMetrics, type LeaderboardComparison, type LeaderboardGroup, type LeaderboardRow, type LeaderboardSession } from "@/lib/leaderboards";

export type LeaderboardPanel = { comparison: LeaderboardComparison; rows: LeaderboardRow[] };

export function LeaderboardBoard({ group, panels, session = "in_game" }: { group: LeaderboardGroup; panels: LeaderboardPanel[]; session?: LeaderboardSession }) {
  const populated = panels.filter(panel => panel.rows.length > 0 && leaderboardMetrics(group).some(metric => metric.key === panel.comparison.metricKey));

  const general = populated.filter(panel => !isPitchLeaderboardMetric(panel.comparison.metricKey));
  const pitchOrder = ["Fastball", "Four-Seam Fastball", "Two-Seam Fastball", "Sinker", "Cutter", "Slider", "Sweeper", "Curveball", "Breaking Ball", "Changeup", "Splitter", "Knuckleball", "Other"];
  const pitches = new Map<string, LeaderboardPanel[]>();
  for (const panel of populated.filter(panel => isPitchLeaderboardMetric(panel.comparison.metricKey))) {
    const key = JSON.stringify([panel.comparison.source, panel.comparison.period]);
    pitches.set(key, [...(pitches.get(key) ?? []), panel]);
  }
  const results = ({ comparison, rows }: LeaderboardPanel) => <LeaderboardResults key={JSON.stringify(comparison)} rows={rows} metric={LEADERBOARD_METRICS.find(metric => metric.key === comparison.metricKey)!} unit={comparison.unit} source={comparison.source} period={comparison.period} />;
  return <>
    <LeaderboardNavigation group={group} />
    {group !== "physicality" && <nav aria-label="Leaderboard session" className="leaderboard-navigation mb-5">{(["in_game", "practice"] as const).map(kind => <Link key={kind} href={`/leaderboards?group=${group}&session=${kind}`} aria-current={session === kind ? "page" : undefined}>{kind === "in_game" ? "In-game" : "Practice"}</Link>)}</nav>}
    {populated.length > 0 ? <div className="space-y-8">
      {general.length > 0 && <section aria-label="Session measurements"><div className="leaderboard-grid">{general.map(results)}</div></section>}
      {[...pitches].sort(([a,ap],[b,bp])=>pitchOrder.indexOf(leaderboardPitchType(ap[0].comparison.source)!) - pitchOrder.indexOf(leaderboardPitchType(bp[0].comparison.source)!) || a.localeCompare(b)).map(([key, entries]) => <section key={key} aria-label={`${leaderboardPitchType(entries[0].comparison.source)} pitch rankings`}>
        <header className="mb-4"><h2 className="m-0 text-xl font-bold">{leaderboardPitchType(entries[0].comparison.source)}</h2><p className="muted mb-0 mt-1 text-sm">Velocity &amp; Spin · {entries[0].comparison.source.toLowerCase().includes("intrasquad") ? "Intrasquad" : session === "in_game" ? "Game" : "Practice"} · Latest Session per Player</p></header>
        <div className="leaderboard-grid">{entries.map(results)}</div>
      </section>)}
    </div> : <section className="panel px-6 py-10 text-center sm:py-14"><span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-raised)] text-xs font-bold text-[var(--accent-readable)]"><Trophy size={23} aria-hidden="true" /></span><h2 className="mb-2 text-xl font-bold">No {leaderboardGroupLabels[group]} Results Yet</h2><p className="muted mx-auto mb-0 max-w-md text-sm">{group !== "physicality" ? `${session === "practice" ? "Practice" : "In-game"} rankings will appear after reviewed sessions are added.` : "Rankings will appear here as testing results are added."}</p></section>}

    {populated.length > 0 && <details className="mt-6 text-xs text-[var(--text-secondary)]"><summary className="w-fit cursor-pointer font-medium">About These Rankings</summary><div className="mt-3 max-w-3xl space-y-2 leading-relaxed"><p>Each table uses the latest result per athlete from the same source, unit and testing period. Fall 2026 results are shown first; earlier body readings remain available when Fall results have not been recorded. Every reading shows its test date.</p><p>Where several comparisons exist, the table with the most measured athletes is shown, with the preferred recorded unit and source name used to break ties. Sources, units and testing periods are never combined. In-game and Practice stay separate. Each recorded pitch type has its own velocity and spin rankings; fastball subtypes are not combined. Pitch averages and maxima come from each player’s latest comparable session, not a cumulative average across sessions. Height is displayed in feet and inches while its original unit remains separate for comparisons.</p><p>Height ranks tallest first, total Muscle Mass highest first, and Body Fat % lowest first. Only measured active and redshirt members of the 2026–27 roster appear. Equal results share a rank, such as 1, 1, 3. Body and spin values are numerical comparisons, not health or performance ratings.</p></div></details>}
  </>;
}
