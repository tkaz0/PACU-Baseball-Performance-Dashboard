import Link from "next/link";
import { requireImportAccess } from "@/lib/auth";
import { PageHeading } from "@/components/page-heading";
import { ContactDetailsImport } from "@/components/contact-details-import";

export default async function ContactDetailsPage() {
  await requireImportAccess();
  return <><PageHeading section="Data & Testing" title="Contact Details" description="Complete existing Full Swing contact records from their original exports."><Link href="/imports" className="btn btn-secondary">Import Center</Link></PageHeading><ContactDetailsImport/></>;
}
