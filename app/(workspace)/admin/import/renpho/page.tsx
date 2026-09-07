import Link from "next/link";
import { requireAdminWorkspaceAccess } from "@/lib/auth";
import { PageHeading } from "@/components/page-heading";
import { RenphoMappingImport } from "@/components/renpho-mapping-import";
import { athleteName, type RosterAthlete } from "@/lib/types";

export default async function RenphoIdsPage() {
  const { supabase } = await requireAdminWorkspaceAccess();
  const { data, error } = await supabase.from("athletes").select("athlete_code,first_name,preferred_name,last_name").order("last_name").limit(1000);
  if (error || !data) throw new Error("The roster could not be loaded. Refresh before updating IDs.");
  return <>
    <PageHeading section="Administration" title="Roster RENPHO IDs" description="Connect report IDs to the right players."><Link href="/imports" className="btn btn-secondary">Back to Imports</Link></PageHeading>
    <RenphoMappingImport roster={data.map(row => ({ code: row.athlete_code as string, name: athleteName(row as RosterAthlete) }))} />
    <p className="mt-5 text-sm"><Link href="/admin/import/renpho/corrections" className="underline">Correct a Report Assignment</Link></p>
  </>;
}
