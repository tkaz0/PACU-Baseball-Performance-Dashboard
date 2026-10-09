import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";
import { PlayerAvatar } from "@/components/player-avatar";
import type { SpotlightCard, SpotlightWeek } from "@/lib/home-spotlight";
import styles from "./home-spotlight.module.css";

const title = (card: SpotlightCard) => card.discipline === "hitting" ? "Hitter of the Week" : "Pitcher of the Week";

/** Weekly leaders from the existing Top Performer blend applied to each week's counts; no new score. */
export function HomeSpotlight({ weeks, headshots = {} }: { weeks: readonly SpotlightWeek[]; headshots?: Readonly<Record<string, string>> }) {
  if (!weeks.length) return null;
  const [latest, ...earlier] = weeks;
  const featured = [latest.hitting, latest.pitching].filter((card): card is SpotlightCard => !!card);
  return <section aria-label="Players of the week" data-testid="home-spotlight">
    <div className={styles.heading}><p>Fall Ball · {latest.label}</p><h2>Players of the Week</h2></div>
    <div className={styles.grid}>{featured.map(card => <article key={card.key} className={styles.card} data-spotlight={card.discipline}>
      <p className={styles.title}><Trophy size={14} aria-hidden="true"/>{title(card)}{card.tied && <span>Tied for #1</span>}</p>
      <div className={styles.player}><PlayerAvatar name={card.name} path={headshots[card.code]} size={64} eager/>
        <div><h3><Link prefetch={false} href={`/athletes/${card.profileId}`}>{card.name}</Link></h3><small>{card.weekLabel} · {card.detail}</small></div></div>
      <div className={styles.headline}><strong>{card.headline.value}</strong><span>{card.headline.label}</span></div>
      {!!card.stats.length && <dl className={styles.stats}>{card.stats.map(stat => <div key={stat.label}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}</dl>}
      <p className={styles.basis}>{card.sample ? `${card.sample} this week · ` : ""}#1 Top Performer score for the week{card.early && <em>Early sample</em>}</p>
    </article>)}</div>
    {earlier.length > 0 && <div className={styles.history} aria-label="Earlier weeks"><h3>Earlier Weeks</h3><ol>{earlier.map(week => <li key={week.week}>
      <strong>{week.label}</strong>
      {[week.hitting, week.pitching].map((card, index) => <span key={index}>{card ? <><PlayerAvatar name={card.name} path={headshots[card.code]} size={28}/><span><small>{index === 0 ? "Hitter" : "Pitcher"}</small><Link prefetch={false} href={`/athletes/${card.profileId}`}>{card.name}</Link>{card.tied && <em>Tied</em>}</span><b>{card.headline.value} {card.headline.label}</b></> : <small>{index === 0 ? "Hitter" : "Pitcher"} · not ranked</small>}</span>)}
    </li>)}</ol></div>}
    <p className={styles.note}>Each week uses the Top Performer blend on that week alone (hitters: PAC Production+, QPA%, OBP, ISO; pitchers: WHIP, K/BB, Runs/9), with at least five complete lines. Pitching weeks are the sheet&apos;s weekly blocks; hitting weeks are the change between saved QPA sheet versions. <Link prefetch={false} href="/top-performers">Fall rankings<ArrowRight size={13}/></Link></p>
  </section>;
}
