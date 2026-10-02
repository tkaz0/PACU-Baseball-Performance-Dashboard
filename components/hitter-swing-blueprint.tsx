import { ArrowUpRight, ChevronDown, Info, Play, ScanLine } from "lucide-react";
import { blastPeriodLabel } from "@/lib/blast-metrics";
import { hitterSwingProfile } from "@/lib/hitter-swing-profile";
import { hitterStudyMatches, proBatSpeedPercentile, proBodyPercentile } from "@/lib/hitter-study-matches";
import { FEATURED_HITTER_STUDY_IDS } from "@/lib/hitter-study-featured";
import { HITTER_STUDY_REFERENCE_SOURCE } from "@/lib/hitter-study-references";
import { hittingTeamAverage, type HittingTeamAverage } from "@/lib/hitting-team-averages";
import { formatHeight } from "@/lib/measurement-display";
import type { Measurement } from "@/lib/imports/engine";
import type { PlayerPerformance } from "@/lib/player-performance";
import type { BlastBatSpeedPercentile } from "@/lib/blast-speed-percentile";
import { PercentileBar } from "@/components/percentile-bar";
import styles from "./hitter-swing-blueprint.module.css";

const BLAST_DEFINITIONS = "https://blast-motion.helpjuice.com/what-are-the-blast-baseball-metrics-47-version";
function degrees(value: number) { return `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(1)}°`; }
function ordinal(value:number) { const n=Math.round(value), last=n%100; return `${n}${last>=11&&last<=13?"th":n%10===1?"st":n%10===2?"nd":n%10===3?"rd":"th"}`; }
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
      <text x="398" y="27" textAnchor="end" fill="#adbdd0" fontSize="16">DASHED LINE · 0°</text>
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
      <text x="22" y="27" fill={isAttack ? "#63c9ff" : "#ff8c99"} fontSize="16" fontWeight="700" letterSpacing="1.6">{isAttack ? "BARREL TRAVEL" : "BAT SHAFT TILT"}</text>
    </g>
    {angle === null && <g><rect x="73" y="113" width="274" height="55" rx="8" fill="#101c2a" stroke="#53657c"/><text x="210" y="146" textAnchor="middle" fill="#e5edf7" fontSize="18">Awaiting a reviewed average</text></g>}
  </svg>;
}

/** Blast infers a rotation axis from hand trajectory; this is not measured spine motion. */
export function BodyTiltDiagram({ angle }: { angle: number | null }) {
  const x=210, y=188, end=angle===null?null:point(x,y,112,90-angle), arcEnd=angle===null?null:point(x,y,43,90-angle);
  return <svg viewBox="0 0 420 300" className={styles.diagram} role="img" aria-label={`Body Tilt Angle: ${angle===null?"no reviewed average available":degrees(angle)}. Blast-reported rotation axis relative to vertical; illustrative posture, not measured spine motion.`} data-angle={angle??undefined} data-angle-kind="body">
    <g aria-hidden="true">
      <g opacity=".35" transform="translate(29 12)"><BattingSkeleton/></g>
      <path d={`M${x} 40V265M85 278H335`} stroke="#9cabbc" strokeWidth="1.5" strokeDasharray="4 5"/>
      <text x="22" y="27" fill="#e8ba69" fontSize="16" fontWeight="700" letterSpacing="1.6">BODY ROTATION AXIS</text>
      <text x="398" y="27" textAnchor="end" fill="#adbdd0" fontSize="16">DASHED LINE · VERTICAL</text>
      {end&&arcEnd&&angle!==null&&<g fill="none" stroke="#e8ba69" strokeLinecap="round">
        <path d={`M${x} ${y}L${end.x} ${end.y}`} strokeWidth="5"/>
        {Math.abs(angle)>.05&&<path d={`M${x} ${y-43} A43 43 0 0 ${angle>=0?1:0} ${arcEnd.x} ${arcEnd.y}`} strokeWidth="2"/>}
        <circle cx={x} cy={y} r="6" fill="#101c2a" strokeWidth="2"/>
        <circle cx={end.x} cy={end.y} r="5" fill="#e8ba69"/>
      </g>}
    </g>
    {angle===null&&<g><rect x="73" y="113" width="274" height="55" rx="8" fill="#101c2a" stroke="#53657c"/><text x="210" y="146" textAnchor="middle" fill="#e5edf7" fontSize="18">Awaiting a reviewed average</text></g>}
  </svg>;
}

export function HitterSwingBlueprint({ readings, performance, teamAverages=[], bats, batSpeedReference }: { readings: readonly Measurement[]; performance: PlayerPerformance; teamAverages?:readonly HittingTeamAverage[]; bats?:string|null; batSpeedReference?:BlastBatSpeedPercentile|null }) {
  const profile = hitterSwingProfile(readings,performance), {summary,path,tilt} = profile;
  if (!summary) return null;
  const batSpeed = profile.averageBatSpeed;
  // The independent aggregate read must describe the exact same personal reports.
  const speedReference = batSpeedReference && batSpeed!==null && Math.abs(batSpeedReference.observedValue-batSpeed)<=Math.max(1,Math.abs(batSpeed))*1e-12 &&
    batSpeedReference.firstDate===summary.firstDate && batSpeedReference.lastDate===summary.lastDate && batSpeedReference.swingCount===summary.totalSwings && batSpeedReference.reportCount===summary.reportCount ? batSpeedReference : null;
  const ownPercentile = speedReference && speedReference.sampleSize>=5 && speedReference.percentile!==null && Number.isFinite(speedReference.percentile) && speedReference.percentile>=0 && speedReference.percentile<=100 ? speedReference.percentile : null;
  const study = hitterStudyMatches(profile,undefined,{bats});
  const team = hittingTeamAverage(teamAverages,"avg_bat_speed","mph","blast_fall");
  const teamSpeed = team && team.method === "swing_weighted" && Number.isFinite(team.value) && team.value >= 0 ? team.value : null;
  const speedScale = Math.max(5,Math.ceil(Math.max(batSpeed??0,teamSpeed??0)*1.1/5)*5);
  const speedDifference = batSpeed !== null && teamSpeed !== null ? batSpeed-teamSpeed : null;
  const period = summary.firstDate && summary.lastDate ? blastPeriodLabel(summary.firstDate,summary.lastDate) : null;
  const basisLabel = {path_and_size:"Bat Path + Relative Build",path_and_height:"Bat Path + Height Rank",path_and_weight:"Bat Path + Weight Rank",path_only:"Bat Path",none:"Awaiting a Comparable Reference"}[study.basis];
  return <section className={styles.blueprint} aria-label="Practice swing blueprint" data-testid="hitter-swing-blueprint">
    <header className={styles.heading}>
      <div><p className={styles.eyebrow}><ScanLine size={15} aria-hidden="true"/>Practice · Angles &amp; Posture</p><h2>{path?.name ?? "Your Swing Blueprint"}</h2><p className={styles.subtitle}>{path?.label ?? "A swing type appears with a reviewed average."}{tilt && <><span aria-hidden="true"> / </span>{tilt.label}</>}</p></div>
      <div className={styles.sample}><strong>{summary.totalSwings?.toLocaleString("en-US") ?? "—"}</strong><span>Practice Swings</span>{period && <small>{period}</small>}</div>
    </header>
    <div className={styles.angleGrid}>
      {([{kind:"attack",title:"Attack Angle",value:profile.attackAngle,description:"The direction your barrel is traveling at contact.",reading:profile.attackAngle === null ? "Average not available" : profile.attackAngle < 0 ? "Barrel traveling downward" : profile.attackAngle === 0 ? "Barrel traveling level" : "Barrel traveling upward"},
        {kind:"vertical",title:"Vertical Bat Angle",value:profile.verticalBatAngle,description:"The tilt of your bat at contact.",reading:profile.verticalBatAngle === null ? "Average not available" : profile.verticalBatAngle < 0 ? "Barrel below the hands" : profile.verticalBatAngle === 0 ? "Barrel level with the hands" : "Barrel above the hands"},
        {kind:"body",title:"Body Tilt Angle",value:profile.bodyTiltAngle,description:"Blast’s body rotation axis relative to upright.",reading:profile.bodyTiltAngle===null?"Average not available":"Sensor-derived tilt · not spine tracking"}] as const).map(item=><figure className={styles.angleCard} key={item.kind}>
          <figcaption className={styles.angleHeading}><div><h3>{item.title}</h3><p>{item.description}</p></div><div className={styles.angleValue} data-kind={item.kind}><strong>{item.value === null ? "—" : degrees(item.value)}</strong><span>Fall Average</span></div></figcaption>
          {item.kind==="body"?<BodyTiltDiagram angle={item.value}/>:<SwingAngleDiagram angle={item.value} kind={item.kind}/>}
          <p className={styles.diagramLegend}><span className={styles.legendDot} data-kind={item.kind}/>{item.reading}</p>
        </figure>)}
    </div>
    <p className={styles.poseNote}><Info size={14} aria-hidden="true"/><span>Your three Blast angles, illustrated. Body tilt is sensor-derived; the skeleton is not a recording of your body motion.</span></p>



    <section className={styles.study} aria-label="Professional hitters to study">
      <div className={styles.studyHeading}><div><p className={styles.eyebrow}>The Film Room</p><h3>Hitters to Study</h3></div><span className={styles.basis}>{basisLabel}</span></div>
      <p className={styles.studyIntro}>Same-side swings from {FEATURED_HITTER_STUDY_IDS.length} familiar MLB names. Bat path leads the match; relative build is a secondary reference.</p>
      {profile.height || profile.weight ? <p className={styles.yourSize}>Your recorded size: {profile.height && <span>{formatHeight(profile.height.value,"in")} <small>(tested {testedDate(profile.height.date)})</small></span>}{profile.height && profile.weight && " · "}{profile.weight && <span>{profile.weight.value.toFixed(1)} lb <small>(tested {testedDate(profile.weight.date)})</small></span>}</p> : <p className={styles.yourSize}>Height and weight will refine this list when recorded.</p>}
      <p className={styles.sourceNote}>VBA and body tilt guide what to watch in film. Comparable MLB readings for those angles are not available in this reference set.</p>
      {study.matches.length ? <div className={styles.studyGrid}>{study.matches.map(reference=><article className={styles.proCard} key={reference.id}>
        <div className={styles.proTop}><span>MLB · {HITTER_STUDY_REFERENCE_SOURCE.season}</span><span>{reference.bats === "S" ? "Switch Hitter" : reference.bats ? `${reference.bats}HB` : "Side Unlisted"}</span></div>
        <h4><a href={`https://www.mlb.com/player/${reference.id}`} target="_blank" rel="noopener noreferrer">{reference.name}<span className="sr-only"> — MLB profile, opens in a new tab</span></a></h4>
        <p className={styles.proSize}>{formatHeight(reference.heightInches,"in")}<span aria-hidden="true"> · </span>{reference.weightLb} lb</p>
        <div className={styles.proAngles}><div><span>Their Attack Angle</span><strong>{degrees(reference.attackAngle)}</strong></div><div><span>Your Practice Angle</span><strong>{degrees(profile.attackAngle!)}</strong></div></div>
        <div className={styles.bodyRanks} aria-label={`${reference.name} relative build comparison`}><h5>Build · Relative Ranks</h5>
          <div className={styles.rankColumns}><span/><span>You · Pacific</span><span>Pro · MLB</span></div>
          {([{key:"height",label:"Height",own:profile.heightRank},{key:"weight",label:"Weight",own:profile.weightRank}] as const).map(item=>{const pro=proBodyPercentile(reference,item.key);return <div className={styles.bodyRankRow} key={item.key}>
            <span>{item.label}</span>{[{rank:item.own,group:"Pacific",kind:"player"},{rank:pro,group:"MLB",kind:"pro"}].map(({rank,group,kind})=><div key={kind} aria-label={`${item.label}: ${rank?`${ordinal(rank.value)} percentile among ${rank.sampleSize} ${group} players`:`${group} rank unavailable`}`}><strong>{rank?ordinal(rank.value):"—"}</strong><div className={styles.rankTrack} aria-hidden="true"><span data-kind={kind} style={{width:rank?`${rank.value}%`:"0%"}}/></div></div>)}
          </div>})}
          <small>Height and weight describe build, not strength or ability.{(!profile.heightRank||!profile.weightRank)&&" Missing Pacific ranks are left out of matching."}</small>
        </div>
        <a className={styles.videoLink} href={`https://www.mlb.com/video/?q=${encodeURIComponent(`PlayerId == [${reference.id}] Order By Timestamp`)}`} target="_blank" rel="noopener noreferrer"><Play size={12} aria-hidden="true"/>MLB Videos<span className="sr-only"> for {reference.name}, opens in a new tab</span><ArrowUpRight size={12} aria-hidden="true"/></a>
        <p className={styles.watchCue}>Watch the barrel angle and upper-body tilt as the bat moves through contact.</p>
      </article>)}</div> : <div className={styles.empty}>{!["R","L","S"].includes(bats?.trim().toUpperCase()??"") ? "Add a verified batting side to the roster before choosing same-side MLB examples." : profile.attackAngle === null ? "Add a reviewed Blast average report to find professional study references." : "No same-side hitter in the featured MLB pool fits your bat-path group within 5°. Your swing blueprint is still shown above."}</div>}
      <p className={styles.sourceNote}>Your Blast practice averages vs. 2025 Statcast game averages. Different systems and swing samples; these are study references, not player grades. <a href={HITTER_STUDY_REFERENCE_SOURCE.leaderboardUrl} target="_blank" rel="noopener noreferrer">View MLB source <ArrowUpRight size={11} aria-hidden="true"/></a></p>
    </section>

    <details className={styles.secondarySpeed} data-testid="swing-supporting-speed">
      <summary><span>Bat Speed · Supporting Detail<small>Optional reference · not used for swing matching</small></span><ChevronDown size={16} aria-hidden="true"/></summary>
    <section className={styles.teamSpeed} aria-label="Practice bat speed compared with Pacific" data-testid="swing-team-bat-speed">
      <div className={styles.studyHeading}><div><p className={styles.eyebrow}>Pacific Comparison</p><h3>Practice Bat Speed</h3></div>{speedDifference !== null && <span className={styles.basis}>{Math.abs(speedDifference)<.05 ? "At the Team Average" : `${Math.abs(speedDifference).toFixed(1)} mph ${speedDifference>0?"Above":"Below"} Team Average`}</span>}</div>
      <div className={styles.speedBars}>
        {[{label:"Your Fall Average",value:batSpeed,kind:"player"},{label:"Pacific Fall Average",value:teamSpeed,kind:"team"}].map(row=><div className={styles.speedRow} key={row.kind} data-speed-kind={row.kind}>
          <div><span>{row.label}</span><strong>{row.value === null ? "—" : `${row.value.toFixed(1)} mph`}</strong></div>
          <div className={styles.speedTrack} aria-hidden="true"><span data-kind={row.kind} style={{width:row.value === null ? "0%" : `${row.value/speedScale*100}%`}}/></div>
        </div>)}
      </div>
      <div className={styles.speedMeta}><span>Blast Practice · Average Reports Only</span><span>Scale: 0–{speedScale} mph</span></div>
      {teamSpeed !== null && team ? <details className={styles.teamMethod}><summary>{team.athleteCount} Players · {team.swingCount?.toLocaleString("en-US")} Team Swings</summary><p>Pacific’s Fall average is weighted by recorded swing counts, including your eligible swings. It uses the same Blast practice source as your average. In-game readings, MLB speeds and weekly peaks are excluded. Team report dates: {blastPeriodLabel(team.firstDate,team.lastDate)}.</p></details> : <p className={styles.sourceNote}>The team comparison appears when shared Blast practice averages are available.</p>}
    </section>
      {study.matches.length>0&&<div className={styles.supportingGrid} aria-label="Supporting MLB bat-speed references">{study.matches.map(reference=>{const proPercentile=proBatSpeedPercentile(reference);return <div className={styles.proCard} key={reference.id}><h4>{reference.name}</h4>
        <div className={styles.relativeSpeed} data-testid="study-bat-speed-percentiles"><h5>Bat Speed · Relative Rank</h5>
          <div><p><span>You · Pacific Percentile</span><strong>{ownPercentile===null ? "—" : ordinal(ownPercentile)}</strong></p>{ownPercentile!==null && <PercentileBar value={ownPercentile} sampleSize={speedReference!.sampleSize} label="Your Blast bat speed"/>}</div>
          <div><p><span>Pro · MLB Percentile</span><strong>{proPercentile===null ? "—" : ordinal(proPercentile.value)}</strong></p>{proPercentile && <PercentileBar value={proPercentile.value} sampleSize={proPercentile.sampleSize} label={`${reference.name} bat speed`} cohortLabel="MLB"/>}</div>
          <small>{ownPercentile!==null ? `${speedReference!.sampleSize} Pacific hitters` : "Pacific rank unavailable"} · {proPercentile?.sampleSize??0} MLB hitters</small>
        </div>

      </div>})}</div>}
    </details>

    <details className={styles.methods}>
      <summary><span><Info size={15} aria-hidden="true"/>Swing Types &amp; Comparison Guide</span><ChevronDown size={16} aria-hidden="true"/></summary>
      <div className={styles.methodContent}>
        <p>Fall angles use the same swing-count-weighted Blast averages as the practice cards. Weekly peaks are not used. Missing readings, overlapping reports, or unclear swing counts can leave an angle unavailable. The figure supports angles from −90° to +90° without changing the saved readings.</p>
        <div className={styles.typeGuide}><div><h4>Bat Path Names</h4><dl><div><dt>Downhill Path</dt><dd>Below 0°</dd></div><div><dt>Flat Path</dt><dd>0° to below 10°</dd></div><div><dt>Lift Path</dt><dd>10° to below 20°</dd></div><div><dt>Steep Path</dt><dd>20° and above</dd></div></dl></div><div><h4>Barrel Angle Names</h4><dl><div><dt>Deep Barrel Tilt</dt><dd>Below −40°</dd></div><div><dt>Angled Barrel</dt><dd>−40° to below −20°</dd></div><div><dt>Flat Barrel</dt><dd>−20° through 0°</dd></div><div><dt>Barrel Up</dt><dd>Above 0°</dd></div></dl></div></div>
        <p>These are custom Pacific descriptions, not good/bad grades or ideal swing targets. “Deep Barrel Tilt” describes the barrel’s downward angle from the hands, not how deep you let the ball travel. “Out Front” and “Deep Contact” need contact-point measurements that these reports do not provide. Attack angle and vertical bat angle describe different things. Pitch height and location can change both. The skeleton is a fixed illustration, not a personalized biomechanical reconstruction. <a href={BLAST_DEFINITIONS} target="_blank" rel="noopener noreferrer">Blast metric definitions</a>.</p>
        <p>The watch list selects from {FEATURED_HITTER_STUDY_IDS.length} familiar names within {HITTER_STUDY_REFERENCE_SOURCE.referenceCount} qualified MLB hitters from 2025. It requires the same recorded batting hand, bat-path group, and attack angle within 5°. There are no opposite-side fallbacks. Switch hitters compare with switch hitters because these season averages do not separate each stance. Attack-angle similarity supplies 70% of the ordering; available relative height and weight together supply 30%. Angle gaps are divided by the 5° window and body-rank gaps by 100 percentile points. Without a valid body rank, ordering uses attack angle alone. Bat speed does not affect selection. Missing Pacific ranks are omitted. These are custom search rules, not a validated similarity score.</p>
        <p>Optional bat-speed percentiles are supporting context only and never affect the swing name or MLB selection. They rank each player within their own environment: your swing-weighted Fall Blast mean against eligible Pacific hitters, and each pro’s 2025 Statcast mean against the full qualified MLB reference set. Each hitter counts once, ties share a rank, and at least five comparable hitters are required. The same 80th percentile describes a similar place in two different groups—not equal mph, ability or MLB readiness. Weekly P95 reports are never used. Missing Pacific percentiles do not affect body/angle suggestions.</p>
        <p>Body-size percentiles rank your latest measured height and weight within the eligible Pacific roster’s same testing source, unit and period; the test dates appear above. Summer and Fall measurements do not share a cohort. Each MLB player’s listed height and weight rank against the complete {HITTER_STUDY_REFERENCE_SOURCE.referenceCount}-hitter reference set before filtering names or batting sides. Ties share a rank; at least five comparable players are required. Build matching uses height and weight only, not body fat or muscle composition.</p>
        <p>MLB listed sizes and batting sides were retrieved September 29, 2026; they are not measured body composition or historical 2025 sizes. MLB angles and bat speeds use competitive game swings, including misses; Blast uses your recorded practice swings. Video links open current MLB videos, which can include highlights and interviews from other seasons. No verified MLB vertical bat angle or body tilt measurements are available here, so neither enters the numerical match. We do not substitute Statcast swing-path tilt. <a href={HITTER_STUDY_REFERENCE_SOURCE.sampleDefinitionUrl} target="_blank" rel="noopener noreferrer">MLB swing definitions</a>.</p>
        <p>Blast’s body tilt is the angle between an inferred body rotation axis and vertical. The axis comes from hand motion, not measured spine joints. The highlighted line illustrates that reported angle; the body pose stays a drawing. <a href="https://patents.google.com/patent/US20210331057A1/en" target="_blank" rel="noopener noreferrer">Blast method · Figures 22 and 34</a>.</p>
      </div>
    </details>
  </section>;
}
