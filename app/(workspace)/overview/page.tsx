import { requireAccess } from "@/lib/auth";
import { canImportPresentedAccess } from "@/lib/access-preview";
import { AccessPreviewNotice } from "@/components/access-preview-notice";
import { DashboardHome } from "@/components/dashboard-home";
import { loadHomeSummary } from "@/lib/home-server";
import { loadHomeLeaderboards } from "@/lib/home-leaderboards-server";
import { loadDueCoachFocus } from "@/lib/coach-focus-server";
import { pacificTestingDate } from "@/lib/testing-checklist";

export default async function Overview({searchParams}:{searchParams:Promise<{preview?:string}>}) {
  const access=await requireAccess();
  const staff=canImportPresentedAccess(access);
  const [params,summary,leaderboards,dueFocus]=await Promise.all([searchParams,loadHomeSummary(access),loadHomeLeaderboards(access),staff?loadDueCoachFocus(access,pacificTestingDate()):Promise.resolve([])]);
  return <><AccessPreviewNotice status={params.preview} isPreview={!!access.preview}/><DashboardHome staff={staff} athleteId={access.athleteId} summary={summary} leaderboards={leaderboards} dueFocus={dueFocus}/></>;
}
