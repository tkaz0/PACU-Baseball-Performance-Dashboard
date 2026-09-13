"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { CircleCheck } from "lucide-react";
import type { ImportConfirmationData } from "@/lib/import-confirmation";
import { leaderboardTestDate } from "@/lib/leaderboards";
import styles from "./import-confirmation.module.css";
export function ImportConfirmation({ receipt }: { receipt: ImportConfirmationData }) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => { panel.current?.focus({ preventScroll: true }); panel.current?.scrollIntoView({ block: "nearest" }); }, [receipt]);
  return <section ref={panel} tabIndex={-1} className={styles.receipt} aria-label="Import confirmation">
    <div className={styles.title} role="status"><CircleCheck size={22} aria-hidden="true" /><div><h2>{receipt.created ? "Saved to Player Profiles" : "Readings Already Saved"}</h2><p>{receipt.created} new {receipt.created === 1 ? "reading" : "readings"} · {receipt.unchanged} already present</p></div></div>
    <ul className={styles.players}>{receipt.players.map(player => <li key={`${player.code}:${player.date}`}><div><Link prefetch={false} href={player.href}>{player.name} <span aria-hidden="true">↗</span></Link><span className={styles.date}>Tested {leaderboardTestDate(player.date)}</span></div><p><strong>Reviewed measurements:</strong> {player.metrics.join(" · ")}</p></li>)}</ul>
    {receipt.skipped.length > 0 ? <details className={styles.skipped} open><summary>Left Out of This Import</summary><ul>{receipt.skipped.map((item, i) => <li key={i}><strong>{item.label}:</strong> {item.reason}</li>)}</ul><p>Previously saved measurements are unchanged.</p></details> : <p className={styles.note}>All selected readings were accepted. Already-present readings were kept without creating duplicates.</p>}
    <div className={styles.actions}><Link prefetch={false} className="btn btn-secondary" href="/testing/coverage">Check Team Coverage</Link><span>Select a player’s name to open their updated profile.</span></div>
  </section>;
}
