"use client";

import { useState } from "react";
import type { SavedContact } from "@/lib/full-swing-contacts-server";
import { CONTACT_ANGLE_BANDS, CONTACT_SPEED_BANDS, contactHeatCell, contactHeatmap } from "@/lib/contact-heatmap";
import { isLikelyFoul } from "@/lib/likely-foul";
import styles from "./contact-heatmap.module.css";

export function ContactHeatmap({ contacts, includeLikelyFouls = false, onSelect }: { contacts: readonly SavedContact[]; includeLikelyFouls?: boolean; onSelect?: (contact: SavedContact) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const day = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const model = contactHeatmap(contacts, { includeLikelyFouls });
  const cell = model.cells.find(item => item.id === selected && item.count > 0);
  const matching = cell ? contacts.filter(row => (includeLikelyFouls || !isLikelyFoul(row)) && contactHeatCell(row) === cell.id) : [];
  return <section className={styles.chart} aria-label="Contact quality heatmap">
    <header className={styles.heading}><div><h3>Contact Heatmap</h3><p>Where your contact collects · {model.count} recorded balls</p></div><details><summary aria-label="About Contact Heatmap">i</summary><p>Each cell shows a count and its share of all selected recorded balls. Deeper red means more contact in that cell, not a better result. Columns are exit velocity in mph; rows are launch angle in degrees. Select a filled cell to inspect its swings. This describes tracked contact, not hits or outs.</p></details></header>
    {!model.count ? <p className={styles.empty}>No paired exit speed and launch angle readings in this selection.</p> : <>
      <div className={styles.scroll}><table className={styles.grid}><caption>Launch angle × Exit velocity (mph)</caption><thead><tr><th scope="col">Launch Angle</th>{CONTACT_SPEED_BANDS.map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{CONTACT_ANGLE_BANDS.map((label, angle) => <tr key={label}><th scope="row">{label}</th>{model.cells.filter(item => item.angle === angle).map(item => <td key={item.id}><button type="button" disabled={!item.count} aria-pressed={cell?.id === item.id} onClick={() => setSelected(cell?.id === item.id ? null : item.id)} aria-label={`${CONTACT_SPEED_BANDS[item.speed]} mph, ${label}: ${item.count} ${item.count === 1 ? "ball" : "balls"}, ${item.share.toFixed(1)} percent of selected contact`} style={{ background: item.count ? `hsl(355 65% ${Math.round(18 + item.intensity * 23)}%)` : undefined, color: item.count ? "#fff" : undefined }}><strong>{item.count || "—"}</strong><span>{item.count ? `${item.share.toFixed(1)}%` : "No contact"}</span></button></td>)}</tr>)}</tbody></table></div>
      <div className={styles.legend}><span>Less contact</span><i aria-hidden="true"/><span>More contact</span><span>Each % uses all {model.count} selected balls.</span></div>
      {cell && <div className={styles.selection} aria-live="polite"><div><strong>{CONTACT_SPEED_BANDS[cell.speed]} mph · {CONTACT_ANGLE_BANDS[cell.angle]}</strong><span>{cell.count} {cell.count === 1 ? "ball" : "balls"} · {cell.share.toFixed(1)}% of selected contact</span><button type="button" onClick={() => setSelected(null)}>Clear Selection</button></div><ul>{matching.map(row => <li key={`${row.fileHash}:${row.sourceRow}`}><span>{day(row.playedOn)} · Pitch {row.pitchNumber}</span><strong>{row.exitVelocity.toFixed(1)} mph / {row.launchAngle.toFixed(1)}°</strong>{onSelect && <button type="button" onClick={() => onSelect(row)}>View Swing</button>}</li>)}</ul></div>}
    </>}
  </section>;
}
