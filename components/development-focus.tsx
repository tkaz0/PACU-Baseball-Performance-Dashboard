import Link from "next/link";
import { StatInfo } from "@/components/stat-info";
import type { CoachingPlayer } from "@/lib/coaching-tools";
import type { SharedGameStat } from "@/lib/game-server";
import { commandFocus, powerDevelopment, POWER_MIN_BALLS, type PowerContact } from "@/lib/development-focus";
import styles from "./development-focus.module.css";

const one = (v: number | null, suffix = "") => v === null ? "—" : `${v.toFixed(1)}${suffix}`;
const avg = (v: number | null) => v === null ? "—" : v.toFixed(3).replace(/^0\./, ".");
const name = (player: CoachingPlayer) => <Link prefetch={false} href={`/athletes/${player.id}`}>{player.name}</Link>;

export function DevelopmentFocus({ players, stats, contacts, squaredAvailable, weeks = 1, qualified = false }: { players: CoachingPlayer[]; stats: SharedGameStat[]; contacts: PowerContact[]; squaredAvailable: boolean; weeks?: number; qualified?: boolean }) {
  const command = commandFocus(players, stats), power = powerDevelopment(players, stats, contacts);
  // Display filter only: the team BB/9 and highlighting still use every pitcher.
  const minimumOuts = 3 * Math.max(1, weeks), shown = qualified ? command.rows.filter(row => row.outs >= minimumOuts) : command.rows;
  return <div className={styles.sections}>
    <section className={styles.panel} aria-label="Command focus" data-testid="command-focus">
      <header><h2>Command Focus</h2><p>Pitchers sorted by walks per nine, most first. Team BB/9: <strong>{command.teamBb9 === null ? "—" : command.teamBb9.toFixed(2)}</strong>. Highlighted rows walk more than the team rate.</p>
        <nav aria-label="Qualified pitchers" className="leaderboard-navigation mb-3" data-testid="command-qualified">{([false, true] as const).map(value => <Link key={String(value)} prefetch={false} href={value ? "/development-focus?qualified=1" : "/development-focus"} aria-current={qualified === value ? "page" : undefined}>{value ? `Qualified (${minimumOuts / 3} IP+)` : "Everyone"}</Link>)}</nav></header>
      {shown.length ? <div className="table-wrap"><table><thead><tr><th>Pitcher</th><th className="text-right">IP</th><th className="text-right">BB</th><th className="text-right">BB/9<StatInfo metric="pitching_bb9" label="BB/9"/></th><th className="text-right">Strike %</th><th className="text-right">K/BB</th><th className="text-right">FB Strike %</th><th className="text-right">BRK Strike %</th><th className="text-right">CH Strike %</th><th className="text-right">FPS<StatInfo metric="fps" label="FPS"/></th><th className="text-right">HBP</th></tr></thead>
        <tbody>{shown.map(row => <tr key={row.player.id} data-command={row.player.code} className={row.aboveTeam ? styles.flag : undefined}>
          <th scope="row">{name(row.player)}</th><td className="text-right tabular-nums">{row.innings}</td><td className="text-right tabular-nums">{row.walks}</td>
          <td className="text-right tabular-nums"><strong>{row.bb9 === null ? "—" : row.bb9.toFixed(2)}</strong></td><td className="text-right tabular-nums">{one(row.strikePct, "%")}</td>
          <td className="text-right tabular-nums">{row.kbb === null ? "—" : row.kbb.toFixed(2)}</td>
          {row.families.map(f => <td key={f.label} className="text-right tabular-nums">{f.strikePct === null ? "—" : <>{one(f.strikePct, "%")}<small className={styles.sub}>{f.pitches} pitches</small></>}</td>)}
          <td className="text-right tabular-nums">{row.fps ?? "—"}</td><td className="text-right tabular-nums">{row.hbp ?? "—"}</td></tr>)}</tbody></table></div> : <p className="muted">{qualified && command.rows.length ? `No pitchers have ${minimumOuts / 3}+ IP yet.` : "No complete pitching lines yet."}</p>}
      <p className={styles.note}>Cumulative Fall pitching sheet totals. Strike % is strikes ÷ pitches; family Strike % uses that family&apos;s pitches. FPS is the sheet&apos;s first-pitch strike count, shown as a count because first-pitch opportunities are not recorded. K/BB is blank with zero walks. Small innings totals swing quickly.{qualified && command.rows.length > shown.length ? ` ${command.rows.length - shown.length} ${command.rows.length - shown.length === 1 ? "pitcher" : "pitchers"} below ${minimumOuts / 3} IP ${command.rows.length - shown.length === 1 ? "is" : "are"} hidden; the team rate still includes them.` : ""}</p>
    </section>
    <section className={styles.panel} aria-label="Power development" data-testid="power-development">
      <header><h2>Power Development</h2><p>Game power (ISO, SLG) beside in-game Full Swing contact. Profiles compare each hitter with team medians among hitters with {POWER_MIN_BALLS}+ balls in play: hard hit {one(power.medians.hard, "%")}, in the air {one(power.medians.air, "%")}{power.medians.squared !== null ? `, Squared Up ${one(power.medians.squared, "%")}` : ""}.</p></header>
      {power.rows.length ? <div className="table-wrap"><table><thead><tr><th>Hitter</th><th className="text-right">ISO<StatInfo metric="batting_est_iso" label="ISO"/></th><th className="text-right">SLG</th><th className="text-right">Balls</th><th className="text-right">Max EV</th><th className="text-right">Avg EV</th><th className="text-right">Hard Hit</th><th className="text-right">In the Air</th><th className="text-right">Squared Up<StatInfo metric="squared_up" label="Squared Up"/></th><th>Contact Profile</th></tr></thead>
        <tbody>{power.rows.map(row => <tr key={row.player.id} data-power={row.player.code}>
          <th scope="row">{name(row.player)}</th><td className="text-right tabular-nums"><strong>{avg(row.iso)}</strong>{row.ab !== null && <small className={styles.sub}>{row.ab} AB</small>}</td><td className="text-right tabular-nums">{avg(row.slg)}</td>
          <td className="text-right tabular-nums">{row.balls}</td><td className="text-right tabular-nums">{one(row.maxEv, " mph")}</td><td className="text-right tabular-nums">{one(row.avgEv, " mph")}</td>
          <td className="text-right tabular-nums">{one(row.hardHitPct, "%")}</td><td className="text-right tabular-nums">{one(row.airPct, "%")}</td><td className="text-right tabular-nums">{one(row.squaredUp, "%")}</td>
          <td>{row.profile ?? <span className="muted text-xs">{row.balls ? `Fewer than ${POWER_MIN_BALLS} balls` : "No in-game contact"}</span>}</td></tr>)}</tbody></table></div> : <p className="muted">No hitting results yet.</p>}
      <p className={styles.note}>ISO and SLG count doubles/triples as doubles (the sheet combines them). Contact columns use saved in-game and intrasquad Full Swing batted balls with likely fouls left out: hard hit is 90+ mph, in the air is a line drive or fly ball (10–50°).{squaredAvailable ? "" : " Squared Up is temporarily unavailable."} Profiles describe recorded contact relative to teammates; they are not grades or swing prescriptions, and Full Swing does not record hit outcomes.</p>
    </section>
  </div>;
}
