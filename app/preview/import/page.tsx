import { ImportCenter } from "@/components/import-center";
import { PageHeading } from "@/components/page-heading";

export default function ImportPage() {
  return (
    <>
      <PageHeading section="Your browser workspace" title="Import Center" description="Bring in a roster or measurement spreadsheet, map its columns, and review every change before saving." />
      <ImportCenter />
    </>
  );
}
