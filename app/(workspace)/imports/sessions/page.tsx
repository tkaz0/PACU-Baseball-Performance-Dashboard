import Link from "next/link";
import { requireImportAccess } from "@/lib/auth";
import { loadSessionLibrary } from "@/lib/session-library-server";
import { PageHeading } from "@/components/page-heading";
import { SessionLibrary } from "@/components/session-library";
import { canMutatePresentedAccess } from "@/lib/access-preview";

export default async function SessionsPage() {
  const access = await requireImportAccess();
  const sessions = await loadSessionLibrary();
  return <>
    <PageHeading section="Coaching" title="Session Library" description="Full Swing and Blast reports, with the players and results saved from each file."><Link href="/imports" className="btn btn-primary">Add or Finish a Session</Link></PageHeading>
    <SessionLibrary sessions={sessions} canCorrect={canMutatePresentedAccess(access)} allowRestore={canMutatePresentedAccess(access)} />
  </>;
}
