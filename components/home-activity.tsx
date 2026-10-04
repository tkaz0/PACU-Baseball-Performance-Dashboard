import { CoachThisWeek } from "@/components/dashboard-home";
import { DashboardVisit } from "@/components/dashboard-visit";
import type { loadHomeActivity } from "@/lib/home-server";
import type { DashboardVisitWindow } from "@/lib/personal-dashboard-server";
type ActivityPromise=ReturnType<typeof loadHomeActivity>;
export function HomeActivityPlaceholder({coaching=false}:{coaching?:boolean}) {
  return <div role="status" aria-live="polite" className={`rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-panel)] p-5 ${coaching?"min-h-40":"min-h-24"}`}><p className="muted m-0 text-sm">{coaching?"Loading this week’s coaching updates…":"Loading your recent updates…"}</p></div>;
}
export async function HomeCoachingPulse({activity,reviewCount}:{activity:ActivityPromise;reviewCount:number}) {
  const result=await activity;
  if(!result.ok)return <p role="status" className="muted text-sm">This week’s coaching updates are temporarily unavailable. Refresh to try again.</p>;
  return result.coachDigest?<CoachThisWeek digest={result.coachDigest} reviewCount={reviewCount}/>:null;
}
export async function HomeVisitActivity({activity,visit,staff,athleteId}:{activity:ActivityPromise;visit:DashboardVisitWindow;staff:boolean;athleteId:string|null}) {
  const result=await activity;
  if(!result.ok)return <p role="status" className="muted text-sm">Recent updates are temporarily unavailable. Refresh to try again.</p>;
  return result.visitDigest?<DashboardVisit visit={visit} digest={result.visitDigest} staff={staff} athleteId={athleteId}/>:null;
}
