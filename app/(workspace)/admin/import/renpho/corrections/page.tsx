import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { RenphoReportCorrection } from "@/components/renpho-report-correction";
import { RenphoReportReassignment } from "@/components/renpho-report-reassignment";
import { loadRenphoReportCatalog, loadRenphoCorrectionRoster } from "@/lib/renpho-report-catalog-server";

export default async function RenphoCorrectionsPage() {
  const [reports, players] = await Promise.all([loadRenphoReportCatalog(), loadRenphoCorrectionRoster()]);
  return <>
    <PageHeading section="Administration" title="Correct Report Assignments" description="Review and correct players’ RENPHO report assignments."><Link href="/admin/import/renpho" className="btn btn-secondary">Back to Report IDs</Link></PageHeading>
    <RenphoReportCorrection reports={reports} />
    <RenphoReportReassignment reports={reports} players={players} />
    <details className="panel mt-6 p-5">
      <summary className="cursor-pointer font-semibold">Saved reports · {reports.length}</summary>
      <div className="table-wrap mt-4"><table aria-label="Saved RENPHO report metadata"><thead><tr><th>Player</th><th>PAC ID</th><th>Test Date</th><th>File</th><th>Readings</th><th>Height</th><th>File Reference</th></tr></thead><tbody>{reports.map(report => <tr key={report.fileHash}><th scope="row">{report.athleteName}</th><td>{report.athleteCode}</td><td>{report.measuredAt}</td><td>{report.sourceFile}</td><td>{report.measurementCount}</td><td>{report.hasHeight ? "Saved" : "Reopen original report to add"}</td><td className="break-all text-xs">{report.fileHash}</td></tr>)}</tbody></table></div>
    </details>
  </>;
}
