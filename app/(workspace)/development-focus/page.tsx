import { PageHeading } from "@/components/page-heading";
import { DevelopmentFocus } from "@/components/development-focus";
import { loadDevelopmentFocusData } from "@/lib/development-focus-server";

export const metadata = { title: "Development Focus" };
export default async function DevelopmentFocusPage({ searchParams }: { searchParams: Promise<{ qualified?: string }> }) {
  const [data, params] = await Promise.all([loadDevelopmentFocusData(), searchParams]);
  return <><PageHeading section="Coaching" title="Development Focus" description="Fall 2026 · Command for pitchers and power for hitters, from game sheets and Full Swing contact."/><DevelopmentFocus {...data} qualified={params.qualified === "1"}/></>;
}
