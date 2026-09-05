import { LocalRoster } from "@/components/local-dashboard";
import { requireAdminWorkspaceAccess } from "@/lib/auth";
export default async function PreviewRoster({ searchParams }: { searchParams: Promise<{ q?: string; season?: string }> }) {
  await requireAdminWorkspaceAccess();
  const params = await searchParams;
  return <LocalRoster initialQuery={typeof params.q === "string" ? params.q.slice(0, 100) : ""} initialSeason={typeof params.season === "string" ? params.season : ""} />;
}
