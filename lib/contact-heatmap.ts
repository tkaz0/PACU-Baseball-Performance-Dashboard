import type { ContactReading } from "@/lib/contact-quality";
import { isLikelyFoul } from "@/lib/likely-foul";

export const CONTACT_SPEED_BANDS = ["Below 70", "70–<80", "80–<90", "90–<100", "100+"] as const;
export const CONTACT_ANGLE_BANDS = ["50°+", ">32–<50°", "8–32°", "0–<8°", "Below 0°"] as const;
export type ContactHeatCell = { id: string; speed: number; angle: number; count: number; share: number; intensity: number };
export function contactHeatCell(row: ContactReading): string | null {
  if (!Number.isFinite(row.exitVelocity) || row.exitVelocity <= 0 || row.exitVelocity > 200 || !Number.isFinite(row.launchAngle) || Math.abs(row.launchAngle) > 90) return null;
  const speed = row.exitVelocity < 70 ? 0 : row.exitVelocity < 80 ? 1 : row.exitVelocity < 90 ? 2 : row.exitVelocity < 100 ? 3 : 4;
  const angle = row.launchAngle >= 50 ? 0 : row.launchAngle > 32 ? 1 : row.launchAngle >= 8 ? 2 : row.launchAngle >= 0 ? 3 : 4;
  return `${angle}:${speed}`;
}

/** Complete paired contact only; fixed bands preserve the team's 90 mph / 8–32° boundaries.
 * Shares use the entire selected contact population, not row or column totals.
 */
export function contactHeatmap(rows: readonly ContactReading[], { includeLikelyFouls = false }: { includeLikelyFouls?: boolean } = {}) {
  const counts = new Map<string, number>();
  let count = 0;
  for (const row of rows) {
    if (!includeLikelyFouls && isLikelyFoul(row)) continue;
    const id = contactHeatCell(row);
    if (id === null) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
    count++;
  }
  const peak = Math.max(0, ...counts.values());
  const cells: ContactHeatCell[] = CONTACT_ANGLE_BANDS.flatMap((_, angle) => CONTACT_SPEED_BANDS.map((_, speed) => {
    const id = `${angle}:${speed}`, n = counts.get(id) ?? 0;
    return { id, speed, angle, count: n, share: count ? 100 * n / count : 0, intensity: peak ? n / peak : 0 };
  }));
  return { count, cells };
}
