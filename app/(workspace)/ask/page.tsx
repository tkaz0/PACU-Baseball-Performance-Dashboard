import { PageHeading } from "@/components/page-heading";
import { AskData } from "@/components/ask-data";
import { requireRenderImportAccess } from "@/lib/render-access";
import { aiEnabled } from "@/lib/ai-server";

export const metadata = { title: "Ask the Data" };
export default async function AskPage() {
  await requireRenderImportAccess();
  return <><PageHeading section="Coaching" title="Ask the Data" description="Fall 2026 · Ask questions about saved game stats and testing results in plain English."/><AskData enabled={aiEnabled()}/></>;
}
