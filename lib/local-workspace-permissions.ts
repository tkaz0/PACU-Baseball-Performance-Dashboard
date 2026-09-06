import type { LocalView } from "@/lib/local-view";

export type ImportRole = "admin" | "coach";

/** Trusted staff access bounds the display preference: Coach views may import, Player views are read-only. */
export function localWorkspacePermissions(importRole: ImportRole, view: LocalView) {
  const canManage = importRole === "admin" && view.role === "admin";
  const canImport = canManage || ((importRole === "coach" || importRole === "admin") && view.role === "coach" && view.athleteCode === null);
  return { canManage, canImport, canPreview: importRole === "admin", isPreview: importRole === "admin" && view.role !== "admin" };
}
