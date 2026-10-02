import type { ArsenalPitch } from "@/lib/pitch-arsenal";
import { PITCH_TYPES, pitchTypeLabel } from "@/lib/imports/pitch-assignments";
import { formatSourceNumber, formatSpin } from "@/lib/measurement-display";
import { StatInfo } from "@/components/stat-info";
import styles from "./pitch-arsenal-chart.module.css";

// Indexed by PITCH_TYPES: fastballs warm, breaking pitches in distinct cool hues, offspeed in greens.
const colors = ["#bb2634", "#6f83c5", "#bb2634", "#e07b39", "#d39630", "#a1773f", "#3979b7", "#2aa7b8", "#7a4fb5", "#4f9a5a", "#8fb84a", "#986d90", "#637688"];
type Shape = "circle" | "diamond" | "square";
/** Marker shape follows pitch family, so it means the same thing on every chart and in the legend. */
export const pitchShape = (type: string): Shape => ["Breaking Ball", "Slider", "Sweeper", "Curveball"].includes(type) ? "diamond" : ["Changeup", "Splitter", "Knuckleball"].includes(type) ? "square" : "circle";
function Marker({ shape, cx, cy, r, color }: { shape: Shape; cx: number; cy: number; r: number; color: string }) {
  if (shape === "circle") return <circle cx={cx} cy={cy} r={r} fill={color} stroke="var(--surface-panel)" strokeWidth="2"/>;
  if (shape === "square") return <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} rx="1.5" fill={color} stroke="var(--surface-panel)" strokeWidth="2"/>;
  return <path d={`M ${cx} ${cy - r * 1.25} L ${cx + r * 1.25} ${cy} L ${cx} ${cy + r * 1.25} L ${cx - r * 1.25} ${cy} Z`} fill={color} stroke="var(--surface-panel)" strokeWidth="2"/>;
}
/** Evenly spaced round-number ticks (e.g. every 2 mph or 250 RPM) inside [min, max]. */
function niceTicks(min: number, max: number, steps: readonly number[]): number[] {
  const step = steps.find(candidate => (max - min) / candidate <= 5) ?? steps[steps.length - 1];
  const ticks: number[] = []; for (let value = Math.ceil(min / step) * step; value <= max + 1e-9; value += step) ticks.push(value);
  return ticks;
}
export const pitchArsenalColor = (type: string) => colors[Math.max(0,PITCH_TYPES.indexOf(type as typeof PITCH_TYPES[number]))];

function extent(values: number[], step: number): [number, number] {
  const low = Math.min(...values), high = Math.max(...values);
  const padding = Math.max((high - low) * .16, step);
  const min = Math.max(0, Math.floor((low - padding) / step) * step);
  const max = Math.ceil((high + padding) / step) * step;
  return [min, max <= min ? min + step : max];
}

function ArsenalScatter({ pitches, scope }: { pitches: readonly ArsenalPitch[]; scope: "session" | "fall" }) {
  const points = pitches.filter(p => p.averageVelocity !== null && p.averageSpin !== null);
  if (!points.length) return <p className={styles.empty}>No pitch type has both an available speed and spin average yet.</p>;
  const [xMin, xMax] = extent(points.map(p => p.averageVelocity!), 2);
  const [yMin, yMax] = extent(points.map(p => p.averageSpin!), 100);
  const x = (value: number) => 62 + (value - xMin) / (xMax - xMin) * 340;
  const y = (value: number) => 210 - (value - yMin) / (yMax - yMin) * 174;
  return <figure className={styles.figure}>
    <figcaption><h4>Pitch Arsenal<StatInfo metric="pitch_arsenal_chart" label="Pitch Arsenal chart"/></h4><p>Each pitch type by average speed and spin{scope === "fall" ? " · Sample sizes are in the table above" : ""}</p></figcaption>
    <div className={styles.plotScroll}><svg viewBox="0 0 460 275" role="img" aria-label={`Pitch arsenal chart for ${points.length} classified pitch types. Velocity in miles per hour, spin in revolutions per minute.`}>
      {niceTicks(yMin, yMax, [100, 250, 500, 1000]).map(spin => <g key={`y${spin}`}><line x1="62" x2="402" y1={y(spin)} y2={y(spin)} stroke="var(--line-subtle)"/><text x="54" y={y(spin)+4} textAnchor="end" fill="var(--text-secondary)" fontSize="12">{spin.toLocaleString("en-US")}</text></g>)}
      {niceTicks(xMin, xMax, [1, 2, 5, 10]).map(speed => <g key={`x${speed}`}><line x1={x(speed)} x2={x(speed)} y1="36" y2="210" stroke="var(--line-subtle)"/><text x={x(speed)} y="228" textAnchor="middle" fill="var(--text-secondary)" fontSize="12">{speed}</text></g>)}
      <line x1="62" x2="402" y1="210" y2="210" stroke="var(--text-secondary)"/>
      <line x1="62" x2="62" y1="36" y2="210" stroke="var(--text-secondary)"/>
      <text x="232" y="258" textAnchor="middle" fill="var(--text-secondary)" fontSize="13">Average velocity (mph)</text>
      <text transform="translate(13 124) rotate(-90)" textAnchor="middle" fill="var(--text-secondary)" fontSize="13">Average spin (RPM)</text>
      {points.map(pitch => {
        const cx=x(pitch.averageVelocity!),cy=y(pitch.averageSpin!), color=pitchArsenalColor(pitch.pitchType);
        return <g key={pitch.source} data-pitch-type={pitch.pitchType}><title>{`${pitchTypeLabel(pitch.pitchType)}: ${formatSourceNumber(pitch.averageVelocity!,pitch.source)} mph, ${formatSpin(pitch.averageSpin!)} RPM; velocity n=${pitch.velocityReadings ?? "unknown"}, spin n=${pitch.spinReadings ?? "unknown"}`}</title><Marker shape={pitchShape(pitch.pitchType)} cx={cx} cy={cy} r={7} color={color}/></g>;
      })}
    </svg></div>
    <ul className={styles.legend}>{points.map(pitch=><li key={pitch.source}><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" className={styles.legendMark}><Marker shape={pitchShape(pitch.pitchType)} cx={7} cy={7} r={5} color={pitchArsenalColor(pitch.pitchType)}/></svg><strong>{pitchTypeLabel(pitch.pitchType)}</strong><small>Average / high: {formatSourceNumber(pitch.averageVelocity!,pitch.source)} / {pitch.maxVelocity===null?"—":formatSourceNumber(pitch.maxVelocity,pitch.source)} mph · {formatSpin(pitch.averageSpin!)} / {pitch.maxSpin===null?"—":formatSpin(pitch.maxSpin)} RPM</small></li>)}</ul>
    <p className={styles.note}>Speed and spin can be recorded on different pitches. The table above shows how many readings went into each average.</p>
  </figure>;
}

function ArsenalMix({ pitches, scope }: { pitches: readonly ArsenalPitch[]; scope: "session" | "fall" }) {
  if (scope === "fall" && pitches.some(pitch => pitch.count === null)) return null;
  const counted = pitches.filter(p => p.count !== null && Number.isInteger(p.count) && p.count > 0);
  const total = counted.reduce((sum,p)=>sum+p.count!,0);
  if (!total) return null;
  const shown = counted.slice(0,5).map(p=>({label:p.pitchType,count:p.count!}));
  const remaining=counted.slice(5).reduce((sum,p)=>sum+p.count!,0);
  if (remaining) shown.push({label:"Other classified types",count:remaining});
  const circumference = 2 * Math.PI * 68;
  return <figure className={styles.figure}>
    <figcaption><h4>Pitch Mix<StatInfo metric="pitch_mix_chart" label="Pitch Mix chart"/></h4><p>How often each assigned pitch type was thrown</p></figcaption>
    <div className={styles.mixLayout}><svg viewBox="0 0 220 220" role="img" aria-label={`${total} classified pitches across ${counted.length} pitch types`}>
      <circle cx="110" cy="110" r="68" fill="none" stroke="var(--line-subtle)" strokeWidth="23"/>
      {shown.map((item,index)=>{
        const length=item.count/total*circumference;
        const offset=shown.slice(0,index).reduce((sum,previous)=>sum+previous.count,0)/total*circumference;
        return <circle key={item.label} cx="110" cy="110" r="68" fill="none" stroke={item.label==="Other classified types"?"#7d8692":pitchArsenalColor(item.label)} strokeWidth="23" strokeDasharray={`${length} ${circumference-length}`} strokeDashoffset={-offset} transform="rotate(-90 110 110)"><title>{`${pitchTypeLabel(item.label)}: ${item.count} of ${total} classified pitches`}</title></circle>;
      })}
      <text x="110" y="105" textAnchor="middle" fill="var(--text-primary)" fontSize="28" fontWeight="800">{total}</text><text x="110" y="124" textAnchor="middle" fill="var(--text-secondary)" fontSize="16">assigned</text>
    </svg><ul className={styles.mixLegend}>{shown.map(item=><li key={item.label}><span style={{backgroundColor:item.label==="Other classified types"?"#7d8692":pitchArsenalColor(item.label)}} aria-hidden="true"/><span>{pitchTypeLabel(item.label)}</span><strong>{item.count} · {(item.count/total*100).toFixed(0)}%</strong></li>)}</ul></div>
    <p className={styles.note}>Pitches without a staff-assigned type are left out of this chart.</p>
  </figure>;
}

export function PitchArsenalChart({ pitches, scope = "session" }: { pitches: readonly ArsenalPitch[]; scope?: "session" | "fall" }) {
  return <div className={styles.grid} aria-label="Pitch arsenal visual summary"><ArsenalScatter pitches={pitches} scope={scope}/><ArsenalMix pitches={pitches} scope={scope}/></div>;
}
