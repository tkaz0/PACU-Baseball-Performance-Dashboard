import type { ReactNode } from "react";
import { DetailSection } from "@/components/detail-section";
import { Sparkline } from "@/components/charts/sparkline";
import { gameDirection } from "@/lib/game-metrics";
import type { TeamGameTrends, TrendPoint } from "@/lib/game-trends";
import { PlayerAvatar } from "@/components/player-avatar";
import { countLabel } from "@/lib/game-opportunities";
import Link from "next/link";
import { ArrowUpRight, ArrowRight, Activity, Upload, UsersRound, ChartNoAxesCombined, Trophy, Clock3, Crosshair, UserRound, ClipboardCheck, FolderOpen, FileChartColumn, Check, DraftingCompass, Target } from "lucide-react";
import { PacificLogo } from "@/components/pacific-brand";
import { StatInfo } from "@/components/stat-info";
import { formatTeamGameMetric, teamGameMetricStatus, type TeamGameMetric, type TeamGameSummary } from "@/lib/team-game-stats";
import { formatInnings } from "@/lib/pitching-stats";
import type { HomeSummary } from "@/lib/home-summary";
import type { DesignNavigation } from "@/lib/design-navigation";
import type { coachUpdateDigest } from "@/lib/coach-update-digest";
import type { HomeLeaderboard, HomeRank } from "@/lib/home-leaderboards";
import styles from "./dashboard-home.module.css";
import { DashboardVisit } from "@/components/dashboard-visit";
import type { DashboardVisitWindow } from "@/lib/personal-dashboard-server";
import type { VisitDigest } from "@/lib/dashboard-visit-digest";
import { WEEKLY_SOURCES, type WeeklySourceStatus as WeeklySourceStatusRow } from "@/lib/weekly-source-contract";
import { WeeklySourceStatus } from "@/components/weekly-source-status";

const date = (value: string, withYear = false) => new Date(value.length === 10 ? `${value}T12:00:00Z` : value).toLocaleDateString("en-US", { month: "short", day: "numeric", ...(withYear ? { year: "numeric" as const } : {}), timeZone: value.length === 10 ? "UTC" : "America/Los_Angeles" });
const opportunity = (metric: TeamGameMetric) => metric.pending ? teamGameMetricStatus(metric) : metric.opportunities === undefined ? "No chances recorded yet" : metric.opportunityLabel === "outs" ? `${formatInnings(metric.opportunities)} IP` : countLabel(metric.opportunities,metric.opportunityLabel??"");

function GameSnapshot({ summary, kind, trends = {}, streamedTrend }: { summary: TeamGameSummary; kind: "Hitting" | "Pitching"; trends?: Record<string, TrendPoint[]>; streamedTrend?: (metric: string, label: string) => ReactNode }) {
  const metrics = (kind === "Hitting" ? ["batting_est_slg", "batting_est_iso", "batting_est_wobacon", "batting_hh_pct"] : ["pitching_k_bb", "pitching_k9", "pitching_bb9", "pitching_whip"]).flatMap(key => summary.rates.filter(m => m.metric === key));
  const weak = summary.rates.find(m => m.metric === "weak_contact_pct"), hard = summary.rates.find(m => m.metric === "hard_contact_pct");
  const contactComplete = !!weak && !!hard && !weak.pending && !hard.pending && weak.value !== null && hard.value !== null && weak.opportunities === hard.opportunities;
  return <section className={styles.gameCard} data-discipline={kind.toLowerCase()} aria-label={`${kind} game snapshot`}>
    <div className={styles.sectionTitle}><div className={styles.cardTitle}><span className={styles.disciplineMark} aria-hidden="true">{kind === "Hitting" ? "H" : "P"}</span><h3>{kind}</h3></div><span className={styles.tag}>In-Game</span></div>
    {!summary.entries ? <p className={styles.empty}>Game results will appear after the next Fall sheet update.</p> : <>
      <dl className={styles.gameNumbers}>{metrics.map(m => {
        const width = !m.pending && m.value !== null && m.unit === "%" ? m.value : null;
        return <div key={m.metric}><dt>{m.label}<StatInfo metric={m.metric} label={m.label} scope="team" value={m.value} unit={m.unit}/></dt><dd><strong className={styles.gameValue}>{formatTeamGameMetric(m)}</strong><span className={styles.opportunities}>{opportunity(m)}</span>{(streamedTrend || Object.keys(trends).length > 0 || metrics.some(x => !x.pending && x.value !== null && x.unit === "%")) && <span className={styles.visualSlot}>{streamedTrend ? streamedTrend(m.metric, m.label) : (trends[m.metric]?.length ?? 0) > 1 ? <Sparkline points={trends[m.metric]} width={120} height={24} label={m.label} noun="sheet updates" lowerIsBetter={gameDirection(kind === "Hitting" ? "qpa_fall_2026" : "pitching_fall_2026", m.metric) === "lower"}/> : Object.keys(trends).length === 0 && width !== null && width >= 0 && width <= 100 ? <span className={styles.rateTrack} aria-hidden="true"><span style={{ width: `${width}%` }}/></span> : null}</span>}</dd></div>;
      })}</dl>
      {kind === "Hitting" ? <p className={styles.chartCaption}>Doubles and triples count as doubles · recorded results, not expected stats.</p> : contactComplete ? <div className={styles.contactSplit}><div><span>Contact Allowed</span><small>{weak.opportunities} classified contacts</small></div><div className={styles.contactTrack} role="img" aria-label={`Weak contact ${weak.value!.toFixed(1)} percent; hard contact ${hard.value!.toFixed(1)} percent`}><span style={{ width: `${weak.value}%` }}/><span style={{ width: `${hard.value}%` }}/></div><div className={styles.contactLegend}><span><i/>{weak.value!.toFixed(1)}% weak</span><span><i/>{hard.value!.toFixed(1)}% hard</span></div></div> : <p className={styles.chartCaption}>Recorded results; not adjusted for defense or luck.</p>}
    </>}
    <div className={styles.cardFoot}><span>{summary.players ? `${summary.players} ${summary.players === 1 ? "player" : "players"} recorded` : "Awaiting results"}</span>{summary.updatedAt && <time dateTime={summary.updatedAt} title="This is when the saved sheet numbers last changed.">Sheet changed {date(summary.updatedAt)}</time>}</div>
  </section>;
}

function RankRows({ rows, maximum, headshots = {}, reference }: { rows: HomeRank[]; maximum: number; headshots?: Readonly<Record<string, string>>; reference?: number }) {
  return <ol className={styles.rankList}>{rows.map(row => <li key={row.code} data-rank={row.rank} className={row.isYou ? styles.yourRow : undefined}>
    <span className={styles.rankNumber}>{String(row.rank).padStart(2, "0")}</span><PlayerAvatar name={row.name} path={headshots[row.code]} size={34}/><div className={styles.rankResult}><div><span className={styles.rankName}>{row.profileId ? <Link prefetch={false} href={`/athletes/${row.profileId}`}>{row.name}</Link> : row.name}{row.isYou && <small>You</small>}</span><strong className={styles.rankValue}>{row.value}</strong></div>{row.numericValue !== undefined && Number.isFinite(row.numericValue) && row.numericValue >= 0 && maximum > 0 && <span className={styles.rankTrack} aria-hidden="true"><span style={{ width: `${row.numericValue / maximum * 100}%` }}/>{reference !== undefined && reference <= maximum && <i className={styles.referenceTick} style={{ left: `${reference / maximum * 100}%` }}/>}</span>}{row.sample && <small className={styles.rankSample}>{row.sample}{row.early && <span className={styles.earlyTag}>Early sample</span>}</small>}</div>
  </li>)}</ol>;
}
function HomeRankCard({ board, headshots }: { board: HomeLeaderboard; headshots?: Readonly<Record<string, string>> }) {
  const maximum = Math.max(0, ...board.rows.map(row => Number.isFinite(row.numericValue) ? row.numericValue! : 0));
  return <article className={styles.rankCard} aria-label={`${board.title} team leaderboard`}>
    <div className={styles.rankCardHead}><div><p className={styles.kicker}>{board.category}</p><h3>{board.title}{board.metric&&<StatInfo metric={board.metric} label={board.title} source={board.source} unit={board.unit} period={board.period} eventId={board.eventId}/>}</h3></div><Trophy size={17} aria-hidden="true"/></div>
    <RankRows rows={board.rows.slice(0, 3)} maximum={maximum} headshots={headshots} reference={board.metric === "batting_production_plus" ? 100 : undefined}/>
    <div className={styles.rankMeta}><span>{board.total} {board.total === 1 ? "player" : "players"}{board.metric === "batting_production_plus" ? " · Tick = team average (100)" : maximum > 0 ? " · Bars start at zero" : ""}</span>{board.yourRank !== null && <span>You: <strong>#{board.yourRank}</strong></span>}</div>
    <Link prefetch={false} href={board.href} className={styles.rankFooter}>Full Leaderboard<ArrowUpRight size={14} aria-hidden="true"/></Link>
  </article>;
}
export function CoachThisWeek({ digest, reviewCount }: { digest: ReturnType<typeof coachUpdateDigest>; reviewCount: number }) {
  const recent = digest.updatedPlayers[0], followUp = digest.stale[0];
  return <section aria-label="This week for coaches">
    <div className={styles.blockHeading}><div><p className={styles.kicker}>Coaching Desk</p><h2>This Week</h2></div></div>
    <div className={styles.weekGrid}>
      <article className={styles.weekCard}><span className={styles.weekIcon}><Activity size={20} aria-hidden="true"/></span><div><div className={styles.weekCardTitle}><h3>Players With New Results</h3><strong>{digest.updatedPlayers.length}</strong></div><p>Last 7 days · {digest.changes.length} {digest.changes.length===1?"result":"results"} changed 5%+ from an earlier test</p>{recent && <p className={styles.weekPreview}>Latest: <Link prefetch={false} href={`/athletes/${recent.id}`}>{recent.name}</Link></p>}<Link prefetch={false} href="/testing/changes" className={styles.panelLink}>Review Changes<ArrowRight size={13}/></Link></div></article>
      <article className={styles.weekCard}><span className={styles.weekIcon}><Crosshair size={20} aria-hidden="true"/></span><div><div className={styles.weekCardTitle}><h3>Retests Due</h3><strong>{digest.stale.length}</strong></div><p>No saved result in 21+ days</p>{followUp ? <p className={styles.weekPreview}>Follow up: <Link prefetch={false} href={`/athletes/${followUp.id}`}>{followUp.name}</Link></p> : null}<Link prefetch={false} href="/testing/coverage" className={styles.panelLink}>Testing Checklist<ArrowRight size={13}/></Link></div></article>
      <article className={styles.weekCard} data-attention={reviewCount > 0 || undefined}><span className={styles.weekIcon}><ClipboardCheck size={20} aria-hidden="true"/></span><div><div className={styles.weekCardTitle}><h3>Game-Stat Review</h3><strong>{reviewCount}</strong></div><p>{reviewCount ? "Rates needing a source-count check" : "No team rates flagged"}</p><Link prefetch={false} href="/game-stats/review" className={styles.panelLink}>Review Game Stats<ArrowRight size={13}/></Link></div></article>
    </div>
  </section>;
}
function ResultsCoverage({ summary, staff, profile }: { summary: HomeSummary; staff: boolean; profile: string | null }) {
  const coverage = summary.coverage.filter(area => staff || area.eligiblePlayers > 0);
  const savedAreas = coverage.filter(area => area.players > 0).length;
  const numerator = staff ? summary.playersWithResults : savedAreas, denominator = staff ? summary.players : coverage.length;
  const fraction = denominator > 0 ? Math.min(1, numerator / denominator) : 0;
  return <section className={styles.panel} aria-label={staff ? "Fall roster coverage" : "Your latest testing"}>
    <div className={styles.sectionTitle}><div><p className={styles.kicker}>{staff ? "Team Development" : "Your Development"}</p><h2>{staff ? "Saved Fall Results" : "Your Results"}</h2></div><Crosshair size={20} className={styles.subtleIcon}/></div>
    <div className={styles.coverageBody}><div className={styles.coverageRing} role="img" aria-label={`${numerator} of ${denominator} ${staff ? "players with results" : "areas with results"}`}><svg viewBox="0 0 100 100" aria-hidden="true"><circle className={styles.ringTrack} cx="50" cy="50" r="42"/><circle className={styles.ringValue} cx="50" cy="50" r="42" pathLength="100" strokeDasharray={`${fraction * 100} 100`}/></svg><span><strong>{numerator}<small>/{denominator}</small></strong><small>{staff ? "players" : "areas"}</small></span></div>
      <div className={styles.coverageList}>{coverage.map(area => <div className={styles.coverageRow} key={area.key}><div><strong>{area.label}{staff && area.positionOnly && <small>Position Players · Includes Two-Way</small>}</strong><span>{staff ? `${area.players} / ${area.eligiblePlayers}` : area.players > 0 ? <Check size={14} aria-label="Results available"/> : "Not yet"}</span></div>{staff ? <meter min={0} max={Math.max(1, area.eligiblePlayers)} value={area.players} aria-label={`${area.label}: ${area.players} of ${area.eligiblePlayers} ${area.positionOnly ? "position players" : "players"} with results`}/> : <small>{area.lastTested ? `Last tested ${date(area.lastTested)}` : "Awaiting results"}</small>}</div>)}</div>
    </div><div className={styles.panelFoot}><span>{staff ? "Any saved test or game result · not checklist completion" : "Fall 2026 saved results"}</span><Link prefetch={false} href={staff ? "/testing/coverage" : profile ?? "/settings"}>{staff ? "Checklist Coverage" : "My Results"}<ArrowRight size={14}/></Link></div>
  </section>;
}

export function DashboardHome({ spotlight, staff, athleteId, summary, designNavigation, leaderboards = [], sourceStatus = [], visit, headshots = {}, gameTrends = {}, streamedTrend, coachingPulse, activity }: { spotlight?:ReactNode; coachingPulse?:ReactNode; activity?:ReactNode; streamedTrend?: (source: "qpa_fall_2026" | "pitching_fall_2026", metric: string, label: string) => ReactNode; gameTrends?: TeamGameTrends; headshots?: Readonly<Record<string, string>>; visit?:DashboardVisitWindow; staff: boolean; athleteId: string | null; designNavigation?: DesignNavigation; summary: (HomeSummary & { visitDigest?:VisitDigest; coachDigest?: ReturnType<typeof coachUpdateDigest> }) | null; leaderboards?: HomeLeaderboard[]; sourceStatus?:WeeklySourceStatusRow[] }) {
  const sourceAttention = WEEKLY_SOURCES.filter(source => sourceStatus.find(status => status.source === source.key)?.outcome !== "completed").length;
  const profile = athleteId ? `/athletes/${athleteId}` : null;
  const actions = [...(staff ? [
    { href: "/roster", title: "Roster", detail: "Player profiles", icon: UsersRound },
    { href: "/imports", title: "Import Results", detail: "Add a session", icon: Upload },
    { href: "/analytics", title: "Analytics", detail: "Explore team trends", icon: ChartNoAxesCombined },
    { href: "/imports/sessions", title: "Session Library", detail: "Review saved reports", icon: FolderOpen },
    { href: "/exit-meetings", title: "Exit Meetings", detail: "Build a player report", icon: FileChartColumn },
  ] : [
    ...(profile ? [{ href: profile, title: "My Profile", detail: "My player card", icon: UserRound }] : []),
    { href: "/game-stats", title: "My Game Stats", detail: "Fall results", icon: Activity },
    { href: "/leaderboards", title: "Leaderboards", detail: "Team rankings", icon: Trophy },
  ]),
    ...(staff || (profile && designNavigation?.swing) ? [{ href: "/swing-design", title: "Swing Design", detail: "Explore hitting practice", icon: DraftingCompass }] : []),
    ...(staff || (profile && designNavigation?.pitch) ? [{ href: "/pitch-design", title: "Pitch Design", detail: "Explore your arsenal", icon: Target }] : []),
  ];
  const latestUpdate = summary?.updates[0];
  const latestGameUpdate = [summary?.batting.updatedAt, summary?.pitching.updatedAt].filter((value): value is string => !!value).sort().at(-1);
  return <div className={styles.home}>
    <header className={styles.welcome}>
      <div className={styles.welcomeTitle}><div className={styles.homeMark}><span className={styles.markOnDark}><PacificLogo variant="university" tone="dark" decorative/></span><span className={styles.markOnLight}><PacificLogo variant="university" tone="light" decorative/></span></div><div><p className={styles.kicker}>Boxer Baseball <span>/</span> Fall 2026</p><h1>{staff ? "Team Dashboard" : "My Dashboard"}</h1><p>{staff ? "Your team, at a glance." : "Your work. Your progress. Your next step."}</p></div></div>
      <Link prefetch={false} href={staff ? "/roster" : profile ?? "/settings"} className={styles.heroAction}>{staff ? "Explore Roster" : profile ? "Open My Profile" : "Account Settings"}<ArrowUpRight size={17}/></Link>
    </header>
    {summary && <div className={styles.freshness} aria-label="Dashboard update dates"><span><span className={styles.statusDot}/>{latestUpdate ? <>Latest Update <strong>{date(latestUpdate.date, true)}</strong></> : "Awaiting Fall results"}</span><span><Clock3 size={13} aria-hidden="true"/>Game Stats <strong>{latestGameUpdate ? date(latestGameUpdate, true) : "Awaiting results"}</strong></span></div>}
    {summary && staff && (coachingPulse ?? (summary.coachDigest && <CoachThisWeek digest={summary.coachDigest} reviewCount={[...summary.batting.rates, ...summary.pitching.rates].filter(rate => rate.pending && rate.pendingReason !== "missing").length}/>))}
    {staff && spotlight}
    {!summary ? staff ? <section className={styles.panel}><h2>Team summary unavailable</h2><p className={styles.empty}>Saved results are unaffected. Refresh to try again.</p></section> : <section className={styles.panel}><h2>Your profile is being connected</h2><p className={styles.empty}>Your administrator will link your account to the correct player profile. Your results will appear here once it is connected.</p></section> : <>
      <section aria-label="Fall game summary"><div className={styles.blockHeading}><div><p className={styles.kicker}>Competition</p><h2>{staff ? "Team Advanced Performance" : "My Advanced Performance"}</h2></div><Link prefetch={false} href="/game-stats" className={styles.panelLink}>All Game Stats<ArrowRight size={15}/></Link></div><div className={styles.gameGrid}>{(staff || summary.batting.entries > 0) && <GameSnapshot summary={summary.batting} kind="Hitting" trends={gameTrends.qpa_fall_2026} streamedTrend={streamedTrend ? (metric,label)=>streamedTrend("qpa_fall_2026",metric,label) : undefined}/>}{(staff || summary.pitching.entries > 0) && <GameSnapshot summary={summary.pitching} kind="Pitching" trends={gameTrends.pitching_fall_2026} streamedTrend={streamedTrend ? (metric,label)=>streamedTrend("pitching_fall_2026",metric,label) : undefined}/>}{!staff && !summary.batting.entries && !summary.pitching.entries && <p className={styles.empty}>Your game stats will appear after your first verified Fall update.</p>}</div></section>
      {!staff && <nav className={styles.quickLinks} aria-label="Home shortcuts">{actions.map(({ href, title, detail, icon: Icon }) => <Link prefetch={false} key={href} href={href}><span className={styles.actionIcon}><Icon size={18}/></span><span><strong>{title}</strong><small>{detail}</small></span><ArrowUpRight className={styles.actionArrow} size={14}/></Link>)}</nav>}
        <div className={styles.leadersColumn}>
      <section aria-label="Featured team leaderboards"><div className={styles.blockHeading}><div><p className={styles.kicker}>Around the Team</p><h2>Performance Leaders</h2></div><Link prefetch={false} href="/leaderboards" className={styles.panelLink}>All Leaderboards<ArrowRight size={15}/></Link></div>{leaderboards.length ? <div className={styles.rankGrid}>{leaderboards.map(board => <HomeRankCard board={board} key={board.key} headshots={headshots}/>)}</div> : <div className={styles.rankEmpty}><Trophy size={23} aria-hidden="true"/><p>Team rankings will appear when Fall results are saved.</p></div>}</section>
        </div>
      <DetailSection title={staff ? "Data & Testing" : "My Activity & Testing"} description={staff ? `${sourceAttention ? `${sourceAttention} sources need attention · ` : ""}Source checks, testing coverage and recent updates` : "Testing dates and recent updates"}>
      {activity ?? (summary.visitDigest && visit && <DashboardVisit visit={visit} digest={summary.visitDigest} staff={staff} athleteId={athleteId}/>)}
        <div className={styles.attention} aria-label="Needs attention">
        {staff && <WeeklySourceStatus statuses={sourceStatus}/>}
        <ResultsCoverage summary={summary} staff={staff} profile={profile}/>
        <section className={styles.panel} aria-label="Recent data updates"><div className={styles.sectionTitle}><div><p className={styles.kicker}>Fresh from the Field</p><h2>Recent Updates</h2></div><Clock3 size={20} className={styles.subtleIcon}/></div>{summary.updates.length ? <ol className={styles.updates}>{summary.updates.slice(0, 3).map(update => <li key={update.key}><span className={styles.updateDot}/><div><strong>{update.label}</strong><span>{update.kind} to the dashboard</span></div><time dateTime={update.date}>{date(update.date)}</time></li>)}</ol> : <p className={styles.empty}>Updates appear when Fall measurements or game stats are saved.</p>}<div className={styles.panelFoot}><span>Most recent activity</span><Link prefetch={false} href={staff ? "/testing/changes" : profile ?? "/settings"}>{staff ? "See What Changed" : "Open My Profile"}<ArrowRight size={14}/></Link></div></section>
        </div>
      </DetailSection>
    </>}
  </div>;
}
