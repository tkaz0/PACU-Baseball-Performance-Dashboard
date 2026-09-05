import { LocalOverview } from "@/components/local-dashboard";
import { requireAdminWorkspaceAccess } from "@/lib/auth";
export default async function PreviewOverview() { await requireAdminWorkspaceAccess(); return <LocalOverview />; }
