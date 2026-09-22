import type { FullSwingSession } from "@/lib/imports/full-swing-session";
import type { PitchResultContext } from "@/lib/imports/classified-pitch-results";

export type ReviewedContact = {
  athleteCode: string; fileHash: string; sourceFile: string; sourceRow: number;
  pitchNumber: number; playedOn: string; category: "game" | "intrasquad" | "practice";
  exitVelocity: number; launchAngle: number; direction: number | null; distance: number | null;
};
export const REVIEWED_CONTACT_FIELDS = ["athleteCode", "category", "direction", "distance", "exitVelocity", "fileHash", "launchAngle", "pitchNumber", "playedOn", "sourceFile", "sourceRow"] as const;

/** Preserve one batted ball per original CSV row; never combine unrelated summary readings. */
export function prepareFullSwingContacts(session: FullSwingSession, context: PitchResultContext): ReviewedContact[] {
  if (!/^[a-f0-9]{64}$/.test(context.fileHash) || !context.fileName || context.fileName.length > 300 ||
    context.date !== session.date || !["game", "intrasquad", "practice"].includes(context.category))
    throw new Error("Review the original Full Swing session and its category.");
  const matches = new Map(context.matches.map(match => [match.identity, match.athleteCode]));
  if (matches.size !== context.matches.length || new Set(matches.values()).size !== matches.size ||
    [...matches.values()].some(code => !/^PAC-\d{4,6}$/.test(code)))
    throw new Error("Each included batter needs one unique roster match.");
  const contacts = session.contacts.flatMap(contact => {
    const code = matches.get(contact.identity);
    if (!code) return [];
    if (!Number.isSafeInteger(contact.sourceRow) || contact.sourceRow < 2 ||
      !Number.isSafeInteger(contact.pitchNumber) || contact.pitchNumber < 1 ||
      !Number.isFinite(contact.exitVelocity) || contact.exitVelocity <= 0 || contact.exitVelocity > 200 ||
      !Number.isFinite(contact.launchAngle) || Math.abs(contact.launchAngle) > 90 ||
      (contact.direction !== null && (!Number.isFinite(contact.direction) || Math.abs(contact.direction)>90)) ||
      (contact.distance !== null && (!Number.isFinite(contact.distance) || contact.distance<0 || contact.distance>1000)) ||
      (contact.direction === null)!==(contact.distance === null))
      throw new Error("Review the paired exit velocity and launch angle in the original CSV.");
    return [{ athleteCode: code, fileHash: context.fileHash, sourceFile: context.fileName,
      sourceRow: contact.sourceRow, pitchNumber: contact.pitchNumber, playedOn: session.date,
      category: context.category, exitVelocity: contact.exitVelocity, launchAngle: contact.launchAngle,
      direction: contact.direction, distance: contact.distance }];
  });
  if (contacts.length > 500 || new Set(contacts.map(contact => contact.sourceRow)).size !== contacts.length)
    throw new Error("Review one session with at most 500 distinct batted-ball rows.");
  return contacts;
}
