"use client";

import { pitchTypeLabel } from "@/lib/imports/pitch-assignments";

import { useId, useState } from "react";
import type { FallArsenalPitch } from "@/lib/pitch-arsenal";
import { buildPitchSeparation, pitchSeparationGap, pitchSeparationReason, type PitchSeparationVelocity } from "@/lib/pitch-separation";
import { leaderboardTestDate } from "@/lib/leaderboards";
import { StatInfo } from "@/components/stat-info";
import styles from "./pitch-separation-chart.module.css";

function Sample({ pitch }: { pitch: PitchSeparationVelocity }) {
  return <span className={styles.sample}>{pitch.basis === "fall" ? "Fall average" : pitch.basis === "latest" ? "Latest session" : "Average period unavailable"}
    {pitch.count !== null && ` · ${pitch.count.toLocaleString("en-US")} speed ${pitch.count === 1 ? "reading" : "readings"}`}
    {pitch.firstDate && pitch.lastDate && <span>{leaderboardTestDate(pitch.firstDate)}{pitch.lastDate !== pitch.firstDate ? ` – ${leaderboardTestDate(pitch.lastDate)}` : ""}</span>}
  </span>;
}

/** Purely local reference selection; receives only the authorized numerical arsenal summary. */
export function PitchSeparationChart({ pitches, category, today }: { pitches: readonly FallArsenalPitch[]; category: FallArsenalPitch["category"]; today?: string }) {
  const [requested, setRequested] = useState("");
  const id = useId();
  const model = buildPitchSeparation(pitches, category, requested, today);
  const { reference, domain } = model;
  const position = (value: number) => domain ? (value - domain[0]) / (domain[1] - domain[0]) * 100 : 0;
  return <section className={styles.chart} aria-labelledby={`${id}-title`}>
    <header className={styles.header}><div><h4 id={`${id}-title`}>Pitch Separation<StatInfo metric="pitch_separation_chart" label="Pitch Separation" /></h4><p>Average speed off your reference pitch · {category}</p></div>
      {model.references.length > 1 && <label className={styles.picker}>Reference Pitch<select value={reference?.source ?? ""} onChange={event => setRequested(event.target.value)}>
        <option value="">Choose a reference pitch</option>{model.references.map(pitch => <option key={pitch.source} value={pitch.source}>{pitchTypeLabel(pitch.pitchType)}</option>)}
      </select></label>}
    </header>
    {!model.references.length ? <p className={styles.empty}>A classified fastball-family average is needed to show speed gaps.</p>
      : !reference ? <p className={styles.empty}>Choose a reference pitch. Each type keeps its own speed.</p>
      : <>
        <div className={styles.reference}><div><span className={styles.referenceLabel}>Reference</span><strong>{pitchTypeLabel(reference.pitchType)}</strong><Sample pitch={reference} /></div><strong className={styles.speed}>{reference.average === null ? "—" : `${reference.average.toFixed(1)} mph`}</strong></div>
        {reference.issue && <p className={styles.empty}>{pitchSeparationReason(reference.issue)}. Speed gaps will appear when the reference has a verified average, count and dates.</p>}
        {!model.rows.length ? <p className={styles.empty}>Add another classified pitch type to see its speed gap.</p> : <>
          {domain && <div className={styles.axis} aria-hidden="true"><span>Average speed (mph)</span><div>{[domain[0], (domain[0] + domain[1]) / 2, domain[1]].map((value, index) => <span key={value} className={index === 0 ? styles.tickFirst : index === 2 ? styles.tickLast : styles.tickMiddle} style={{ left: `${position(value)}%` }}>{value.toFixed(1)}</span>)}</div></div>}
          <ul className={styles.rows}>{model.rows.map(pitch => <li key={pitch.source}>
            <div className={styles.rowHeading}><div><strong>{pitchTypeLabel(pitch.pitchType)}</strong><Sample pitch={pitch} /></div><div className={styles.result}><strong>{pitch.average === null ? "—" : `${pitch.average.toFixed(1)} mph`}</strong><span className={pitch.gap === null ? styles.unavailable : styles.gap}>{pitch.gap === null ? pitchSeparationReason(pitch.issue) : pitchSeparationGap(pitch.gap)}</span></div></div>
            {pitch.gap !== null && domain && <div className={styles.track} aria-hidden="true" data-pitch-gap={pitch.gap}>
              <span className={styles.connector} style={{ left: `${Math.min(position(pitch.average!), position(reference.average!))}%`, width: `${Math.abs(position(pitch.average!) - position(reference.average!))}%` }} />
              <span className={styles.referenceMark} style={{ left: `${position(reference.average!)}%` }} />
              <span className={styles.pitchMark} style={{ left: `${position(pitch.average!)}%` }} />
            </div>}
          </li>)}</ul>
          {domain && <p className={styles.legend}><span className={styles.dot} aria-hidden="true"/>Pitch average<span className={styles.dash} aria-hidden="true"/>Reference pitch</p>}
        </>}
      </>}
    <p className={styles.note}>Gaps use average speeds with the same source, averaging method and date range. They describe speed separation, not pitch quality.</p>
  </section>;
}
