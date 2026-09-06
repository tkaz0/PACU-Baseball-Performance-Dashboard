import type { Role } from "@/lib/types";

/** Uses the already-authorized presented role, including a restricted View as session. */
export function workspaceHome({ roles, athleteId }: { roles: Role[]; athleteId: string | null }): string {
  if (roles.some(role => role === "admin" || role === "coach")) return "/roster";
  return athleteId ? `/athletes/${athleteId}` : "/overview";
}

export function workspacePreviewQuery(preview: string | undefined): string {
  return preview === "invalid" || preview === "read-only" ? `?preview=${preview}` : "";
}
