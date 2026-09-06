import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { ManualTestingEntry } from "@/components/manual-testing-entry";
import { loadTestingRoster } from "@/lib/testing-checklist-server";
import { pacificTestingDate } from "@/lib/testing-checklist";

export default async function TestingEntryPage({ searchParams }: { searchParams: Promise<{ athlete?: string; metric?: string }> }) {
  const athletes = await loadTestingRoster();
  const query = await searchParams;
  return <>
    <PageHeading section="Testing" title="Enter Measurements" description="Choose a player, enter the results, and review before saving.">
      <Link href="/testing" className="btn btn-secondary">Testing Checklist</Link>
    </PageHeading>
    <ManualTestingEntry athletes={athletes} today={pacificTestingDate()} initialAthleteCode={query.athlete} initialMetricKey={query.metric} />
  </>;
}
