import { LocalAccessPage } from "@/components/local-access";
import { requireAdminWorkspaceAccess } from "@/lib/auth";
export default async function AccessViewsPage() { await requireAdminWorkspaceAccess(); return <LocalAccessPage />; }
