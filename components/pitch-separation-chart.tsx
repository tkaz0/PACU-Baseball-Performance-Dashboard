"use client";

import { useId, useState } from "react";
import type { FallArsenalPitch } from "@/lib/pitch-arsenal";
import { pitchTypeLabel } from "@/lib/imports/pitch-assignments";
import { buildPitchSeparation, pitchSeparationGap, pitchSeparationReason, type PitchSeparationVelocity } from "@/lib/pitch-separation";
import { leaderboardTestDate } from "@/lib/leaderboards";
import { StatInfo } from "@/components/stat-info";
import { pitchArsenalColor } from "@/components/pitch-arsenal-chart";
import styles from "./pitch-separation-chart.module.css";

function Sample({ pitch }: { pitch: PitchSeparationVelocity }) {
  return <span className={styles.sample}>{pitch.basis === "fall" ? "Fall average" : pitch.basis === "latest" ? "Latest session" : "Average period unavailable"}
    {pitch.count !== null && ` · ${pitch.count.toLocaleString("en-US")} speed ${pitch.count === 1 ? "reading" : "readings"}`}
    {pitch.firstDate && pitch.lastDate && <span>{leaderboardTestDate(pitch.firstDate)}{pitch.lastDate !== pitch.firstDate ? ` – ${leaderboardTestDate(pitch.lastDate)}` : ""}</span>}
  </span>;
}

/** Own-athlete numerical summaries only. Maxima remain Fall bests, separate from the average basis. */
export function PitchSeparationChart({ pitches, category, today }: { pitches: readonly FallArsenalPitch[]; category: FallArsenalPitch["category"]; today?: string }) {
  const [requested, setRequested] = useState("");
  const id = useId();
  const model = buildPitchSeparation(pitches, category, requested, today);
  const { reference, velocityDomain: domain } = model;
  const position = (value: number) => domain ? (value - domain[0]) / (domain[1] - domain[0]) * 100 : 0;
  const rows = [...(reference ? [{ ...reference, gap: null }] : []), ...model.rows];
  return <section className={styles.chart} aria-labelledby={`${id}-title`}>
    <header className={styles.header}><div><h4 id={`${id}-title`}>Pitch Separation<StatInfo metric="pitch_separation_chart" label="Pitch Separation" /></h4><p>Average speed off your reference pitch · {category}</p></div>
      {model.references.length > 1 && <label className={styles.picker}>Reference Pitch<select value={reference?.source ?? ""} onChange={event => setRequested(event.target.value)}>
        <option value="">Choose a reference pitch</option>{model.references.map(pitch => <option key={pitch.source} value={pitch.source}>{pitchTypeLabel(pitch.pitchType)}</option>)}
      </select></label>}
    </header>
    {!model.references.length ? <p className={styles.empty}>A classified fastball-family average is needed to show speed gaps.</p> : !reference ? <p className={styles.empty}>Choose a reference pitch to show speed gaps. Every pitch is shown below.</p> : reference.issue ? <p className={styles.empty}>{pitchSeparationReason(reference.issue)}. Speed gaps need a verified average, count and dates.</p> : null}
    {reference && !model.rows.length && <p className={styles.empty}>Add another classified pitch type to see its speed gap.</p>}
    {domain && <div className={styles.axis} aria-hidden="true"><span>Average speed (mph) · Fall best shown as a diamond</span><div>{[domain[0], (domain[0] + domain[1]) / 2, domain[1]].map((value, index) => <span key={value} className={index === 0 ? styles.tickFirst : index === 2 ? styles.tickLast : styles.tickMiddle} style={{ left: `${position(value)}%` }}>{value.toFixed(1)}</span>)}</div></div>}
    <ul className={styles.rows}>{rows.map(pitch => {
      const isReference = pitch.source === reference?.source;
      const color = pitchArsenalColor(pitch.pitchType);
      return <li key={pitch.source}>
        <div className={styles.rowHeading}><div>{isReference && <span className={styles.referenceLabel}>Reference</span>}<strong><i className={styles.pitchColor} style={{ background: color }} aria-hidden="true"/>{pitchTypeLabel(pitch.pitchType)}</strong><Sample pitch={pitch}/></div><div className={styles.result}><strong>{pitch.average === null ? "—" : `${pitch.average.toFixed(1)} mph`} <small>avg</small></strong>{pitch.maximum !== null && <span className={styles.best}>{pitch.maximum.toFixed(1)} mph Fall best{pitch.maximumDate && <small>{leaderboardTestDate(pitch.maximumDate)}</small>}</span>}{!isReference && <span className={pitch.gap === null ? styles.unavailable : styles.gap}>{pitch.gap === null ? pitchSeparationReason(pitch.issue) : pitchSeparationGap(pitch.gap)}</span>}</div></div>
        {domain && (pitch.average !== null || pitch.maximum !== null) && <div className={styles.track} aria-hidden="true" data-pitch-gap={pitch.gap ?? undefined}>
          {pitch.gap !== null && reference?.average != null && <><span className={styles.connector} style={{ background: color, left: `${Math.min(position(pitch.average!), position(reference.average))}%`, width: `${Math.abs(position(pitch.average!) - position(reference.average))}%` }}/><span className={styles.referenceMark} style={{ left: `${position(reference.average)}%` }}/></>}
          {pitch.average !== null && pitch.maximum !== null && <span className={styles.bestRange} style={{ background: color, left: `${position(pitch.average)}%`, width: `${position(pitch.maximum) - position(pitch.average)}%` }}/>}
          {pitch.average !== null && <span className={styles.pitchMark} style={{ background: color, outlineColor: color, left: `${position(pitch.average)}%` }}/>}
          {pitch.maximum !== null && <span className={styles.maxMark} style={{ borderColor: color, left: `${position(pitch.maximum)}%` }}/>}
        </div>}
      </li>;
    })}</ul>
    {domain && <p className={styles.legend}><span className={styles.dot} aria-hidden="true"/>Pitch average<span className={styles.diamond} aria-hidden="true"/>Fall best<span className={styles.dash} aria-hidden="true"/>Reference pitch</p>}
    <p className={styles.note}>Gaps use average speeds with the same source, averaging method and date range. Diamonds show each pitch’s highest saved Fall speed, not a velocity range. They describe speed separation, not pitch quality.</p>
  </section>;
}
