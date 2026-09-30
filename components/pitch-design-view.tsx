"use client";

import { useState } from "react";
import { ArrowUpRight, CircleDot, ChevronDown, CirclePlay, Fingerprint, Info, Target } from "lucide-react";
import type { PitchDesignModel, PitchDesignBody, PitcherStudyMatch } from "@/lib/pitch-design";
import type { FallArsenalPitch } from "@/lib/pitch-arsenal";
import { PITCH_GRIP_REFERENCES, PITCH_GRIP_SOURCE } from "@/lib/pitch-grip-references";
import { pitchTypeLabel } from "@/lib/imports/pitch-assignments";
import { formatHeight } from "@/lib/measurement-display";
import { leaderboardTestDate } from "@/lib/leaderboards";
import { PitchArsenalChart, pitchArsenalColor } from "@/components/pitch-arsenal-chart";
import { PitchSeparationChart } from "@/components/pitch-separation-chart";
import styles from "./pitch-design-view.module.css";

const MLB_SOURCE = "https://baseballsavant.mlb.com/leaderboard/pitch-arsenals?type=avg_speed&year=2025&team=&min=500";
const number = (value: number | null) => value === null ? "—" : value.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const period = (first: string | null, last: string | null) => first && last ? `${leaderboardTestDate(first)}${first !== last ? ` – ${leaderboardTestDate(last)}` : ""}` : "Date unavailable";
const categoryLabel = (category: string) => category === "Intrasquad" ? "In-Game · Intrasquad" : category === "Game" ? "In-Game" : "Practice";
function PitchColor({ pitch }: { pitch: string }) {
  return <span className={styles.dot} style={{ background: pitchArsenalColor(pitch) }} aria-hidden="true"/>;
}
function StatCell({ label, value, unit, sample, date }: { label: string; value: number | null; unit: string; sample: number | null | undefined; date: string }) {
  return <div className={styles.stat}><span>{label}</span><strong>{number(value)}<small>{unit}</small></strong><span>{value !== null ? sample === null || sample === undefined ? "Reading count unavailable" : `${sample.toLocaleString()} readings` : "No saved result"}</span><span>{value !== null ? date : "—"}</span></div>;
}
function PitchCard({ pitch, onGrip }: { pitch: FallArsenalPitch; onGrip: () => void }) {
  return <article className={styles.pitchCard}>
    <header><div><PitchColor pitch={pitch.pitchType}/><h3>{pitchTypeLabel(pitch.pitchType)}</h3></div><span>{pitch.sessionCount} {pitch.sessionCount === 1 ? "session" : "sessions"}</span></header>
    <div className={styles.stats}>
      <StatCell label={pitch.velocityBasis === "latest" ? "Latest Avg Velo" : "Average Velo"} value={pitch.averageVelocity} unit="mph" sample={pitch.velocityReadings} date={period(pitch.velocityAverageFirstDate, pitch.velocityAverageLastDate)}/>
      <StatCell label="Fall Max Velo" value={pitch.maxVelocity} unit="mph" sample={pitch.maxVelocityReadings} date={period(pitch.maxVelocityDate, pitch.maxVelocityDate)}/>
      <StatCell label={pitch.spinBasis === "latest" ? "Latest Avg Spin" : "Average Spin"} value={pitch.averageSpin} unit="rpm" sample={pitch.spinReadings} date={period(pitch.spinAverageFirstDate, pitch.spinAverageLastDate)}/>
      <StatCell label="Fall Max Spin" value={pitch.maxSpin} unit="rpm" sample={pitch.maxSpinReadings} date={period(pitch.maxSpinDate, pitch.maxSpinDate)}/>
    </div>
    <footer><span>{pitch.count === null ? "Classified count unavailable" : `${pitch.count.toLocaleString()} classified pitches`}</span><button type="button" onClick={onGrip}>Explore Grips <ArrowUpRight size={14} aria-hidden="true"/></button></footer>
  </article>;
}

function GripLab({ selected, setSelected }: { selected: string; setSelected: (value: string) => void }) {
  const types = [...new Set(PITCH_GRIP_REFERENCES.flatMap(grip => grip.pitchTypes))];
  const grips = PITCH_GRIP_REFERENCES.filter(grip => grip.pitchTypes.includes(selected));
  return <section id="pitch-grip-lab" className={styles.section} aria-labelledby="grip-title" tabIndex={-1}>
    <header className={styles.sectionHeader}><div><span className={styles.eyebrow}><Fingerprint size={15} aria-hidden="true"/>The Grip Lab</span><h2 id="grip-title">Find Something to Try</h2><p>Grip references from Nate Rasmussen’s Pitch Grip Database.</p></div>
      <label className={styles.select}>Explore a Pitch<select value={selected} onChange={event => setSelected(event.target.value)}>{!types.includes(selected) && <option value={selected}>{pitchTypeLabel(selected)}</option>}{types.map(type => <option key={type} value={type}>{pitchTypeLabel(type)}</option>)}</select></label>
    </header>
    <div className={styles.gripGrid}>{grips.map(grip => <article className={styles.grip} key={grip.id}><div className={styles.gripIcon}><CircleDot size={29} aria-hidden="true"/></div><div><span className={styles.muted}>DATABASE FILTER · {grip.filterLabel}</span><h3>{grip.name}</h3><p>{grip.cue}</p><div className={styles.links}><a href={grip.sourceUrl} target="_blank" rel="noreferrer">View Grip Photos <ArrowUpRight size={13} aria-hidden="true"/></a><a href={grip.techniqueSourceUrl} target="_blank" rel="noreferrer">Technique Guide <ArrowUpRight size={13} aria-hidden="true"/></a></div></div></article>)}</div>
    {!grips.length && <p className={styles.empty}>Choose a specific pitch above to explore its grip options. No grip is inferred for an unspecified pitch.</p>}
    <p className={styles.note}>{PITCH_GRIP_SOURCE.navigationNote} Use the catalog name shown above.</p>
    <div className={styles.experiment}><Target size={22} aria-hidden="true"/><div><strong>One change. Same bullpen setup. Compare the result.</strong><p>Choose a grip with your coach, then compare velocity, spin, location, movement and feel. A higher spin number alone does not make a better pitch.</p></div></div>
  </section>;
}

function SizeTrack({ label, own, pro }: { label: string; own: number | null; pro: number | null }) {
  if (own === null || pro === null) return null;
  return <div className={styles.sizeTrack}><div><span>{label}</span><span>You {Math.round(own)} · MLB {Math.round(pro)}</span></div><div className={styles.track} role="img" aria-label={`${label} size percentile: you ${Math.round(own)} in Pacific's measured roster, reference ${Math.round(pro)} in the verified MLB pitcher cohort. Size, not performance.`}><span style={{ left: `${pro}%` }} className={styles.proMarker}/><span style={{ left: `${own}%` }} className={styles.ownMarker}/></div></div>;
}
function StudyCard({ match, body }: { match: PitcherStudyMatch; body: PitchDesignBody }) {
  const pro = match.reference;
  return <article className={styles.study}>
    <header><div><span className={styles.eyebrow}>{pro.throws === "L" ? "Left-Handed" : "Right-Handed"} · MLB Study</span><h3>{pro.name}</h3><p>{formatHeight(pro.heightInches, "in")} · {pro.weightLb} lb</p></div><CirclePlay size={27} aria-hidden="true"/></header>
    <div className={styles.chips}>{match.sharedPitches.map(pitch => <span key={pitch}><PitchColor pitch={pitch}/>{pitchTypeLabel(pitch)}</span>)}</div>
    <p className={styles.studyBasis}>Shared pitch types{match.speedGapsUsed ? " · speed gaps" : ""}{match.spinRelationshipsUsed ? " · spin relationships" : ""}{match.sizeUsed ? " · relative size" : ""}</p>
    {match.sizeUsed && <div className={styles.size}><SizeTrack label="Height" own={body.heightRank?.value ?? null} pro={match.heightPercentile}/><SizeTrack label="Weight" own={body.weightRank?.value ?? null} pro={match.weightPercentile}/><span className={styles.muted}>● You · ◆ MLB reference · size percentiles</span></div>}
    <details className={styles.proTable}><summary>Explore the MLB Arsenal <ChevronDown size={14} aria-hidden="true"/></summary><div className={styles.tableScroll}><table><caption>2025 MLB regular season · recorded types with 50+ pitches</caption><thead><tr><th scope="col">Pitch</th><th scope="col">Avg mph</th><th scope="col">Avg rpm</th><th scope="col">Pitches</th></tr></thead><tbody>{pro.pitches.map(pitch => <tr key={pitch.pitchType}><th scope="row">{pitchTypeLabel(pitch.pitchType)}</th><td>{number(pitch.averageVelocity)}</td><td>{number(pitch.averageSpin)}</td><td>{pitch.pitchCount.toLocaleString()}</td></tr>)}</tbody></table></div><p>Pitch counts are classified totals, not the number of valid spin or velocity readings.</p></details>
    <a className={styles.studyLink} href={`https://baseballsavant.mlb.com/savant-player/${pro.id}`} target="_blank" rel="noreferrer">Study on Baseball Savant <ArrowUpRight size={15} aria-hidden="true"/></a>
  </article>;
}

function ContextView({ model, context }: { model: PitchDesignModel; context: PitchDesignModel["contexts"][number] }) {
  const [gripPitch, setGripPitch] = useState(context.pitches[0].pitchType);
  function chooseGrip(pitch: string) {
    setGripPitch(pitch);
    const target = document.getElementById("pitch-grip-lab");
    target?.focus({ preventScroll: true }); target?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
  }
  return <>
    <section className={styles.section} aria-labelledby="arsenal-title"><header className={styles.sectionHeader}><div><span className={styles.eyebrow}>Your Repertoire</span><h2 id="arsenal-title">Velocity & Spin</h2><p>{categoryLabel(context.category)} · Fall 2026 · Each pitch keeps its own results.</p></div></header>
      <PitchArsenalChart pitches={context.pitches} scope="fall"/>
      <div className={styles.pitchGrid}>{context.pitches.map(pitch => <PitchCard key={pitch.source} pitch={pitch} onGrip={() => chooseGrip(pitch.pitchType)}/>)}</div>
      <p className={styles.note}>Averages combine saved sessions using each metric’s reading count. Missing counts show a labeled latest-session average. Maxima retain the best Fall reading.</p>
    </section>
    <PitchSeparationChart pitches={context.pitches} category={context.category}/>
    <GripLab selected={gripPitch} setSelected={setGripPitch}/>
    <section className={styles.section} aria-labelledby="study-title"><header className={styles.sectionHeader}><div><span className={styles.eyebrow}><CirclePlay size={15} aria-hidden="true"/>The Film Room</span><h2 id="study-title">Pitchers to Study</h2><p>Same throwing hand. Shared pitches. Ideas for your next bullpen.</p></div></header>
      <div className={styles.studyGrid}>{context.studies.map(match => <StudyCard key={match.reference.id} match={match} body={model.body}/>)}</div>
      {!context.studies.length && <p className={styles.empty}>{!model.throws ? "Add a confirmed throwing hand to this player's roster entry to show same-handed MLB study references." : "More specifically classified pitch results are needed for a useful same-handed study match. Generic or unmatched pitch types are never guessed."}</p>}
      {!!context.studies.length && <p className={styles.note}>Study references, not a claim of identical mechanics. Compare sequencing and how each pitch complements the rest of the arsenal.</p>}
    </section>
  </>;
}

export function PitchDesignView({ model }: { model: PitchDesignModel }) {
  const [selectedContext, setSelectedContext] = useState<string>(model.contexts[0]?.category ?? "");
  const context = model.contexts.find(item => item.category === selectedContext) ?? model.contexts[0];
  return <div className={styles.page}>
    <section className={styles.hero}><div><span className={styles.eyebrow}>Pacific Baseball · Pitch Development</span><h2>Build Your Arsenal.</h2><p>Know what you throw. Explore what comes next.</p><div className={styles.heroMeta}><span>{context ? `${context.pitches.length} recorded pitch ${context.pitches.length === 1 ? "type" : "types"}` : "Classified results coming soon"}</span>{model.throws && <span>{model.throws === "L" ? "Left" : "Right"}-handed</span>}{model.body.height && <span>{formatHeight(model.body.height.value, "in")}</span>}{model.body.weight && <span>{number(model.body.weight.value)} lb</span>}</div></div><Target className={styles.heroArt} size={110} strokeWidth={.9} aria-hidden="true"/></section>
    {model.contexts.length > 0 ? <>
      <div className={styles.contexts} role="group" aria-label="Pitch Design setting">{model.contexts.map(item => <button key={item.category} type="button" aria-pressed={context?.category === item.category} onClick={() => setSelectedContext(item.category)}>{categoryLabel(item.category)}<span>{item.pitches.length} pitch types</span></button>)}</div>
      <ContextView key={context.category} model={model} context={context}/>
    </> : <><section className={styles.empty}><Target size={28} aria-hidden="true"/><h2>{model.mixedAthletes ? "Pitch Results Need Review" : "Your Arsenal Starts Here"}</h2><p>{model.mixedAthletes ? "These readings cannot be combined safely. Ask a coach to review the player assignments." : "Saved Full Swing results with confirmed pitch types will build your velocity and spin charts here. You can explore the grip library now."}</p></section><EmptyGripLab/></>}
    <details className={styles.methods}><summary><Info size={16} aria-hidden="true"/>About the Numbers & Study Matches<ChevronDown size={15} aria-hidden="true"/></summary><div>
      <p><strong>Your arsenal:</strong> Saved, classified Full Swing readings from Fall 2026. Game, intrasquad and practice remain separate. Total spin alone does not establish movement. Release, spin axis, active spin and measured break are not inferred.</p>
      <p><strong>MLB study matches:</strong> A custom study list of 100 familiar pitchers, using 2025 regular-season data. Exact shared pitch types come first. Comparable speed gaps and spin ratios refine the order; raw college and MLB speeds are not equated. Available relative height and weight ranks refine the list too. When both are available, relationships receive 60% of this refinement and size 40%. This is not a performance grade or a validated scouting projection.</p>
      <p><strong>Your size readings:</strong> Height: {model.body.height ? leaderboardTestDate(model.body.height.date) : "not recorded"}. Weight: {model.body.weight ? leaderboardTestDate(model.body.weight.date) : "not recorded"}.</p>
      <p><strong>Relative size:</strong> Your rank uses Pacific’s measured roster{model.body.heightRank ? ` (height: ${model.body.heightRank.sampleSize} players)` : ""}{model.body.weightRank ? ` (weight: ${model.body.weightRank.sampleSize} players)` : ""}; MLB ranks use the full 368-pitcher verified cohort before hand or featured-name filtering. Larger means larger, not better. Listed MLB height and weight were checked September 29, 2026 and do not describe body composition.</p>
      <p><strong>MLB sample:</strong> At least 500 season pitches and 50 per listed pitch type. Source-inconsistent records are excluded; omitted pitches may still be part of a pitcher’s repertoire. Mean velocity and spin retain their source precision.</p>
      <p><strong>Grip references:</strong> The library links to Nate Rasmussen’s catalog and its original technique sources. Grip options are experiments for a coach to review, not a diagnosis of your current grip or a promised movement change.</p>
      <div className={styles.links}><a href={MLB_SOURCE} target="_blank" rel="noreferrer">MLB Source Data <ArrowUpRight size={13}/></a><a href={PITCH_GRIP_SOURCE.url} target="_blank" rel="noreferrer">Rasmussen Grip Database <ArrowUpRight size={13}/></a><a href="https://www.mlb.com/glossary/statcast/active-spin" target="_blank" rel="noreferrer">Spin & Movement <ArrowUpRight size={13}/></a></div>
    </div></details>
  </div>;
}
function EmptyGripLab() {
  const [selected, setSelected] = useState("Four-Seam Fastball");
  return <GripLab selected={selected} setSelected={setSelected}/>;
}
