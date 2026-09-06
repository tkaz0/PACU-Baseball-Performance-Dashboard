import { LocalOverview } from "@/components/local-dashboard";
import { requireImportAccess } from "@/lib/auth";
export default async function PreviewOverview() { await requireImportAccess(); return <LocalOverview />; }
