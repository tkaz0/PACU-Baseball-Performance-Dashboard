"use client";

import { pitchSourceLabel } from "@/lib/pitch-display";
import { useId, useState } from "react";
import type { ProfileTrend } from "@/lib/profile-trends";
import { formatHeight, formatMetricNumber } from "@/lib/measurement-display";
import { profileTrendAnnotationScope, trendAnnotationsInRange, trendAnnotationCategoryLabel, type TrendAnnotation } from "@/lib/trend-annotations";

const dateLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
export function ProfileTrendChart({ series, annotations = [] }: { series: ProfileTrend[]; annotations?: TrendAnnotation[] }) {
  const identity = (item: ProfileTrend) => JSON.stringify([item.key, item.source, item.unit, item.period]);
  const [selected, setSelected] = useState(series[0] ? identity(series[0]) : "");
  const id = useId();
  const trend = series.find(item => identity(item) === selected) ?? series[0];
  if (!trend) return null;
  const first = trend.points[0], last = trend.points.at(-1)!;
  const markers = trendAnnotationsInRange(annotations, trend.points.map(point => point.date), profileTrendAnnotationScope(trend.key, trend.source));
  const markerDates = [...new Set(markers.map(marker => marker.date))];
  const values = trend.points.map(p => p.value), low = Math.min(...values), high = Math.max(...values);
  const padding = Math.max((high - low) * .2, high * .025, .1), min = Math.max(0, low - padding), max = high + padding;
  const x = (date: string) => 55 + (Date.parse(date) - Date.parse(first.date)) / (Date.parse(last.date) - Date.parse(first.date)) * 350;
  const y = (value: number) => 175 - (value - min) / (max - min) * 145;
  const format = (value: number) => trend.key === "height" ? formatHeight(value, trend.unit) : `${formatMetricNumber(value,trend.key,trend.source,String(Number(value.toFixed(2))))} ${trend.unit}`;
  return <section className="rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-panel)] p-4 sm:p-5" aria-label="Testing progress chart">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="m-0 text-lg font-bold">Testing Progress</h2><p className="muted mb-0 mt-1 text-xs">{trend.period} · {trend.points.length} test dates · {pitchSourceLabel(trend.source)}</p></div><div><label className="sr-only" htmlFor={id}>Chart measurement</label><select id={id} className="max-w-full text-sm" value={identity(trend)} onChange={e => setSelected(e.target.value)}>{series.map(item => <option key={identity(item)} value={identity(item)}>{item.label}{series.filter(s => s.key === item.key).length > 1 ? ` · ${pitchSourceLabel(item.source)} · ${item.unit}` : ""}</option>)}</select></div></div>
    <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2"><p className="m-0 text-sm font-semibold">{trend.label}</p><p className="m-0 text-sm tabular-nums">{format(first.value)} <span className="muted mx-1">→</span> <strong>{format(last.value)}</strong></p></div>
    <svg viewBox="0 0 430 210" className="mt-2 block w-full" style={{ maxHeight: 250 }} role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>{`${trend.label} by test date`}</title><desc id={`${id}-desc`}>{trend.points.length} recorded tests from {first.date} to {last.date}. {format(first.value)} to {format(last.value)}. Vertical scale is zoomed to the recorded range. Displayed values follow in chart data.</desc>
      {[min, (min + max) / 2, max].map(tick => <g key={tick}><line x1="55" x2="405" y1={y(tick)} y2={y(tick)} stroke="var(--line-subtle)"/><text x="47" y={y(tick) + 4} textAnchor="end" fill="var(--text-secondary)" fontSize="15">{formatMetricNumber(tick,trend.key,trend.source,String(Number(tick.toFixed(1))))}</text></g>)}
      {markerDates.map(date => <g key={`note-${date}`}><title>{`${date}: ${markers.filter(marker => marker.date === date).map(marker => `${trendAnnotationCategoryLabel(marker.category)} — ${marker.note}`).join("; ")}. Coaching context only; no measured result is implied.`}</title><line x1={x(date)} x2={x(date)} y1="26" y2="175" stroke="var(--accent-readable)" strokeWidth="1" strokeDasharray="3 4" opacity=".5"/><path d={`M ${x(date)} 24 l -5 -7 h 10 Z`} fill="var(--accent-readable)"/></g>)}
      <polyline points={trend.points.map(p => `${x(p.date)},${y(p.value)}`).join(" ")} fill="none" stroke="#c84959" strokeWidth="3" strokeLinejoin="round"/>
      {trend.points.map(p => <circle key={p.date} cx={x(p.date)} cy={y(p.value)} r="4" fill="#c84959" stroke="var(--surface-panel)" strokeWidth="2"><title>{`${p.date}: ${format(p.value)}`}</title></circle>)}
      <text x="55" y="200" fill="var(--text-secondary)" fontSize="15">{dateLabel(first.date)}</text><text x="405" y="200" textAnchor="end" fill="var(--text-secondary)" fontSize="15">{dateLabel(last.date)}</text>
    </svg>
    {!!markers.length && <details className="mb-3 rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-raised)] p-3 text-xs"><summary className="cursor-pointer font-semibold text-[var(--accent-readable)]">Coaching Notes in This Chart · {markers.length}</summary><p className="muted mb-2 mt-2">Dashed date markers show coaching context. They do not measure a result or prove what caused a change.</p><ul className="m-0 grid list-none gap-2 p-0">{markers.map(marker => <li key={marker.id} className="min-w-0 border-t border-[var(--line-subtle)] pt-2"><strong>{dateLabel(marker.date)} · {trendAnnotationCategoryLabel(marker.category)}</strong><p className="mb-0 mt-1 break-words leading-5">{marker.note}</p></li>)}</ul></details>}
    <div className="flex flex-wrap justify-between gap-2 text-xs text-[var(--text-secondary)]"><span>{trend.unit} · Zoomed vertical scale · Lines connect recorded tests</span><details><summary className="cursor-pointer font-semibold">Chart Data</summary><table className="mt-2"><caption className="sr-only">{trend.label} chart values</caption><thead><tr><th scope="col">Test Date</th><th scope="col">Result</th></tr></thead><tbody>{trend.points.map(p => <tr key={p.date}><td>{p.date}</td><td>{format(p.value)}</td></tr>)}</tbody></table></details></div>
  </section>;
}
