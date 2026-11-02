import { HomeSpotlight } from "@/components/home-spotlight";
import { playersOfTheWeek, bwsRaces } from "@/lib/home-spotlight";
import type { loadGameWeeks } from "@/lib/game-weeks-server";

/** A failed weekly read is distinct from a successful read with no qualifying leaders. */
export async function StreamedHomeSpotlight({ weeks, photos, staff }: {
  weeks: ReturnType<typeof loadGameWeeks>;
  photos: Promise<Map<string, string>>;
  staff: boolean;
}) {
  const [weekly, headshots] = await Promise.all([weeks, photos]);
  if (weekly === null) return <p role="status" className="panel muted text-sm">BWS and weekly leaders are temporarily unavailable. Refresh to try again.</p>;
  return <HomeSpotlight weeks={playersOfTheWeek(weekly.players, weekly.weeks)} races={bwsRaces(weekly.players, weekly.weeks.bws)} headshots={Object.fromEntries(headshots)} showRankingLink={staff}/>;
}
