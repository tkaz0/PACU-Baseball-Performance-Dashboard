import "server-only";
import type { requireAccess } from "@/lib/auth";
import { canImportPresentedAccess } from "@/lib/access-preview";
import type { ConnectionResult, ConnectionSnapshot } from "@/lib/key-connections";

type Access = Awaited<ReturnType<typeof requireAccess>>;
/** Staff-only weekly r/n history for the tracked pairs. A missing table or failed read returns null. */
export async function loadConnectionSnapshots(access: Access): Promise<ConnectionSnapshot[] | null> {
  if (!canImportPresentedAccess(access)) return null;
  const { data, error } = await access.supabase.from("analytics_connection_snapshots").select("week_start,pair_key,r,n").gte("week_start", "2026-08-31").order("week_start").limit(2000);
  if (error || !Array.isArray(data)) return null;
  return data.flatMap(row => typeof row.week_start === "string" && typeof row.pair_key === "string" && Number.isSafeInteger(row.n) && (row.r === null || Number.isFinite(Number(row.r)))
    ? [{ weekStart: row.week_start, pair: row.pair_key, r: row.r === null ? null : Number(row.r), n: row.n }] : []);
}

/** Records this Pacific week's aggregate r and n per pair (no player identities). Failures are ignored. */
export async function saveConnectionSnapshots(access: Access, weekStart: string, results: readonly ConnectionResult[], saved: readonly ConnectionSnapshot[] | null) {
  if (!canImportPresentedAccess(access) || saved === null) return;
  const rows = results.filter(result => result.xKey && result.yKey).map(result => ({ pair: result.pair.key, r: result.r === null ? null : Math.round(result.r * 1000) / 1000, n: result.n }));
  const unchanged = rows.every(row => saved.some(s => s.weekStart === weekStart && s.pair === row.pair && s.n === row.n && (s.r === null ? row.r === null : row.r !== null && Math.abs(s.r - row.r) < 0.0005)));
  if (!rows.length || unchanged) return;
  await access.supabase.rpc("staff_save_connection_snapshots", { p_week_start: weekStart, p_rows: rows });
}
