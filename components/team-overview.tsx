import Link from "next/link";
import { ArrowRight, UsersRound, Activity, CalendarDays, Trophy, UploadCloud } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import type { RosterTableAthlete } from "@/components/roster-table";
import { athleteName, display } from "@/lib/types";

export function TeamOverview({ athletes, testedDate, canImport }: {
  athletes: RosterTableAthlete[];
  testedDate: string;
  canImport: boolean;
}) {
  return <>
    <PageHeading section="Pacific Baseball" title="Team Overview" description="Player profiles and team results · Fall 2026.">{canImport && <Link href="/imports" className="btn btn-primary"><UploadCloud size={16} />Import Data</Link>}</PageHeading>
    <section className="mb-8 grid gap-4 md:grid-cols-3" aria-label="Workspace summary">{[
      {label:"Player Profiles",value:String(athletes.length),detail:"2026–27 roster",icon:UsersRound},
      {label:"Last Tested",value:testedDate,detail:"Latest team measurement",icon:Activity},
      {label:"Current Season",value:"Fall 2026",detail:"September–December",icon:CalendarDays},
    ].map(({label,value,detail,icon:Icon}) => <div className="panel p-5 sm:p-6" key={label}><div className="mb-4 flex items-center justify-between"><p className="muted mb-0 text-sm font-medium">{label}</p><Icon size={18} className="text-[var(--accent-readable)]" aria-hidden="true" /></div><p className="mb-2 text-2xl font-bold tracking-tight">{value}</p><p className="muted mb-0 text-xs">{detail}</p></div>)}</section>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="mb-1 text-lg font-bold">Player Profiles</h2><p className="muted mb-0 text-sm">Physicality, hitting, and throwing in one place.</p></div><Link href="/roster" className="flex items-center gap-2 text-sm font-semibold text-[var(--accent-readable)]">View Roster <ArrowRight size={16} /></Link></div>
    <div className="panel overflow-hidden">
      {athletes.length ? <ul className="m-0 list-none divide-y divide-[var(--line-subtle)] p-0" aria-label="Player profiles">{athletes.slice(0, 5).map(athlete => {
        const season = athlete.athlete_seasons.find(item => item.season === "2026-27");
        return <li key={athlete.id}><Link href={`/athletes/${athlete.id}`} prefetch={false} className="flex items-center gap-3 px-4 py-4 text-inherit no-underline hover:bg-[var(--surface-raised)] sm:gap-4 sm:px-6">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-raised)] text-xs font-bold text-[var(--text-secondary)]" aria-hidden="true">{(athlete.preferred_name || athlete.first_name)[0]}{athlete.last_name[0]}</span>
          <span className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold">{athleteName(athlete)}</span><span className="muted mt-1 block font-mono text-[11px]">{athlete.athlete_code}</span></span>
          <span className="shrink-0 text-right"><span className="block text-sm font-bold">{season?.jersey_number !== null && season?.jersey_number !== undefined ? `#${season.jersey_number}` : "—"}</span><span className="muted mt-1 block text-[11px]">{display(season?.primary_position)}</span></span>
          <ArrowRight size={16} className="ml-1 shrink-0 text-[var(--text-secondary)]" aria-hidden="true" />
        </Link></li>;
      })}</ul> : <p className="muted m-0 p-6 text-sm">Player profiles will appear when the roster is added.</p>}
    </div>
    <section className="mt-6 grid gap-4 sm:grid-cols-2" aria-label="Explore team performance">
      {[
        {href:"/leaderboards",title:"Leaderboards",description:"Team rankings by measurement.",icon:Trophy},
        {href:"/game-stats",title:"Game Stats",description:"Fall hitting and pitching results.",icon:CalendarDays},
      ].map(({href,title,description,icon:Icon}) => <Link key={href} href={href} className="panel group flex min-w-0 items-center gap-4 p-5 text-inherit no-underline transition-colors hover:border-[var(--accent-readable)]"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-raised)] text-[var(--accent-readable)]"><Icon size={21} aria-hidden="true" /></span><span className="min-w-0 flex-1"><span className="block font-bold">{title}</span><span className="muted mt-1 block text-sm">{description}</span></span><ArrowRight size={18} className="shrink-0 text-[var(--text-secondary)] transition-transform group-hover:translate-x-1" aria-hidden="true" /></Link>)}
    </section>
  </>;
}
