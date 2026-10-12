import { PageHeading } from "@/components/page-heading";
import { PitchGradesMethod, PitchGradesTable } from "@/components/pitch-grades";
import { loadPitchGrades } from "@/lib/pitch-grades-server";
import { MIN_BALLS_IN_PLAY } from "@/lib/pitch-grades";

export const metadata = { title: "Pitch Grades" };
export default async function PitchGradesPage() {
  const { rows, team, contactUnavailable } = await loadPitchGrades();
  const graded = rows.filter(row => row.grade !== null).length;
  return <><PageHeading section="Coaching" title="Pitch Grades" description="Fall 2026 · Pitch+ (Team): strike rate, contact quality and velocity/spin, with 100 as the Pacific average."/>
    {contactUnavailable > 0 && <p role="status" className="notice mb-4 text-sm">Contact against could not load for {contactUnavailable} {contactUnavailable === 1 ? "pitcher" : "pitchers"}; their Contact+ is left blank.</p>}
    <section className="panel p-4 sm:p-5" aria-label="Pitch grades" data-testid="pitch-grades">
      <p className="muted mt-0 text-sm">{graded} of {rows.length} pitches have a full grade. Team contact against: {team.ev === null ? "—" : `${team.ev.toFixed(1)} mph`} average EV, {team.hard === null ? "—" : `${(100 * team.hard).toFixed(1)}%`} hard hit{team.squared === null ? "" : `, ${(100 * team.squared).toFixed(1)}% Squared Up`}. Contact+ uses each pitch&apos;s own balls in play at {MIN_BALLS_IN_PLAY}+, otherwise the pitcher&apos;s balls in play across all pitches.</p>
      <PitchGradesTable rows={rows}/><PitchGradesMethod/>
    </section></>;
}
