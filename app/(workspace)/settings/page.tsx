import { requireAccess } from "@/lib/auth";
import { PageHeading } from "@/components/page-heading";
import { AppearanceSettings } from "@/components/appearance-settings";

export default async function SettingsPage() {
  await requireAccess();
  return <><PageHeading section="Your Workspace" title="Settings" description="Make the dashboard comfortable to use." /><AppearanceSettings /></>;
}
