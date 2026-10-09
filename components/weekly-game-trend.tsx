import { Sparkline } from "@/components/charts/sparkline";
import { StatInfo } from "@/components/stat-info";
import { gameValue } from "@/lib/game-metrics";
import { gameSampleText } from "@/lib/game-opportunities";
import { gameOverviewMetrics } from "@/lib/game-overview";
import type { GameWeek } from "@/lib/game-weeks";

const HITTING = ["qpa_pct", "batting_avg", "batting_obp", "batting_est_slg", "batting_est_iso", "batting_k_pct"];
const PITCHING = ["pitching_whip", "pitching_k_bb", "pitching_r9", "strike_pct", "pitching_k9"];

type Line = { week: number; label: string; detail: string; values: Map<string, { value: number; unit: string; label: string; sample: string | null; direction: string }> };
/** Rates for one week from that week's counts only, with the same definitions as the Fall totals. */
function lines(weeks: readonly GameWeek[], athleteId: string): Line[] {
  return weeks.flatMap(week => {
    const rows = week.rows.map(row => ({ ...row, athlete_id: athleteId }));
    if (!rows.length) return [];
    const values = new Map(gameOverviewMetrics(rows, []).map(item => [item.metric, { value: item.value, unit: item.unit, label: item.label, sample: gameSampleText(item.source, item.metric, item.opportunities), direction: item.direction }]));
    return values.size ? [{ week: week.week, label: week.label, detail: week.detail, values }] : [];
  });
}

function Table({ title, metrics, data }: { title: string; metrics: string[]; data: Line[] }) {
  const shown = metrics.filter(metric => data.some(line => line.values.has(metric)));
  if (!shown.length) return null;
  return <div className="mt-3"><h3 className="m-0 text-base font-bold">{title}</h3>
    <div className="table-wrap mt-2"><table><thead><tr><th>Stat</th>{data.map(line => <th key={line.week} className="text-right" title={line.detail}>{line.label}</th>)}<th className="text-right">Trend</th></tr></thead>
      <tbody>{shown.map(metric => { const label = data.map(line => line.values.get(metric)?.label).find(Boolean)!;
        const points = data.flatMap(line => { const v = line.values.get(metric); return v ? [{ date: String(line.week), value: v.value }] : []; });
        const direction = data.map(line => line.values.get(metric)?.direction).find(Boolean);
        return <tr key={metric} data-week-metric={metric}><th scope="row" className="font-semibold">{label}<StatInfo metric={metric} label={label}/></th>
          {data.map(line => { const v = line.values.get(metric); return <td key={line.week} className="text-right tabular-nums">{v ? <><strong>{gameValue(v.value, v.unit)}</strong>{v.sample && <small className="block text-xs text-[var(--text-secondary)]">{v.sample}</small>}</> : "—"}</td>; })}
          <td className="text-right">{points.length >= 2 ? <Sparkline points={points} width={90} height={28} label={`${label} by week`} direction={direction === "lower" ? "lower" : direction === "higher" ? "higher" : "neutral"} format={value => gameValue(value, data.map(line => line.values.get(metric)?.unit).find(Boolean) ?? "")} noun="weeks"/> : <span className="text-xs text-[var(--text-secondary)]">—</span>}</td></tr>; })}</tbody></table></div></div>;
}

export function WeeklyGameTrend({ weeks, athleteId }: { weeks: { hitting: GameWeek[]; pitching: GameWeek[] } | null; athleteId: string }) {
  if (!weeks) return null;
  const hitting = lines(weeks.hitting, athleteId), pitching = lines(weeks.pitching, athleteId);
  if (!hitting.length && !pitching.length) return null;
  return <section className="mt-5 rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-panel)] p-4 sm:p-5" aria-label="Week by week game stats" data-testid="weekly-game-trend">
    <h2 className="m-0 text-xl font-bold">Week by Week</h2>
    <p className="muted mb-0 mt-1 text-xs">Each column uses only that week&apos;s games. Pitching weeks are the sheet&apos;s weekly blocks; hitting weeks are the change between saved QPA sheet versions ({weeks.hitting.map(week => `${week.label}: ${week.detail.replace("Sheet changes saved ", "")}`).join(" · ")}).</p>
    <Table title="Hitting" metrics={HITTING} data={hitting}/>
    <Table title="Pitching" metrics={PITCHING} data={pitching}/>
    <p className="muted mb-0 mt-2 text-xs">One week is a small sample; a single game can swing these rates.</p>
  </section>;
}
