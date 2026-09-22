"use client";
import { useId, useState } from "react";
import type { ProfileTrend } from "@/lib/profile-trends";
import { formatHeight, formatMetricNumber } from "@/lib/measurement-display";

const dateLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
export function ProfileTrendChart({ series }: { series: ProfileTrend[] }) {
  const identity = (item: ProfileTrend) => JSON.stringify([item.key, item.source, item.unit, item.period]);
  const [selected, setSelected] = useState(series[0] ? identity(series[0]) : "");
  const id = useId();
  const trend = series.find(item => identity(item) === selected) ?? series[0];
  if (!trend) return null;
  const first = trend.points[0], last = trend.points.at(-1)!;
  const values = trend.points.map(p => p.value), low = Math.min(...values), high = Math.max(...values);
  const padding = Math.max((high - low) * .2, high * .025, .1), min = Math.max(0, low - padding), max = high + padding;
  const x = (date: string) => 55 + (Date.parse(date) - Date.parse(first.date)) / (Date.parse(last.date) - Date.parse(first.date)) * 350;
  const y = (value: number) => 175 - (value - min) / (max - min) * 145;
  const format = (value: number) => trend.key === "height" ? formatHeight(value, trend.unit) : `${formatMetricNumber(value,trend.key,trend.source,String(Number(value.toFixed(2))))} ${trend.unit}`;
  return <section className="rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-panel)] p-4 sm:p-5" aria-label="Testing progress chart">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="m-0 text-lg font-bold">Testing Progress</h2><p className="muted mb-0 mt-1 text-xs">{trend.period} · {trend.points.length} test dates · {trend.source}</p></div><div><label className="sr-only" htmlFor={id}>Chart measurement</label><select id={id} className="max-w-full text-sm" value={identity(trend)} onChange={e => setSelected(e.target.value)}>{series.map(item => <option key={identity(item)} value={identity(item)}>{item.label}{series.filter(s => s.key === item.key).length > 1 ? ` · ${item.source} · ${item.unit}` : ""}</option>)}</select></div></div>
    <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2"><p className="m-0 text-sm font-semibold">{trend.label}</p><p className="m-0 text-sm tabular-nums">{format(first.value)} <span className="muted mx-1">→</span> <strong>{format(last.value)}</strong></p></div>
    <svg viewBox="0 0 430 210" className="mt-2 block w-full" style={{ maxHeight: 250 }} role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>{trend.label} by test date</title><desc id={`${id}-desc`}>{trend.points.length} recorded tests from {first.date} to {last.date}. {format(first.value)} to {format(last.value)}. Vertical scale is zoomed to the recorded range. Displayed values follow in chart data.</desc>
      {[min, (min + max) / 2, max].map(tick => <g key={tick}><line x1="55" x2="405" y1={y(tick)} y2={y(tick)} stroke="var(--line-subtle)"/><text x="47" y={y(tick) + 4} textAnchor="end" fill="var(--text-secondary)" fontSize="15">{formatMetricNumber(tick,trend.key,trend.source,String(Number(tick.toFixed(1))))}</text></g>)}
      <polyline points={trend.points.map(p => `${x(p.date)},${y(p.value)}`).join(" ")} fill="none" stroke="#c84959" strokeWidth="3" strokeLinejoin="round"/>
      {trend.points.map(p => <circle key={p.date} cx={x(p.date)} cy={y(p.value)} r="4" fill="#c84959" stroke="var(--surface-panel)" strokeWidth="2"><title>{`${p.date}: ${format(p.value)}`}</title></circle>)}
      <text x="55" y="200" fill="var(--text-secondary)" fontSize="15">{dateLabel(first.date)}</text><text x="405" y="200" textAnchor="end" fill="var(--text-secondary)" fontSize="15">{dateLabel(last.date)}</text>
    </svg>
    <div className="flex flex-wrap justify-between gap-2 text-[11px] text-[var(--text-secondary)]"><span>{trend.unit} · Zoomed vertical scale · Lines connect recorded tests</span><details><summary className="cursor-pointer font-semibold">Chart Data</summary><table className="mt-2"><caption className="sr-only">{trend.label} chart values</caption><thead><tr><th scope="col">Test Date</th><th scope="col">Result</th></tr></thead><tbody>{trend.points.map(p => <tr key={p.date}><td>{p.date}</td><td>{format(p.value)}</td></tr>)}</tbody></table></details></div>
  </section>;
}
