import type { SavedContact } from "@/lib/full-swing-contacts-server";
import { PITCH_TYPES, type PitchType } from "@/lib/imports/pitch-assignments";
import { contactQuality } from "@/lib/contact-quality";
import { squaredUpSummary } from "@/lib/contact-trends";

export type PitchContact = Pick<SavedContact, "pitchType" | "category" | "exitVelocity" | "launchAngle" | "squaredUp" | "potentialExitVelocity">;

/** The caller supplies the map's exact session/contact selection. Never guess from speed/spin. */
export function contactPitchSplits(contacts: readonly PitchContact[]) {
  const groups = new Map<string, { pitchType: PitchType | null; category: SavedContact["category"]; rows: PitchContact[] }>();
  for (const contact of contacts) {
    const pitchType = contact.pitchType && contact.pitchType !== "Fastball" && PITCH_TYPES.includes(contact.pitchType) ? contact.pitchType : null;
    const key = `${contact.category}:${pitchType ?? "unknown"}`;
    const group = groups.get(key) ?? { pitchType, category: contact.category, rows: [] };
    group.rows.push(contact); groups.set(key, group);
  }
  return [...groups.values()].sort((a,b) => a.category.localeCompare(b.category) ||
    (a.pitchType === null ? 99 : PITCH_TYPES.indexOf(a.pitchType)) - (b.pitchType === null ? 99 : PITCH_TYPES.indexOf(b.pitchType)))
    .map(group => ({ pitchType: group.pitchType, category: group.category, count: group.rows.length,
      avgEv: group.rows.reduce((sum,row)=>sum+row.exitVelocity,0)/group.rows.length,
      maxEv: Math.max(...group.rows.map(row=>row.exitVelocity)),
      avgLaunch: group.rows.reduce((sum,row)=>sum+row.launchAngle,0)/group.rows.length,
      quality: contactQuality(group.rows, { includeLikelyFouls: true }), squared: squaredUpSummary(group.rows) }));
}
