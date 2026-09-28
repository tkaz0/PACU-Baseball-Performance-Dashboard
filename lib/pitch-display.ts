import { PITCH_TYPES, pitchTypeLabel } from "@/lib/imports/pitch-assignments";

/** Presentation only: source keys and the original staff labels remain immutable. */
export function pitchSourceLabel(source: string): string {
  const match = /^(Full Swing · (?:Game|Intrasquad|Practice)) · (.+)$/i.exec(source);
  if (!match) return source;
  const pitch = PITCH_TYPES.find(type => type.toLowerCase() === match[2].toLowerCase());
  return pitch ? `${match[1]} · ${pitchTypeLabel(pitch)}` : source;
}
