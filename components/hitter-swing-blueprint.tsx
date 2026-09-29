import { ArrowUpRight, ChevronDown, Info, Play, ScanLine } from "lucide-react";
import { blastPeriodLabel } from "@/lib/blast-metrics";
import { hitterSwingProfile } from "@/lib/hitter-swing-profile";
import { hitterStudyMatches } from "@/lib/hitter-study-matches";
import { HITTER_STUDY_REFERENCE_SOURCE } from "@/lib/hitter-study-references";
import { formatHeight } from "@/lib/measurement-display";
import type { Measurement } from "@/lib/imports/engine";
import type { PlayerPerformance } from "@/lib/player-performance";
import styles from "./hitter-swing-blueprint.module.css";

const BLAST_DEFINITIONS = "https://blast-motion.helpjuice.com/what-are-the-blast-baseball-metrics-47-version";
function degrees(value: number) { return `${value > 0 ? "+" : ""}${value.toFixed(1)}°`; }
function testedDate(value: string) { return new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",timeZone:"UTC"}).format(new Date(`${value.slice(0,10)}T12:00:00Z`)); }
function point(x: number, y: number, length: number, angle: number) {
  const radians = angle * Math.PI / 180;
  return { x: x + length * Math.cos(radians), y: y - length * Math.sin(radians) };
}

/** A fixed illustrative pose: no joint location is inferred from sensor aggregates. */
function BattingSkeleton() {
  return <g fill="none" stroke="var(--bones)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="143" cy="61" r="19" strokeWidth="3" />
    <path d="M155 73 159 89 168 144 174 176M159 91 126 109 152 146 219 150M160 95 189 112 206 146 219 150M162 169 185 179M174 176 127 219 111 271M185 179 217 220 242 271M111 271 94 275M242 271 264 275" />
    <path d="m149 99 21 3m-18 10 22 3m-19 10 21 3m-18 10 20 3" strokeWidth="2" opacity=".5" />
    {[[159,91],[126,109],[152,146],[189,112],[206,146],[219,150],[174,176],[127,219],[217,220]].map(([cx,cy]) => <circle key={`${cx}:${cy}`} cx={cx} cy={cy} r="5" fill="#101c2a" strokeWidth="2" />)}
  </g>;
}

export function SwingAngleDiagram({ angle, kind }: { angle: number | null; kind: "attack" | "vertical" }) {
  const isAttack = kind === "attack", x = isAttack ? 307 : 219, y = 150;
  const start = angle === null ? null : point(x,y,isAttack ? -81 : 0,angle);
  const end = angle === null ? null : point(x,y,isAttack ? 86 : 136,angle);
  const arcEnd = angle === null ? null : point(x,y,38,angle);
  const arrowLeft = angle === null || !end ? null : point(end.x,end.y,-13,angle+27);
  const arrowRight = angle === null || !end ? null : point(end.x,end.y,-13,angle-27);
  const barrelStart = angle === null ? null : point(x,y,44,angle);
  const title = isAttack ? "Attack Angle" : "Vertical Bat Angle";
  return <svg viewBox="0 0 420 300" className={styles.diagram} role="img" aria-label={`${title}: ${angle === null ? "no reviewed average available" : degrees(angle)}. Illustrative skeleton; only the highlighted bat angle represents the measured average.`} data-angle={angle ?? undefined} data-angle-kind={kind}>
    <g stroke="#243247" strokeWidth="1" opacity=".6" aria-hidden="true">
      {[40,80,120,160,200,240,280,320,360,400].map(cx=><path d={`M${cx} 20V280`} key={`x${cx}`}/>)}
      {[40,80,120,160,200,240,280].map(cy=><path d={`M20 ${cy}H400`} key={`y${cy}`}/>)}
    </g>
    <g aria-hidden="true" opacity={angle === null ? .4 : 1}>
      <path d="M45 278H380" stroke="#6e8198" strokeWidth="1"/>
      <BattingSkeleton />
      <path d={`M${x-25} ${y}H403`} stroke="#9cabbc" strokeWidth="1.5" strokeDasharray="4 5" />
      <text x="398" y="27" textAnchor="end" fill="#adbdd0" fontSize="10">DASHED LINE · 0°</text>
      {angle !== null && start && end && arcEnd && <g stroke={isAttack ? "#63c9ff" : "#ff8c99"} fill="none" strokeLinecap="round">
        {Math.abs(angle) > .05 && <path d={`M${x+38} ${y} A38 38 0 0 ${angle>=0?0:1} ${arcEnd.x} ${arcEnd.y}`} strokeWidth="2"/>}
        {isAttack ? <>
          <path d={`M${start.x} ${start.y}L${end.x} ${end.y}`} strokeWidth="4"/>
          <path d={`M${arrowLeft!.x} ${arrowLeft!.y}L${end.x} ${end.y}L${arrowRight!.x} ${arrowRight!.y}`} strokeWidth="4"/>
          <circle cx={x} cy={y} r="7" strokeWidth="2" fill="#101c2a" />
        </> : <>
          <path d={`M${x} ${y}L${end.x} ${end.y}`} strokeWidth="5" />
          <path d={`M${barrelStart!.x} ${barrelStart!.y}L${end.x} ${end.y}`} strokeWidth="12"/>
          <circle cx={x} cy={y} r="6" fill="#101c2a" strokeWidth="2"/>
        </>}
      </g>}
      <text x="22" y="27" fill={isAttack ? "#63c9ff" : "#ff8c99"} fontSize="10" fontWeight="700" letterSpacing="1.6">{isAttack ? "BARREL TRAVEL" : "BAT SHAFT TILT"}</text>
    </g>
    {angle === null && <g><rect x="73" y="113" width="274" height="55" rx="8" fill="#101c2a" stroke="#53657c"/><text x="210" y="146" textAnchor="middle" fill="#e5edf7" fontSize="13">Awaiting a reviewed average</text></g>}
  </svg>;
}

export function HitterSwingBlueprint({ readings, performance }: { readings: readonly Measurement[]; performance: PlayerPerformance }) {
  const profile = hitterSwingProfile(readings,performance), {summary,path,tilt} = profile;
  if (!summary) return null;
  const study = hitterStudyMatches(profile);
  const batSpeed = !summary.issues.length && profile.attackAngle !== null ? summary.metrics.find(metric=>metric.key === "avg_bat_speed")?.average ?? null : null;
  const period = summary.firstDate && summary.lastDate ? blastPeriodLabel(summary.firstDate,summary.lastDate) : null;
  const basisLabel = {path_and_size:"Bat Path + Listed Size",path_and_height:"Bat Path + Listed Height",path_and_weight:"Bat Path + Listed Weight",path_only:"Bat Path Only",none:"Awaiting a Comparable Reference"}[study.basis];
  return <section className={styles.blueprint} aria-label="Practice swing blueprint" data-testid="hitter-swing-blueprint">
    <header className={styles.heading}>
      <div><p className={styles.eyebrow}><ScanLine size={15} aria-hidden="true"/>Practice · Swing Blueprint</p><h2>{path?.name ?? "Your Swing Blueprint"}</h2><p className={styles.subtitle}>{path?.label ?? "A swing type appears with a reviewed average."}{tilt && <><span aria-hidden="true"> / </span>{tilt.label}</>}</p></div>
      <div className={styles.sample}><strong>{summary.totalSwings?.toLocaleString("en-US") ?? "—"}</strong><span>Practice Swings</span>{period && <small>{period}</small>}</div>
    </header>
    <div className={styles.angleGrid}>
      {([{kind:"attack",title:"Attack Angle",value:profile.attackAngle,description:"The direction your barrel is traveling at contact.",reading:profile.attackAngle === null ? "Average not available" : profile.attackAngle < 0 ? "Barrel traveling downward" : profile.attackAngle === 0 ? "Barrel traveling level" : "Barrel traveling upward"},
        {kind:"vertical",title:"Vertical Bat Angle",value:profile.verticalBatAngle,description:"The tilt of your bat at contact.",reading:profile.verticalBatAngle === null ? "Average not available" : profile.verticalBatAngle < 0 ? "Barrel below the hands" : profile.verticalBatAngle === 0 ? "Barrel level with the hands" : "Barrel above the hands"}] as const).map(item=><figure className={styles.angleCard} key={item.kind}>
          <figcaption className={styles.angleHeading}><div><h3>{item.title}</h3><p>{item.description}</p></div><div className={styles.angleValue} data-kind={item.kind}><strong>{item.value === null ? "—" : degrees(item.value)}</strong><span>Fall Average</span></div></figcaption>
          <SwingAngleDiagram angle={item.value} kind={item.kind}/>
          <p className={styles.diagramLegend}><span className={styles.legendDot} data-kind={item.kind}/>{item.reading}</p>
        </figure>)}
    </div>
    <p className={styles.poseNote}><Info size={14} aria-hidden="true"/><span>Illustrated posture · measured bat angles. This is a guide to your average bat path, not a recording of your body motion.</span></p>

    <section className={styles.study} aria-label="Professional hitters to study">
      <div className={styles.studyHeading}><div><p className={styles.eyebrow}>The Film Room</p><h3>Hitters to Study</h3></div><span className={styles.basis}>{basisLabel}</span></div>
      <p className={styles.studyIntro}>Professional swings to watch for bat-path ideas. Similar measurements do not mean identical mechanics.</p>
      {profile.height || profile.weight ? <p className={styles.yourSize}>Your recorded size: {profile.height && <span>{formatHeight(profile.height.value,"in")} <small>(tested {testedDate(profile.height.date)})</small></span>}{profile.height && profile.weight && " · "}{profile.weight && <span>{profile.weight.value.toFixed(1)} lb <small>(tested {testedDate(profile.weight.date)})</small></span>}</p> : <p className={styles.yourSize}>Height and weight will refine this list when recorded.</p>}
      {study.sizeFallback && <p className={styles.studyIntro}>No same-path references fit the recorded size window. These examples use bat path only.</p>}
      {study.matches.length ? <div className={styles.studyGrid}>{study.matches.map(reference=><article className={styles.proCard} key={reference.id}>
        <div className={styles.proTop}><span>MLB · {HITTER_STUDY_REFERENCE_SOURCE.season}</span><ArrowUpRight size={17} aria-hidden="true"/></div>
        <h4><a href={`https://www.mlb.com/player/${reference.id}`} target="_blank" rel="noopener noreferrer">{reference.name}<span className="sr-only"> — MLB profile, opens in a new tab</span></a></h4>
        <p className={styles.proSize}>{formatHeight(reference.heightInches,"in")}<span aria-hidden="true"> · </span>{reference.weightLb} lb</p>
        <div className={styles.proAngles}><div><span>Their Attack Angle</span><strong>{degrees(reference.attackAngle)}</strong></div><div><span>Your Practice Angle</span><strong>{degrees(profile.attackAngle!)}</strong></div></div>
        <div className={styles.speedContext}><span>Average Bat Speed · mph</span><div><span>MLB <strong>{reference.averageBatSpeed?.toFixed(1) ?? "—"}</strong></span><span>Your Practice <strong>{batSpeed?.toFixed(1) ?? "—"}</strong></span></div></div>
        <a className={styles.videoLink} href={`https://www.mlb.com/video/?q=${encodeURIComponent(`PlayerId == [${reference.id}] Order By Timestamp`)}`} target="_blank" rel="noopener noreferrer"><Play size={12} aria-hidden="true"/>MLB Videos<span className="sr-only"> for {reference.name}, opens in a new tab</span><ArrowUpRight size={12} aria-hidden="true"/></a>
        <p className={styles.watchCue}>Watch the barrel’s direction through contact.</p>
      </article>)}</div> : <div className={styles.empty}>{profile.attackAngle === null ? "Add a reviewed Blast average report to find professional study references." : "This MLB reference set has no hitter in your bat-path group within 5°. Your swing type is still shown above."}</div>}
      <p className={styles.sourceNote}>Your Blast practice averages vs. 2025 Statcast game averages. Different systems and swing samples; these are study references, not player grades. <a href={HITTER_STUDY_REFERENCE_SOURCE.leaderboardUrl} target="_blank" rel="noopener noreferrer">View MLB source <ArrowUpRight size={11} aria-hidden="true"/></a></p>
    </section>

    <details className={styles.methods}>
      <summary><span><Info size={15} aria-hidden="true"/>Swing Types &amp; Comparison Guide</span><ChevronDown size={16} aria-hidden="true"/></summary>
      <div className={styles.methodContent}>
        <p>Fall angles use the same swing-count-weighted Blast averages as the practice cards. Weekly peaks are not used. Missing readings, overlapping reports, or unclear swing counts can leave an angle unavailable. The figure supports angles from −90° to +90° without changing the saved readings.</p>
        <div className={styles.typeGuide}><div><h4>Bat Path Names</h4><dl><div><dt>Downhill Swing</dt><dd>Below 0°</dd></div><div><dt>Flat Driver</dt><dd>0° to below 10°</dd></div><div><dt>Rising Driver</dt><dd>10° to below 20°</dd></div><div><dt>High-Lift Swing</dt><dd>20° and above</dd></div></dl></div><div><h4>Barrel Tilt Names</h4><dl><div><dt>Deep Barrel</dt><dd>Below −40°</dd></div><div><dt>Mid-Tilt Barrel</dt><dd>−40° to below −20°</dd></div><div><dt>Shallow Barrel</dt><dd>−20° through 0°</dd></div><div><dt>Barrel Up</dt><dd>Above 0°</dd></div></dl></div></div>
        <p>These are custom Pacific descriptions, not good/bad grades or ideal swing targets. Attack angle and vertical bat angle describe different things. Pitch height and location can change both. The skeleton is a fixed illustration, not a personalized biomechanical reconstruction. <a href={BLAST_DEFINITIONS} target="_blank" rel="noopener noreferrer">Blast metric definitions</a>.</p>
        <p>The watch list uses {HITTER_STUDY_REFERENCE_SOURCE.referenceCount} qualified MLB hitters from 2025. It first selects the same bat-path group within 5° of attack angle. When recorded, height within 3 inches and weight within 30 lb narrow the list. Up to three examples are ordered by proximity in available size measurements, then attack angle. If none fit the size window, the list clearly switches to bat path only. These are custom search rules, not a validated similarity score.</p>
        <p>MLB listed sizes were retrieved September 29, 2026; they are not measured body composition or historical 2025 sizes. MLB angles and average bat speeds use competitive game swings, including misses; Blast uses your recorded practice swings. Bat speed is extra context and does not select or rank the study references. Weekly P95 values are never compared with MLB means. Video links open current MLB videos, which can include highlights and interviews from other seasons. We do not compare Blast vertical bat angle with Statcast swing-path tilt. No pro body-fat, muscle, joint-angle, or handedness match is inferred. <a href={HITTER_STUDY_REFERENCE_SOURCE.sampleDefinitionUrl} target="_blank" rel="noopener noreferrer">MLB swing definitions</a>.</p>
      </div>
    </details>
  </section>;
}
