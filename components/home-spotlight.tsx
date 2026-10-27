import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";
import { PlayerAvatar } from "@/components/player-avatar";
import type { BwsRace, BwsRaces, SpotlightCard, SpotlightWeek } from "@/lib/home-spotlight";
import styles from "./home-spotlight.module.css";

const title = (card: SpotlightCard) => card.discipline === "hitting" ? "Hitter of the Week" : "Pitcher of the Week";

/** Weekly leaders from the existing Top Performer blend applied to each week's counts; no new score. */
/** One BWS race: the leader as a trading card, then the next contenders. Not an award until the series ends. */
function RaceColumn({ name, race, headshots }: { name: string; race: BwsRace; headshots: Readonly<Record<string, string>> }) {
  const [leader, ...chasers] = race.entries;
  if (!leader) return <article className={styles.card} data-bws>
    <div className={styles.photoBand}><span className={styles.ribbon}>BWS</span><p className={styles.title}><Trophy size={14} aria-hidden="true"/>{name}</p></div>
    <p className={styles.raceEmpty}>The race opens when five players reach {race.minimum} in the series ({race.qualified} so far).</p>
  </article>;
  return <article className={styles.card} data-spotlight={leader.discipline} data-bws>
    <div className={styles.photoBand}>
      <span className={styles.ribbon}>BWS</span>
      <p className={styles.title}><Trophy size={14} aria-hidden="true"/>{name}<span>{leader.tied ? "Tied for the lead" : "Leading"}</span></p>
      <PlayerAvatar name={leader.name} path={headshots[leader.code]} size={104} eager className={styles.cardPhoto}/>
    </div>
    <div className={styles.namePlate}><h3>{leader.profileId ? <Link prefetch={false} href={`/athletes/${leader.profileId}`}>{leader.name}</Link> : leader.name}</h3><small>{leader.detail}</small></div>
    <div className={styles.headline}><strong>{leader.headline.value}</strong><span>{leader.headline.label}</span></div>
    {!!leader.stats.length && <dl className={styles.stats}>{leader.stats.map(stat => <div key={stat.label}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}</dl>}
    {chasers.length > 0 && <ol className={styles.chasers} aria-label={`${name} contenders`}>{chasers.map(c => <li key={c.code}>
      <span className={styles.chaserRank}>{c.rank}</span><PlayerAvatar name={c.name} path={headshots[c.code]} size={28} className={styles.historyAvatar}/>
      <span className={styles.who}>{c.profileId ? <Link prefetch={false} href={`/athletes/${c.profileId}`}>{c.name}</Link> : <span className={styles.plainName}>{c.name}</span>}{c.tied && <em>Tied</em>}</span>
      <b>{c.headline.value} {c.headline.label}</b></li>)}</ol>}
    <p className={styles.basis}>{leader.sample ? `${leader.sample} in the BWS · ` : ""}Race score {leader.score.toFixed(0)}/100 among players with {race.minimum}+</p>
  </article>;
}

/** Weekly leaders from the existing Top Performer blend applied to each week's counts; no new score. */
export function HomeSpotlight({ weeks, races = null, headshots = {}, showRankingLink = false }: { weeks: readonly SpotlightWeek[]; races?: BwsRaces | null; headshots?: Readonly<Record<string, string>>; showRankingLink?: boolean }) {
  // During the Boxer World Series its MVP and Cy Young races are featured; Fall Ball weeks move to the list.
  const bws = !!races && !!(races.mvp || races.cyYoung);
  if (!weeks.length && !bws) return null;
  const [latest, ...rest] = weeks;
  const earlier = bws ? weeks : rest;
  const featured = !bws && latest ? [latest.hitting, latest.pitching].filter((card): card is SpotlightCard => !!card) : [];
  return <section aria-label={bws ? "Boxer World Series races" : "Players of the week"} data-testid="home-spotlight">
    <div className={styles.heading}>{bws ? <><p>Boxer World Series · Races in progress · Series ends Oct 31</p><h2>BWS MVP &amp; Cy Young Race</h2></> : <><p>Fall Ball · {latest.label}{latest.date ? ` · ${latest.date}` : ""}</p><h2>Players of the Week</h2></>}</div>
    {bws ? <div className={styles.grid}>
      {races!.mvp && <RaceColumn name="MVP Race" race={races!.mvp} headshots={headshots}/>}
      {races!.cyYoung && <RaceColumn name="Cy Young Race" race={races!.cyYoung} headshots={headshots}/>}
    </div> :
    <div className={styles.grid}>{featured.map(card => <article key={card.key} className={styles.card} data-spotlight={card.discipline}>
      {/* Trading-card frame: photo band with a week ribbon, name plate, then the headline stat. */}
      <div className={styles.photoBand}>
        <span className={styles.ribbon}>{card.weekLabel}</span>
        <p className={styles.title}><Trophy size={14} aria-hidden="true"/>{title(card)}{card.tied && <span>Tied for #1</span>}</p>
        <PlayerAvatar name={card.name} path={headshots[card.code]} size={104} eager className={styles.cardPhoto}/>
      </div>
      <div className={styles.namePlate}><h3>{card.profileId ? <Link prefetch={false} href={`/athletes/${card.profileId}`}>{card.name}</Link> : card.name}</h3><small>{card.detail}</small></div>
      <div className={styles.headline}><strong>{card.headline.value}</strong><span>{card.headline.label}</span></div>
      {!!card.stats.length && <dl className={styles.stats}>{card.stats.map(stat => <div key={stat.label}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}</dl>}
      <p className={styles.basis}>{card.sample ? `${card.sample} this week · ` : ""}#1 Top Performer score for the week</p>
    </article>)}</div>}
    {earlier.length > 0 && <div className={styles.history} aria-label={bws ? "Fall Ball Players of the Week" : "Earlier weeks"}><h3>{bws ? "Fall Ball Players of the Week" : "Earlier Weeks"}</h3><ol>{earlier.map(week => <li key={week.week}>
      <strong>{week.label}</strong>
      {[week.hitting, week.pitching].map((card, index) => <span key={index}>{card ? <><PlayerAvatar name={card.name} path={headshots[card.code]} size={28} className={styles.historyAvatar}/><span className={styles.who}><small>{index === 0 ? "Hitter" : "Pitcher"}</small>{card.profileId ? <Link prefetch={false} href={`/athletes/${card.profileId}`}>{card.name}</Link> : <span className={styles.plainName}>{card.name}</span>}{card.tied && <em>Tied</em>}</span><b>{card.headline.value} {card.headline.label}</b></> : <small>{index === 0 ? "Hitter" : "Pitcher"} · not ranked</small>}</span>)}
    </li>)}</ol></div>}
    <p className={styles.note}>{bws ? "BWS races use the same blend on Boxer World Series counts only (pitching: the sheet's BWS totals; hitting: QPA counts added since the last Fall Ball update), among hitters with 4+ PA and pitchers with 2+ IP. They become awards when the series ends. " : ""}Each week uses the Top Performer blend (hitters: PAC Production+, QPA%, OPS; pitchers: WHIP, K/BB, Runs/9), with at least five complete lines. Pitching uses separate weekly totals; hitting uses added QPA counts between saved updates, which may not line up with exact calendar weeks. {showRankingLink && <Link prefetch={false} href="/top-performers">Fall rankings<ArrowRight size={13}/></Link>}</p>
  </section>;
}
