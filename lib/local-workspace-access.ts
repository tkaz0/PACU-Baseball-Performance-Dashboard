import type { ImportRole } from "@/lib/local-workspace-permissions";
export type LocalWorkspaceAccessCheck = { allowed: true } | { allowed: false; destination: "/login" | "/access-denied" | null };

/** Verify before mounting device data; failure or a changed account never grants access. */
export async function checkLocalWorkspaceAccess(userId: string, importRole: ImportRole, request: typeof fetch = fetch): Promise<LocalWorkspaceAccessCheck> {
  try {
    const response = await request("/api/local-workspace/access", {
      cache: "no-store", credentials: "same-origin", redirect: "error", signal: AbortSignal.timeout(10000),
    });
    if (response.status === 401) return { allowed: false, destination: "/login" };
    if (response.status === 403) return { allowed: false, destination: "/access-denied" };
    if (!response.ok) return { allowed: false, destination: null };
    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || !("allowed" in data) || data.allowed !== true || !("userId" in data) || data.userId !== userId ||
      !("importRole" in data) || data.importRole !== importRole) {
      return { allowed: false, destination: "/access-denied" };
    }
    return { allowed: true };
  } catch { return { allowed: false, destination: null }; }
}
