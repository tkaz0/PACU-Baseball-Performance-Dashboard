import { requireImportAccess } from "@/lib/auth";
import { loadStaffAthleteChoices } from "@/lib/staff-athlete-search-server";
import { ExitMeetingError, loadExitMeetingReport } from "@/lib/exit-meeting-server";
import { ExitMeetingWorkspace } from "@/components/exit-meeting-workspace";
import { notFound } from "next/navigation";

export const metadata = { title: "Exit Meetings" };
export default async function ExitMeetingsPage({ searchParams }: { searchParams: Promise<{ athlete?: string }> }) {
  const access = await requireImportAccess();
  const [query, players] = await Promise.all([searchParams, loadStaffAthleteChoices(access)]);
  let report = null;
  if (query.athlete) {
    try { report = await loadExitMeetingReport(access, query.athlete); }
    catch (error) { if (error instanceof ExitMeetingError && [400, 404].includes(error.status)) notFound(); throw error; }
  }
  return <ExitMeetingWorkspace key={query.athlete ?? "none"} players={players} selectedId={query.athlete ?? ""} report={report} />;
}
