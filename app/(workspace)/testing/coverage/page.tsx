import { DataCoverage } from "@/components/data-coverage";
import { TestingNavigation } from "@/components/testing-navigation";
import { PageHeading } from "@/components/page-heading";
import { loadDataCoverage } from "@/lib/analytics-server";
export default async function DataCoveragePage() {
  const data = await loadDataCoverage();
  return <><PageHeading section="Staff Tools" title="Data Coverage" description="See who has results and what still needs testing." /><TestingNavigation coverage /><DataCoverage data={data} /></>;
}
