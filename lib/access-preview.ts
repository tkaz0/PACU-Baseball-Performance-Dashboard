import { UUID_PATTERN, type Role } from "@/lib/types";

export const ACCESS_PREVIEW_COOKIE = "pacu-access-preview";
export const ACCESS_PREVIEW_SECONDS = 4 * 60 * 60;
export type AccessPreview = {
  version: 1; actorId: string; role: "coach" | "player";
  athleteId: string | null; expiresAt: number;
};
export type AccessActor = { userId: string; roles: Role[]; athleteId: string | null };
export type AccessPresentation = {
  roles: Role[]; athleteId: string | null; preview: AccessPreview | null;
};

/** An untrusted preference can only restrict an already-authorized administrator. */
export function resolveAccessPreview(actor: AccessActor, raw: string | undefined, now = Date.now()): AccessPresentation | null {
  if (raw === undefined) return { roles: actor.roles, athleteId: actor.athleteId, preview: null };
  if (!actor.roles.includes("admin") || !raw || raw.length > 500) return null;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const p = value as Record<string, unknown>;
  if (Object.keys(p).sort().join(",") !== "actorId,athleteId,expiresAt,role,version" || p.version !== 1 || p.actorId !== actor.userId ||
    (p.role !== "coach" && p.role !== "player") || typeof p.expiresAt !== "number" || !Number.isSafeInteger(p.expiresAt) ||
    p.expiresAt <= now || p.expiresAt > now + ACCESS_PREVIEW_SECONDS * 1000 ||
    (p.role === "coach" ? p.athleteId !== null : typeof p.athleteId !== "string" || !UUID_PATTERN.test(p.athleteId))) return null;
  const preview = p as AccessPreview;
  return { roles: [preview.role], athleteId: preview.athleteId, preview };
}

export function canReadPresentedAthlete(access: Pick<AccessPresentation, "roles" | "athleteId">, athleteId: string): boolean {
  return access.roles.some(role => role === "admin" || role === "coach") ||
    (access.roles.includes("player") && access.athleteId !== null && access.athleteId.toLowerCase() === athleteId.toLowerCase());
}

export function canMutatePresentedAccess(access: AccessPresentation): boolean {
  return access.preview === null && access.roles.includes("admin");
}
