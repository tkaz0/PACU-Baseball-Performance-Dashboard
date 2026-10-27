import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";
import { PlayerAvatar } from "@/components/player-avatar";
import type { BwsAwards, SpotlightCard, SpotlightWeek } from "@/lib/home-spotlight";
import styles from "./home-spotlight.module.css";

const title = (card: SpotlightCard) => card.discipline === "hitting" ? "Hitter of the Week" : "Pitcher of the Week";

/** Weekly leaders from the existing Top Performer blend applied to each week's counts; no new score. */
export function HomeSpotlight({ weeks, awards = null, headshots = {}, showRankingLink = false }: { weeks: readonly SpotlightWeek[]; awards?: BwsAwards | null; headshots?: Readonly<Record<string, string>>; showRankingLink?: boolean }) {
  if (!weeks.length && !awards) return null;
  // During and after the Boxer World Series, its MVP and Cy Young are featured; Fall Ball weeks move to the list.
  const bwsCards = awards ? [awards.mvp, awards.cyYoung].filter((card): card is SpotlightCard => !!card) : [];
  const [latest, ...rest] = weeks;
  const earlier = bwsCards.length ? weeks : rest;
  const featured = bwsCards.length ? bwsCards : latest ? [latest.hitting, latest.pitching].filter((card): card is SpotlightCard => !!card) : [];
  const bws = bwsCards.length > 0;
  const cardTitle = (card: SpotlightCard) => bws ? (card.discipline === "hitting" ? "BWS MVP" : "BWS Cy Young") : title(card);
  return <section aria-label={bws ? "Boxer World Series awards" : "Players of the week"} data-testid="home-spotlight">
    <div className={styles.heading}>{bws ? <><p>Boxer World Series · Leaders so far</p><h2>BWS MVP &amp; Cy Young</h2></> : <><p>Fall Ball · {latest.label}{latest.date ? ` · ${latest.date}` : ""}</p><h2>Players of the Week</h2></>}</div>
    <div className={styles.grid}>{featured.map(card => <article key={card.key} className={styles.card} data-spotlight={card.discipline} data-bws={bws || undefined}>
      {/* Trading-card frame: photo band with a week ribbon, name plate, then the headline stat. */}
      <div className={styles.photoBand}>
        <span className={styles.ribbon}>{bws ? "BWS" : card.weekLabel}</span>
        <p className={styles.title}><Trophy size={14} aria-hidden="true"/>{cardTitle(card)}{card.tied && <span>Tied for #1</span>}</p>
        <PlayerAvatar name={card.name} path={headshots[card.code]} size={104} eager className={styles.cardPhoto}/>
      </div>
      <div className={styles.namePlate}><h3>{card.profileId ? <Link prefetch={false} href={`/athletes/${card.profileId}`}>{card.name}</Link> : card.name}</h3><small>{card.detail}</small></div>
      <div className={styles.headline}><strong>{card.headline.value}</strong><span>{card.headline.label}</span></div>
      {!!card.stats.length && <dl className={styles.stats}>{card.stats.map(stat => <div key={stat.label}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}</dl>}
      <p className={styles.basis}>{card.sample ? `${card.sample} ${bws ? "in the BWS" : "this week"} · ` : ""}#1 Top Performer score for the {bws ? "series so far" : "week"}</p>
    </article>)}</div>
    {earlier.length > 0 && <div className={styles.history} aria-label={bws ? "Fall Ball Players of the Week" : "Earlier weeks"}><h3>{bws ? "Fall Ball Players of the Week" : "Earlier Weeks"}</h3><ol>{earlier.map(week => <li key={week.week}>
      <strong>{week.label}</strong>
      {[week.hitting, week.pitching].map((card, index) => <span key={index}>{card ? <><PlayerAvatar name={card.name} path={headshots[card.code]} size={28} className={styles.historyAvatar}/><span className={styles.who}><small>{index === 0 ? "Hitter" : "Pitcher"}</small>{card.profileId ? <Link prefetch={false} href={`/athletes/${card.profileId}`}>{card.name}</Link> : <span className={styles.plainName}>{card.name}</span>}{card.tied && <em>Tied</em>}</span><b>{card.headline.value} {card.headline.label}</b></> : <small>{index === 0 ? "Hitter" : "Pitcher"} · not ranked</small>}</span>)}
    </li>)}</ol></div>}
    <p className={styles.note}>{bws ? "BWS awards use the same blend on Boxer World Series counts only (pitching: the sheet's BWS totals; hitting: QPA counts added since the last Fall Ball update). " : ""}Each week uses the Top Performer blend (hitters: PAC Production+, QPA%, OPS; pitchers: WHIP, K/BB, Runs/9), with at least five complete lines. Pitching uses separate weekly totals; hitting uses added QPA counts between saved updates, which may not line up with exact calendar weeks. {showRankingLink && <Link prefetch={false} href="/top-performers">Fall rankings<ArrowRight size={13}/></Link>}</p>
  </section>;
}
