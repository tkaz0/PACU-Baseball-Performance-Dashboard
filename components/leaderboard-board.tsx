import { pitchTypeLabel } from "@/lib/imports/pitch-assignments";
import Link from "next/link";
import { LeaderboardPitchSelector } from "@/components/leaderboard-pitch-selector";
import { LeaderboardNavigation } from "@/components/leaderboard-navigation";
import { Trophy } from "lucide-react";
import { LeaderboardResults } from "@/components/leaderboard-results";
import { ALL_PITCHES, LEADERBOARD_METRICS, PITCH_LEADERBOARD_KEYS, isPitchLeaderboardMetric, leaderboardPitchType, leaderboardGroupLabels, leaderboardMetrics, leaderboardSourceLabel, selectPitchLeaderboards, type LeaderboardComparison, type LeaderboardGroup, type LeaderboardRow, type LeaderboardSession } from "@/lib/leaderboards";

export type LeaderboardPanel = { comparison: LeaderboardComparison; rows: LeaderboardRow[] };

export function LeaderboardBoard({ group, panels, session = "in_game", pitches = [], selectedPitch = ALL_PITCHES }: { group: LeaderboardGroup; panels: LeaderboardPanel[]; session?: LeaderboardSession; pitches?: readonly string[]; selectedPitch?: string }) {
  const populated = panels.filter(panel => panel.rows.length > 0 && (group !== "pitching" || Boolean(leaderboardPitchType(panel.comparison.source)) && (selectedPitch === ALL_PITCHES || leaderboardPitchType(panel.comparison.source) === selectedPitch)) && leaderboardMetrics(group).some(metric => metric.key === panel.comparison.metricKey));

  const general = populated.filter(panel => !isPitchLeaderboardMetric(panel.comparison.metricKey));
  const pitchPanels = new Map<string, LeaderboardPanel[]>();
  for (const panel of populated.filter(panel => isPitchLeaderboardMetric(panel.comparison.metricKey))) {
    const key = JSON.stringify([panel.comparison.source, panel.comparison.period]);
    pitchPanels.set(key, [...(pitchPanels.get(key) ?? []), panel]);
  }
  const pitchOrder = selectPitchLeaderboards(populated.map(panel => panel.comparison)).pitches;
  const pitchGroups = [...pitchPanels].sort(([, a], [, b]) => pitchOrder.indexOf(leaderboardPitchType(a[0].comparison.source)!) - pitchOrder.indexOf(leaderboardPitchType(b[0].comparison.source)!) || a[0].comparison.source.localeCompare(b[0].comparison.source) || a[0].comparison.period.localeCompare(b[0].comparison.period));
  const groupContext = (comparison: LeaderboardComparison) => `${leaderboardSourceLabel(comparison.source.split(" · ").slice(0, -1).join(" · "))} · ${comparison.period === "fall_2026" ? "Fall 2026" : "Jun–Aug 2026"}`;
  const results = ({ comparison, rows }: LeaderboardPanel) => <LeaderboardResults key={JSON.stringify(comparison)} rows={rows} metric={LEADERBOARD_METRICS.find(metric => metric.key === comparison.metricKey)!} unit={comparison.unit} source={comparison.source} period={comparison.period} />;
  return <>
    <LeaderboardNavigation group={group} />
    {group !== "physicality" && <nav aria-label="Leaderboard session" className="leaderboard-navigation mb-5">{(["in_game", "practice"] as const).map(kind => <Link key={kind} href={`/leaderboards?group=${group}&session=${kind}${group === "pitching" && selectedPitch !== ALL_PITCHES ? `&pitch=${encodeURIComponent(selectedPitch)}` : ""}`} aria-current={session === kind ? "page" : undefined}>{kind === "in_game" ? "In-Game" : "Practice"}</Link>)}</nav>}
    {group === "pitching" && pitches.length > 0 && <header className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><h2 className="m-0 text-xl font-bold">Pitch Arsenal</h2><p className="muted mb-0 mt-1 text-sm">Average &amp; max velocity and spin · By pitch</p></div>
      <LeaderboardPitchSelector key={`${session}:${selectedPitch}`} pitches={pitches} selectedPitch={selectedPitch} session={session} />
    </header>}
    {populated.length > 0 ? <div className="space-y-8">
      {general.length > 0 && <section aria-label="Session measurements"><div className="leaderboard-grid">{general.map(results)}</div></section>}
      {pitchGroups.map(([key, entries]) => <section key={key} aria-label={`${pitchTypeLabel(leaderboardPitchType(entries[0].comparison.source)!)} · ${groupContext(entries[0].comparison)} rankings`}>
        <header className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-[var(--line-subtle)] pb-3"><h3 className="m-0 text-lg font-bold">{pitchTypeLabel(leaderboardPitchType(entries[0].comparison.source)!)}</h3><p className="muted m-0 text-xs font-medium">{groupContext(entries[0].comparison)}</p></header>
        <div className="leaderboard-grid pitch-leaderboard-grid">{[...entries].sort((a,b) => PITCH_LEADERBOARD_KEYS.indexOf(a.comparison.metricKey as typeof PITCH_LEADERBOARD_KEYS[number]) - PITCH_LEADERBOARD_KEYS.indexOf(b.comparison.metricKey as typeof PITCH_LEADERBOARD_KEYS[number])).map(results)}</div>
      </section>)}
    </div> : <section className="panel px-6 py-10 text-center sm:py-14"><span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-raised)] text-xs font-bold text-[var(--accent-readable)]"><Trophy size={23} aria-hidden="true" /></span><h2 className="mb-2 text-xl font-bold">No {leaderboardGroupLabels[group]} Results Yet</h2><p className="muted mx-auto mb-0 max-w-md text-sm">{group === "throwing" ? "Infield and Outfield Velocity rankings will appear after throwing results are added." : group !== "physicality" ? `${session === "practice" ? "Practice" : "In-Game"} rankings will appear after reviewed sessions are added.` : "Rankings will appear here as testing results are added."}</p></section>}

    {populated.length > 0 && <details className="mt-6 text-xs text-[var(--text-secondary)]"><summary className="w-fit cursor-pointer font-medium">About These Rankings</summary><div className="mt-3 max-w-3xl space-y-2 leading-relaxed"><p>Fall 2026 results come first. Body and testing boards show the latest recorded result, while timed tests show each player’s best time. Full Swing maximums show the best saved Fall reading. Full Swing averages combine Fall sessions by their verified swing or pitch counts; when a count cannot be verified, the latest session remains visible instead. The count appears beside a result only when it is verified.</p><p>Different tests, units, Game, Intrasquad and Practice sessions stay separate. All recorded pitches appear by default; choose one pitch to focus its rankings. Four-seamers and other fastball types keep their own boards. Height appears in feet and inches.</p><p>Height ranks taller players first; muscle mass ranks higher totals first; body fat ranks lower percentages first. Ties share a place, such as 1, 1, 3. The colored bar shows a result against the top number on that board, not a percentile. Body and spin numbers are comparisons, not health grades or pitch-quality grades.</p></div></details>}
  </>;
}
