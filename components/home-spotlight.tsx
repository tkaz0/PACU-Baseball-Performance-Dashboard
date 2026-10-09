import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PlayerAvatar } from "@/components/player-avatar";
import type { SpotlightCard } from "@/lib/home-spotlight";
import styles from "./home-spotlight.module.css";

/** Fall-to-date leaders from existing staff rankings; no new calculation or score. */
export function HomeSpotlight({ cards, headshots = {} }: { cards: readonly SpotlightCard[]; headshots?: Readonly<Record<string, string>> }) {
  if (!cards.length) return null;
  return <section aria-label="Fall spotlight" data-testid="home-spotlight">
    <div className={styles.heading}><p>Fall to date</p><h2>Spotlight</h2></div>
    <div className={styles.grid}>{cards.map(card => <article key={card.key} className={styles.card} data-spotlight={card.key}>
      <p className={styles.title}>{card.title}{card.tied && <span>Tied for #1</span>}</p>
      <div className={styles.player}><PlayerAvatar name={card.name} path={headshots[card.code]} size={56}/>
        <h3>{card.profileId ? <Link prefetch={false} href={`/athletes/${card.profileId}`}>{card.name}</Link> : card.name}</h3></div>
      <div className={styles.headline}><strong>{card.headline.value}</strong><span>{card.headline.label}</span></div>
      {!!card.stats.length && <dl className={styles.stats}>{card.stats.map(stat => <div key={stat.label}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}</dl>}
      <p className={styles.basis}>{[card.sample, card.basis].filter(Boolean).join(" · ")}{card.early && <em>Early sample</em>}</p>
      <Link prefetch={false} href={card.href} className={styles.link}>See ranking<ArrowRight size={14}/></Link>
    </article>)}</div>
  </section>;
}
