"use client";
import { PitchAssignmentReview, type PitchAssignmentStore } from "@/components/pitch-assignment-review";
import { saveReviewedContacts } from "@/app/(workspace)/imports/actions";
import { prepareFullSwingContacts } from "@/lib/imports/full-swing-contacts";
import type { PitchResultContext } from "@/lib/imports/classified-pitch-results";
import type { SaveImportAction } from "@/components/full-swing-import";
import { useState } from "react";
import { groupPitchRanges, SESSION_METRICS, type FullSwingSession, type PitchGroupingMode } from "@/lib/imports/full-swing-session";

const number = (value: number | null) => value === null ? "—" : value.toFixed(1);
export function FullSwingSessionReview({ session, fileHash, assignmentStore, includedIdentities, resultContext, saveResults }: { session: FullSwingSession; resultContext?: PitchResultContext; saveResults?: SaveImportAction; includedIdentities?: string[]; fileHash?: string; assignmentStore?: PitchAssignmentStore }) {
  const [search, setSearch] = useState("");
  const [velocityWidth, setVelocityWidth] = useState(3), [spinWidth, setSpinWidth] = useState(250);
  const [groupingMode, setGroupingMode] = useState<PitchGroupingMode>("gap");
  const [rpmConfirmed, setRpmConfirmed] = useState(false);
  const [contactsApproved, setContactsApproved] = useState("");
  const [contactsBusy, setContactsBusy] = useState(false);
  const [contactsMessage, setContactsMessage] = useState("");
  const matches = (name: string) => (includedIdentities === undefined || includedIdentities.includes(name)) && name.toLowerCase().includes(search.trim().toLowerCase());
  const ranges = groupPitchRanges(session.pitches, velocityWidth, spinWidth, groupingMode).filter(r => matches(r.identity));
  const players = session.players.filter(p => matches(p.identity));
  const spinUnit = rpmConfirmed ? "RPM" : "export units";
  const contactKey = resultContext ? JSON.stringify([resultContext.fileHash, resultContext.category, resultContext.matches]) : "";
  let contactRows: ReturnType<typeof prepareFullSwingContacts> = [], contactError = "";
  if (resultContext) try { contactRows = prepareFullSwingContacts(session, resultContext); } catch (error) { contactError = error instanceof Error ? error.message : "Review the contact readings."; }
  const matchedBatters = resultContext?.matches.filter(match => session.players.some(player => player.role === "Batter" && player.identity === match.identity)) ?? [];
  async function saveContacts() {
    if (contactsBusy || contactsApproved !== contactKey || !contactRows.length || contactError) return;
    setContactsBusy(true); setContactsMessage("");
    try {
      const result = await saveReviewedContacts(contactRows, true);
      setContactsMessage("error" in result ? result.error : `${result.created} batted-ball ${result.created === 1 ? "reading" : "readings"} saved · ${result.unchanged} already saved. Open a matched player profile to see the map.`);
    } catch { setContactsMessage("The save could not be confirmed. Check the player profiles before retrying the same file."); }
    finally { setContactsBusy(false); }
  }
  return <section className="my-6 space-y-5 rounded-xl border border-[var(--line-subtle)] p-4 sm:p-5" aria-label="Full Swing session review">
    <div><h3 className="m-0 text-lg font-bold">Roster Player Summaries</h3><p className="muted mb-0 text-sm">{session.date} · {session.eventCount} pitches in the source file. Only selected roster players appear below; — means no recorded value.</p></div>
    <label className="block max-w-md">Find a player<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search export names" /></label>
    {!players.length && <p className="muted">No players match your search.</p>}
    {(["Batter", "Pitcher"] as const).map(role => {
      const rows = players.filter(p => p.role === role), metrics = SESSION_METRICS.map((m, i) => ({ ...m, index: i })).filter(m => m.role === role);
      if (!rows.length) return null;
      return <div key={role}><h4 className="mb-2 font-semibold">{role === "Batter" ? "Hitting" : "Pitching"} · {rows.length} {rows.length === 1 ? "player" : "players"}</h4><div className="table-wrap max-h-[32rem] overflow-auto"><table><caption className="sr-only">All {role.toLowerCase()} summaries</caption><thead><tr><th>Export Player</th><th>Pitches {role === "Batter" ? "Faced" : "Thrown"}</th>{metrics.map(m => <th key={m.key}>{m.label}<span className="block text-xs font-normal">{m.unit}</span></th>)}</tr></thead><tbody>{rows.map(p => <tr key={p.identity}><th scope="row" className="whitespace-nowrap">{p.identity}</th><td>{p.eventCount}</td>{metrics.map(m => {
        const raw = p.values[m.index], count = session.samples.find(s => s.identity === p.identity && s.role === role && s.metric === m.label)?.count;
        return <td className="tabular-nums" key={m.key}>{raw ? number(Number(raw)) : "—"}{count !== undefined && <span className="muted block text-[11px]">n={count}</span>}</td>;
      })}</tr>)}</tbody></table></div></div>;
    })}
    {resultContext && <div className="rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-panel)] p-4" aria-label="Batted-ball contact review">
      <h4 className="m-0 font-bold">Hitter Contact Map</h4>
      <p className="muted mb-2 mt-1 text-sm">Save paired ExitSpeed (mph) and Angle (degrees) from the same CSV row. When present, Direction (degrees) and Distance (feet) stay with that row for the spray view. Unmatched hitters and incomplete contact pairs stay out.</p>
      <p className="mb-2 text-sm font-semibold">{contactRows.length} paired batted balls · {matchedBatters.length} matched {matchedBatters.length === 1 ? "hitter" : "hitters"} · {session.date}</p>
      {contactError && <p role="alert" className="notice notice-error">{contactError}</p>}
      {contactRows.length > 0 && <details><summary className="cursor-pointer text-sm font-semibold text-[var(--accent-readable)]">Review paired source readings</summary><div className="table-wrap mt-3 max-h-72"><table><thead><tr><th>CSV Row</th><th>Pitch #</th><th>Matched Batter</th><th>Exit Velocity</th><th>Launch Angle</th><th>Direction</th><th>Distance</th></tr></thead><tbody>{contactRows.map(row => <tr key={row.sourceRow}><td>{row.sourceRow}</td><td>{row.pitchNumber}</td><td>{resultContext.matches.find(match => match.athleteCode === row.athleteCode)?.identity}</td><td>{row.exitVelocity.toFixed(1)} mph</td><td>{row.launchAngle.toFixed(1)}°</td><td>{row.direction===null?"—":`${row.direction.toFixed(1)}°`}</td><td>{row.distance===null?"—":`${row.distance.toFixed(1)} ft`}</td></tr>)}</tbody></table></div></details>}
      {contactRows.length > 0 && !contactError && <><label className="my-3 flex items-start gap-2 text-sm"><input type="checkbox" checked={contactsApproved === contactKey} onChange={event => setContactsApproved(event.target.checked ? contactKey : "")} /><span>I checked the batter matches, source rows, mph, angles, available direction/distance and {resultContext.category} against this CSV. Positive Direction plots toward first base.</span></label><button type="button" className="btn btn-primary" disabled={contactsApproved !== contactKey || contactsBusy} onClick={() => void saveContacts()}>{contactsBusy ? "Saving…" : "Save Contact Map Readings"}</button></>}
      {contactsMessage && <p role="status" className="notice mt-3 mb-0">{contactsMessage}</p>}
    </div>}
    <details className="border-t border-[var(--line-subtle)] pt-4" open><summary className="cursor-pointer font-semibold">Pitch Velocity &amp; Spin Ranges</summary>
      <p className="muted text-sm">Grouped separately for each pitcher. Ranges organize similar readings. Review the suggested pitch types below. Pitch assignments save separately from player measurements.</p>
      <div className="flex flex-wrap gap-4"><label>Group pitches by<select value={groupingMode} onChange={e=>setGroupingMode(e.target.value as PitchGroupingMode)}><option value="gap">Gaps between velocities</option><option value="fixed">Fixed velocity ranges</option></select></label><label>{groupingMode === "gap" ? "Start a new group at" : "Velocity range"}<select value={velocityWidth} onChange={e => setVelocityWidth(Number(e.target.value))}>{[2,3,5,10].map(n => <option key={n} value={n}>{n} mph</option>)}</select></label><label>Spin range<select value={spinWidth} onChange={e => setSpinWidth(Number(e.target.value))}>{[100,250,500].map(n => <option key={n} value={n}>{n} {spinUnit}</option>)}</select></label></div>
      <label className="my-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={rpmConfirmed} onChange={e => setRpmConfirmed(e.target.checked)} />I confirm the export’s SpinRate values are RPM.</label>
      <div className="table-wrap max-h-[32rem] overflow-auto"><table><caption className="sr-only">Pitch groups by velocity and spin</caption><thead><tr><th>Pitcher</th><th>Velocity (mph)</th><th>Spin ({spinUnit})</th><th>Pitches</th><th>Average Velocity</th><th>Average Spin</th></tr></thead><tbody>{ranges.map((range, i) => {
        const total = session.pitches.filter(p => p.identity === range.identity).length;
        return <tr key={i}><th scope="row" className="whitespace-nowrap">{range.identity}</th><td className="whitespace-nowrap">{range.velocityStart === null ? "Not recorded" : groupingMode === "gap" ? `${range.velocityStart.toFixed(1)}–${range.velocityEnd!.toFixed(1)}` : `${range.velocityStart}–<${range.velocityStart + velocityWidth}`}</td><td className="whitespace-nowrap">{range.spinStart === null ? "Not recorded / unreadable" : `${range.spinStart}–<${range.spinStart + spinWidth}`}</td><td className="min-w-28"><span className="tabular-nums">{range.count} <span className="muted text-xs">({Math.round(range.count / total * 100)}%)</span></span><div className="mt-1 h-1.5 rounded bg-[var(--line-subtle)]" aria-hidden="true"><div className="h-full rounded bg-pacu-red" style={{ width: `${range.count / total * 100}%` }} /></div></td><td>{number(range.averageVelocity)} mph</td><td>{number(range.averageSpin)}</td></tr>;
      })}</tbody></table></div>
      <p className="muted mb-0 text-xs">{groupingMode === "gap" ? `A gap of ${velocityWidth} mph or more starts a new group within each pitcher’s spin band. Nearby speeds stay together, so a group can span more than ${velocityWidth} mph. Review every group before assigning a pitch type.` : "Fixed ranges include the lower number and exclude the upper number."} Percentages use all pitches thrown by that pitcher; missing spin stays separate.</p>
    </details>
    <PitchAssignmentReview key={fileHash} session={session} resultContext={resultContext} saveResults={saveResults} includedIdentities={includedIdentities} ranges={ranges} search={search} spinUnit={spinUnit} rpmConfirmed={rpmConfirmed} fileHash={fileHash} store={assignmentStore} />
  </section>;
}
