import type { Role } from "@/lib/types";

/** Uses the already-authorized presented role, including a restricted View as session. */
export function workspaceHome({ roles, athleteId }: { roles: Role[]; athleteId: string | null }): string {
  // Every authorized role now has a scoped Home page.
  void roles; void athleteId;
  return "/overview";
}

export function workspacePreviewQuery(preview: string | undefined): string {
  return preview === "invalid" || preview === "read-only" ? `?preview=${preview}` : "";
}
