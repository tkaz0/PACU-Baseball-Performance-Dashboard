import type { ArsenalPitch } from "@/lib/pitch-arsenal";
import { PITCH_TYPES } from "@/lib/imports/pitch-assignments";
import { formatSourceNumber } from "@/lib/measurement-display";
import { StatInfo } from "@/components/stat-info";
import styles from "./pitch-arsenal-chart.module.css";

const colors = ["#bb2634", "#3979b7", "#d39630", "#69976e", "#8567ae", "#3a9a9a", "#ad475f", "#6f83c5", "#a1773f", "#558ba5", "#986d90", "#637688", "#845e51"];
const pointShapes = ["circle", "square", "diamond"] as const;
const pitchColor = (type: string) => colors[Math.max(0,PITCH_TYPES.indexOf(type as typeof PITCH_TYPES[number]))];

function extent(values: number[], step: number): [number, number] {
  const low = Math.min(...values), high = Math.max(...values);
  const padding = Math.max((high - low) * .16, step);
  const min = Math.max(0, Math.floor((low - padding) / step) * step);
  const max = Math.ceil((high + padding) / step) * step;
  return [min, max <= min ? min + step : max];
}

function ArsenalScatter({ pitches }: { pitches: readonly ArsenalPitch[] }) {
  const points = pitches.filter(p => p.averageVelocity !== null && p.averageSpin !== null);
  if (!points.length) return <p className={styles.empty}>No pitch type has both a speed and spin reading for this session yet.</p>;
  const [xMin, xMax] = extent(points.map(p => p.averageVelocity!), 2);
  const [yMin, yMax] = extent(points.map(p => p.averageSpin!), 100);
  const x = (value: number) => 62 + (value - xMin) / (xMax - xMin) * 340;
  const y = (value: number) => 210 - (value - yMin) / (yMax - yMin) * 174;
  return <figure className={styles.figure}>
    <figcaption><h4>Pitch Arsenal<StatInfo metric="pitch_arsenal_chart" label="Pitch Arsenal chart"/></h4><p>Each pitch type by average speed and spin</p></figcaption>
    <div className={styles.plotScroll}><svg viewBox="0 0 460 275" role="img" aria-label={`Pitch arsenal chart for ${points.length} classified pitch types. Velocity in miles per hour, spin in revolutions per minute.`}>
      {[0, .5, 1].map(fraction => {
        const spin = yMin + fraction * (yMax - yMin), speed = xMin + fraction * (xMax - xMin);
        return <g key={fraction}><line x1="62" x2="402" y1={y(spin)} y2={y(spin)} stroke="var(--line-subtle)"/><text x="54" y={y(spin)+4} textAnchor="end" fill="var(--text-secondary)" fontSize="12">{Math.round(spin)}</text><line x1={x(speed)} x2={x(speed)} y1="36" y2="210" stroke="var(--line-subtle)"/><text x={x(speed)} y="228" textAnchor="middle" fill="var(--text-secondary)" fontSize="12">{speed.toFixed(0)}</text></g>;
      })}
      <line x1="62" x2="402" y1="210" y2="210" stroke="var(--text-secondary)"/>
      <line x1="62" x2="62" y1="36" y2="210" stroke="var(--text-secondary)"/>
      <text x="232" y="258" textAnchor="middle" fill="var(--text-secondary)" fontSize="13">Average velocity (mph)</text>
      <text transform="translate(13 124) rotate(-90)" textAnchor="middle" fill="var(--text-secondary)" fontSize="13">Average spin (RPM)</text>
      {points.map((pitch, index) => {
        const cx=x(pitch.averageVelocity!),cy=y(pitch.averageSpin!), color=pitchColor(pitch.pitchType);
        const shape=pointShapes[index%pointShapes.length];
        return <g key={pitch.source} data-pitch-type={pitch.pitchType}><title>{`${pitch.pitchType}: ${formatSourceNumber(pitch.averageVelocity!,pitch.source)} mph, ${formatSourceNumber(pitch.averageSpin!,pitch.source)} RPM; velocity n=${pitch.velocityReadings ?? "unknown"}, spin n=${pitch.spinReadings ?? "unknown"}`}</title>{shape==="circle"?<circle cx={cx} cy={cy} r="7" fill={color} stroke="var(--surface-panel)" strokeWidth="2"/>:shape==="square"?<rect x={cx-7} y={cy-7} width="14" height="14" rx="2" fill={color} stroke="var(--surface-panel)" strokeWidth="2"/>:<path d={`M ${cx} ${cy-9} L ${cx+9} ${cy} L ${cx} ${cy+9} L ${cx-9} ${cy} Z`} fill={color} stroke="var(--surface-panel)" strokeWidth="2"/>}</g>;
      })}
    </svg></div>
    <ul className={styles.legend}>{points.map(pitch=><li key={pitch.source}><span style={{backgroundColor:pitchColor(pitch.pitchType)}} aria-hidden="true"/><strong>{pitch.pitchType}</strong><small>Average / high: {formatSourceNumber(pitch.averageVelocity!,pitch.source)} / {pitch.maxVelocity===null?"—":formatSourceNumber(pitch.maxVelocity,pitch.source)} mph · {formatSourceNumber(pitch.averageSpin!,pitch.source)} / {pitch.maxSpin===null?"—":formatSourceNumber(pitch.maxSpin,pitch.source)} RPM</small></li>)}</ul>
    <p className={styles.note}>Speed and spin can be recorded on different pitches. See the results table for how many readings went into each average.</p>
  </figure>;
}

function ArsenalMix({ pitches }: { pitches: readonly ArsenalPitch[] }) {
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
        return <circle key={item.label} cx="110" cy="110" r="68" fill="none" stroke={item.label==="Other classified types"?"#7d8692":pitchColor(item.label)} strokeWidth="23" strokeDasharray={`${length} ${circumference-length}`} strokeDashoffset={-offset} transform="rotate(-90 110 110)"><title>{`${item.label}: ${item.count} of ${total} classified pitches`}</title></circle>;
      })}
      <text x="110" y="105" textAnchor="middle" fill="var(--text-primary)" fontSize="28" fontWeight="800">{total}</text><text x="110" y="124" textAnchor="middle" fill="var(--text-secondary)" fontSize="11">assigned</text>
    </svg><ul className={styles.mixLegend}>{shown.map(item=><li key={item.label}><span style={{backgroundColor:item.label==="Other classified types"?"#7d8692":pitchColor(item.label)}} aria-hidden="true"/><span>{item.label}</span><strong>{item.count} · {(item.count/total*100).toFixed(0)}%</strong></li>)}</ul></div>
    <p className={styles.note}>Pitches without a staff-assigned type are left out of this chart.</p>
  </figure>;
}

export function PitchArsenalChart({ pitches }: { pitches: readonly ArsenalPitch[] }) {
  return <div className={styles.grid} aria-label="Pitch arsenal visual summary"><ArsenalScatter pitches={pitches}/><ArsenalMix pitches={pitches}/></div>;
}
