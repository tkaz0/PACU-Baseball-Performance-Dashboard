import { requireRenderImportAccess as requireImportAccess } from "@/lib/render-access";
import { loadStaffAthleteChoices } from "@/lib/staff-athlete-search-server";
import { ExitMeetingError, loadExitMeetingReport } from "@/lib/exit-meeting-server";
import { ExitMeetingWorkspace } from "@/components/exit-meeting-workspace";
import { exitMeetingFormat } from "@/lib/exit-meeting";
import { notFound } from "next/navigation";

export const metadata = { title: "Exit Meetings" };
export default async function ExitMeetingsPage({ searchParams }: { searchParams: Promise<{ athlete?: string; format?: string }> }) {
  const access = await requireImportAccess();
  const [query, players] = await Promise.all([searchParams, loadStaffAthleteChoices(access)]);
  let format; try { format = exitMeetingFormat(query.format); } catch { notFound(); }
  let report = null;
  if (query.athlete) {
    try { report = await loadExitMeetingReport(access, query.athlete, format); }
    catch (error) { if (error instanceof ExitMeetingError && [400, 404].includes(error.status)) notFound(); throw error; }
  }
  return <ExitMeetingWorkspace key={query.athlete ?? "none"} players={players} selectedId={query.athlete ?? ""} report={report} format={format} />;
}
