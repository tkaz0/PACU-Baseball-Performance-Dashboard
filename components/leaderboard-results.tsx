import Link from "next/link";
import type { PlayerMetricDefinition } from "@/lib/player-performance";
import { leaderboardMetricLabel, leaderboardSourceLabel, leaderboardTestDate, type LeaderboardRow } from "@/lib/leaderboards";
import { formatHeight } from "@/lib/measurement-display";

function ResultValue({ row, metric, unit }: { row: LeaderboardRow; metric: PlayerMetricDefinition; unit: string }) {
  const height = metric.key === "height" ? formatHeight(row.value, unit) : null;
  if (height) return <span className="whitespace-nowrap" title={`Recorded: ${String(row.value)} ${unit}`}>{height}</span>;
  return <>{row.derived
    ? <span title={`Exact calculated value: ${String(row.value)} ${unit}; calculated from same-report muscle and weight`}>≈{row.value.toLocaleString("en-US", { maximumFractionDigits: 1 })}</span>
    : <span className="break-all">{String(row.value)}</span>}{unit !== "ratio" && <span className="muted ml-1 text-xs font-medium">{unit}</span>}</>;
}

function RankingTable({ rows, metric, unit, continued = false }: { rows: LeaderboardRow[]; metric: PlayerMetricDefinition; unit: string; continued?: boolean }) {
  const neutral = metric.direction === "neutral";
  return <div className="table-wrap"><table>
    <caption className="sr-only">{leaderboardMetricLabel(metric)} team results{continued ? ", continued" : ""}; recorded in {unit}</caption>
    <thead className="sr-only"><tr>{!neutral && <th scope="col">Place</th>}<th scope="col">Athlete and Last Tested</th><th scope="col">Result</th></tr></thead>
    <tbody>{rows.map(row => <tr key={row.athleteCode}>
      {!neutral && <td className="w-10 !py-3 !pr-0 align-top"><span className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold ${row.rank === 1 ? "bg-[#990000] text-white" : "bg-[var(--surface-raised)] text-[var(--text-secondary)]"}`}>{row.rank}</span></td>}
      <td className="!py-3 !pr-2"><span className="block [overflow-wrap:anywhere] text-sm font-semibold leading-snug">{row.profileId ? <Link href={`/athletes/${row.profileId}`} prefetch={false}>{row.name}</Link> : row.name}</span>
        <span className="muted mt-1 block text-[11px]">{row.jerseyNumber !== null ? `#${row.jerseyNumber}` : row.athleteCode}{row.position ? ` · ${row.position}` : ""} · <time dateTime={row.measuredAt}>{leaderboardTestDate(row.measuredAt)}</time></span>
      </td>
      <td className="!py-3 !pl-2 text-right align-top font-semibold tabular-nums"><ResultValue row={row} metric={metric} unit={unit} /></td>
    </tr>)}</tbody>
  </table></div>;
}

export function LeaderboardResults({ rows, metric, unit, source }: { rows: LeaderboardRow[]; metric: PlayerMetricDefinition; unit: string; source?: string }) {
  const neutral = metric.direction === "neutral";
  const latestDate = rows.reduce((latest, row) => row.measuredAt > latest ? row.measuredAt : latest, "");
  return <section className="panel min-w-0 self-start overflow-hidden">
    <div className="border-b border-[var(--line-subtle)] p-5">
      <div className="flex items-start justify-between gap-3"><h2 className="mb-0 text-base font-bold">{leaderboardMetricLabel(metric)}</h2><span className="muted shrink-0 rounded-full bg-[var(--surface-raised)] px-2.5 py-1 text-[11px] font-semibold">{rows.length} {rows.length === 1 ? "Athlete" : "Athletes"}</span></div>
      {rows.length > 0 && <><p className="muted mb-0 mt-2 text-xs">{source ? `${leaderboardSourceLabel(source)} · ` : ""}Last Tested {leaderboardTestDate(latestDate)}</p><p className="muted mb-0 mt-1 text-[11px]" title={neutral ? "Numerical comparisons, not a health or performance rating." : "Latest comparable result per athlete; equal values share a place."}>{metric.direction === "lower" ? "Low to High" : "High to Low"}{neutral ? " · Numerical Comparison" : ""}</p></>}
    </div>
    {rows.length ? <><RankingTable rows={rows.slice(0, 10)} metric={metric} unit={unit} />{rows.length > 10 && <details className="border-t border-[var(--line-subtle)]"><summary className="cursor-pointer px-5 py-3 text-sm font-semibold text-[var(--accent-readable)]">Show {rows.length - 10} More</summary><RankingTable rows={rows.slice(10)} metric={metric} unit={unit} continued /></details>}</>
      : <p className="muted m-0 p-6 text-sm">Results will appear after testing data is added.</p>}
  </section>;
}
