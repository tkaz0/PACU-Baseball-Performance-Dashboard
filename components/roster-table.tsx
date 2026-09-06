import Link from "next/link";
import { ArrowUpRight, UsersRound } from "lucide-react";
import { athleteName, display, type AthleteSeason, type RosterAthlete } from "@/lib/types";
export type RosterTableAthlete = Pick<RosterAthlete, "id" | "athlete_code" | "first_name" | "preferred_name" | "last_name"> & { athlete_seasons: Pick<AthleteSeason, "season" | "jersey_number" | "primary_position" | "academic_class">[] };
export function RosterTable({ athletes, season, profileBasePath = "/athletes" }: { athletes: RosterTableAthlete[]; season?: string; profileBasePath?: string }) {
  if (!athletes.length) return <div className="panel p-12 text-center"><UsersRound className="mx-auto mb-4 text-gray-400" size={30} /><h2 className="text-lg font-semibold">No athletes to show</h2><p className="muted mb-0 text-sm">Try a different season or ask an administrator to import the roster.</p></div>;
  return <div className="panel table-wrap"><table><caption className="sr-only">Athlete roster{season ? ` for ${season}` : ""}</caption><thead><tr><th>Athlete</th><th>Athlete ID</th><th>Jersey</th><th>Position</th><th>Class</th><th><span className="sr-only">Profile</span></th></tr></thead><tbody>{athletes.map(a => {
    const s = season ? a.athlete_seasons.find(s => s.season === season) : [...a.athlete_seasons].sort((a,b) => b.season.localeCompare(a.season))[0];
    return <tr key={a.id}><td><Link className="flex items-center gap-3 text-inherit no-underline" href={`${profileBasePath}/${a.id}`}><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">{(a.preferred_name || a.first_name)[0]}{a.last_name[0]}</span><span className="whitespace-nowrap font-semibold">{athleteName(a)}</span></Link></td><td className="font-mono text-xs text-gray-500">{a.athlete_code}</td><td className="font-semibold">{display(s?.jersey_number)}</td><td>{display(s?.primary_position)}</td><td className="capitalize">{display(s?.academic_class)}</td><td><Link href={`${profileBasePath}/${a.id}`} aria-label={`View ${athleteName(a)} profile`} className="text-gray-400"><ArrowUpRight size={18} /></Link></td></tr>;
  })}</tbody></table></div>;
}
