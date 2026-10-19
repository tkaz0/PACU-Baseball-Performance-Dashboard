import Link from "next/link";
import { DataFreshness } from "@/components/data-freshness";
import type { MissingWeek } from "@/lib/data-freshness";

/** Staff-only profile banner: played Fall Ball weeks with no in-game Full Swing session saved for the team. */
export async function FullSwingFreshness({ missing }: { missing: Promise<MissingWeek[] | null> }) {
  const weeks = await missing;
  return weeks?.length ? <DataFreshness source="Full Swing" weeks={weeks}>In-game Full Swing results stop before {weeks.length === 1 ? "that week" : "those weeks"}. <Link prefetch={false} href="/imports">Import the export</Link> if the games were tracked.</DataFreshness> : null;
}
