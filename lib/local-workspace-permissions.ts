import type { LocalView } from "@/lib/local-view";

export type ImportRole = "admin" | "coach";

/** The actual staff role is separate from the Admin's optional read-only local view. */
export function localWorkspacePermissions(importRole: ImportRole, view: LocalView) {
  const canManage = importRole === "admin" && view.role === "admin";
  const canImport = canManage || (importRole === "coach" && view.role === "coach" && view.athleteCode === null);
  return { canManage, canImport, canPreview: importRole === "admin", isPreview: importRole === "admin" && view.role !== "admin" };
}
