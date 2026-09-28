"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, Grid2X2, Plus, RotateCcw, X } from "lucide-react";
import { ANALYTICS_GROUPS, analyticsVariables, analyticsVariableGroup, readingsForPeriod, type AnalyticsDataset } from "@/lib/analytics";
import { correlationColor, correlationMap, correlationScatterUrl, defaultMapVariables, MAX_MAP_VARIABLES } from "@/lib/correlation-map";
import { StatInfo } from "@/components/stat-info";
import styles from "./correlation-map.module.css";

export function CorrelationMap({ data }: { data: AnalyticsDataset }) {
  const [period, setPeriod] = useState<"fall" | "earlier">("fall");
  const [choices, setChoices] = useState<string[] | null>(null);
  const [gap, setGap] = useState(30);
  const [pair, setPair] = useState<[string, string] | null>(null);
  const readings = useMemo(() => readingsForPeriod(data.readings, period), [data.readings, period]);
  const variables = useMemo(() => analyticsVariables(readings), [readings]);
  const keys = useMemo(() => (choices ?? defaultMapVariables(variables)).filter(key => variables.some(v => v.key === key)), [choices, variables]);
  const grid = useMemo(() => correlationMap(data.players, readings, keys, gap), [data.players, readings, keys, gap]);
  const selected = grid.flat().find(cell => pair && cell.x.key === pair[0] && cell.y.key === pair[1]);
  const comparable = grid.flat().filter((cell, index) => Math.floor(index / grid.length) > index % grid.length && cell.r !== null);
  function changeKeys(next: string[]) { setChoices(next); setPair(null); }
  const letters = "ABCDEFGH";
  const hasLabelCollision = (label:string) => variables.filter(v=>v.label===label).length>1;
  return <div className={styles.layout}>
    <section className={`panel ${styles.setup}`} aria-label="Correlation map controls">
      <div className={styles.setupTop}><div><h2>Map Settings</h2><p>Compare 2–8 stats for players with both results.</p></div><button className="btn btn-secondary" onClick={() => { setChoices(null); setPair(null); setPeriod("fall"); setGap(30); }}><RotateCcw size={15} />Reset</button></div>
      <div className={styles.scope}><label>Testing Period<select value={period} onChange={e => { setPeriod(e.target.value as "fall" | "earlier"); setChoices(null); setPair(null); }}><option value="fall">Fall 2026</option><option value="earlier">June–August 2026 · Body</option></select></label><label>Results Within<select value={gap} onChange={e => { setGap(Number(e.target.value)); setPair(null); }}><option value={0}>Same Day</option><option value={7}>7 Days</option><option value={30}>30 Days</option><option value={90}>90 Days</option><option value={366}>Any Date in This Period</option></select></label></div>
      <details className={styles.statPicker}><summary>Choose Stats<span>{keys.length} Selected</span></summary><div className={styles.choices}>{keys.map((key, index) => <div className={styles.choice} key={`${index}:${key}`}><span className={styles.letter}>{letters[index]}</span><label><span className="sr-only">Stat {letters[index]}</span><select value={key} onChange={e => changeKeys(keys.map((value, at) => at === index ? e.target.value : value))}>{ANALYTICS_GROUPS.map(group => { const options = variables.filter(v => analyticsVariableGroup(v) === group); return options.length ? <optgroup label={group} key={group}>{options.map(v => <option key={v.key} value={v.key} disabled={v.key !== key && keys.includes(v.key)}>{v.label}{variables.filter(other => other.label === v.label).length > 1 ? ` · ${v.unit} · ${v.source}` : ""}</option>)}</optgroup> : null; })}</select></label><button type="button" className={styles.remove} aria-label={`Remove stat ${letters[index]}`} disabled={keys.length <= 2} onClick={() => changeKeys(keys.filter((_, at) => at !== index))}><X size={15} /></button></div>)}</div>
      {keys.length < Math.min(MAX_MAP_VARIABLES, variables.length) && <button className={`btn btn-secondary ${styles.add}`} onClick={() => { const next = variables.find(v => !keys.includes(v.key)); if (next) changeKeys([...keys, next.key]); }}><Plus size={15} />Add a Stat</button>}</details>
    </section>
    {grid.length < 2 ? <section className={`panel ${styles.empty}`}><Grid2X2 size={34} /><h2>Waiting for Comparable Results</h2><p>The map becomes available when at least two stats have been recorded.</p></section> : <section className={`panel ${styles.mapPanel}`} aria-label="Team correlation map">
      <header className={styles.mapHeader}><div><h2>Team Connections</h2><p>{comparable.length} measured pairs · {period === "fall" ? "Fall 2026" : "June–August 2026"}</p></div><span className={styles.about}>Pearson r<StatInfo metric="pearson_r" label="Pearson r" /></span></header>
      <div className={styles.legend}><span><i className={styles.blue} />Move Opposite Ways</span><span>Near 0: Little Straight-Line Connection</span><span><i className={styles.red} />Move Together</span></div>
      <div className={styles.mapScroll}><table className={styles.map}><caption className="sr-only">Pearson correlation for each selected pair; n is the number of matching players. Blank scores need at least five players with varied results.</caption><thead><tr><th scope="col"><span className="sr-only">Stat</span></th>{grid[0].map((cell, col) => <th key={cell.x.key} scope="col"><span className={styles.letter}>{letters[col]}</span><span title={`${cell.x.source} · ${cell.x.unit}`}>{cell.x.label}{hasLabelCollision(cell.x.label)&&<small className={styles.axisSource}>{cell.x.source} · {cell.x.unit}</small>}</span></th>)}</tr></thead><tbody>{grid.map((row, r) => <tr key={row[0].y.key}><th scope="row"><span className={styles.letter}>{letters[r]}</span><span title={`${row[0].y.source} · ${row[0].y.unit}`}>{row[0].y.label}{hasLabelCollision(row[0].y.label)&&<small className={styles.axisSource}>{row[0].y.source} · {row[0].y.unit}</small>}</span></th>{row.map(cell => <td key={cell.x.key}>{cell.same ? <span className={styles.diagonal} aria-label="Same stat">—</span> : <button type="button" className={styles.cell} style={{ background: correlationColor(cell.r) }} data-strong={cell.r !== null && Math.abs(cell.r) >= .65} aria-pressed={selected?.x.key === cell.x.key && selected?.y.key === cell.y.key} aria-label={`${cell.y.label} and ${cell.x.label}: ${cell.r === null ? "correlation unavailable" : `r ${cell.r.toFixed(2)}`}, ${cell.count} players`} onClick={() => setPair([cell.x.key, cell.y.key])}><strong>{cell.r === null ? "—" : `${cell.r > 0 ? "+" : ""}${cell.r.toFixed(2)}`}</strong><small>n = {cell.count}</small></button>}</td>)}</tr>)}</tbody></table></div>
      <p className={styles.mobileHint}>Swipe the map sideways to see every stat.</p>
      <div className={styles.detail} aria-live="polite">{selected ? <><div><h3>{selected.y.label} &amp; {selected.x.label}</h3><p>{selected.r === null ? "At least five matching players with varied results are needed for a correlation." : `${selected.count} players · r ${selected.r.toFixed(2)} · R² ${selected.rSquared!.toFixed(2)}`}</p><p className={styles.units}><span>{selected.x.label}: {selected.x.source} · {selected.x.unit}</span><span>{selected.y.label}: {selected.y.source} · {selected.y.unit}</span>{selected.r !== null && selected.count < 8 ? " · Small group: one unusual result can strongly change the score." : ""}</p></div><Link className="btn btn-primary" href={correlationScatterUrl(selected, period, gap)}>See the Players<ArrowUpRight size={16} /></Link></> : <p>Select a square to open that pair’s scatterplot and see the players behind it.</p>}</div>
      <p className={styles.caution}>Color shows direction, not good or bad. A connection does not prove cause. Related stats from the same report can share inputs, and small groups can produce strong-looking scores.</p>
    </section>}
  </div>;
}
