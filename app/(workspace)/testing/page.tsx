import { TestingChecklist } from "@/components/testing-checklist";
import { testingMetric } from "@/lib/testing-checklist";
import { loadTestingChecklist } from "@/lib/testing-checklist-server";

export default async function TestingPage({ searchParams }: { searchParams: Promise<{ metric?: string | string[] }> }) {
  const query = await searchParams;
  const metric = typeof query.metric === "string" && testingMetric(query.metric) ? query.metric : "weight";
  return <TestingChecklist checklist={await loadTestingChecklist(metric)} />;
}
