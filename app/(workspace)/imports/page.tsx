import Link from "next/link";
import styles from "@/components/import-presentation.module.css";
import { requireImportAccess } from "@/lib/auth";
import { PageHeading } from "@/components/page-heading";
import { TeamImportCenter } from "@/components/team-import-center";
import { GameSheetStatus } from "@/components/game-sheet-status";
import type { RosterAthlete } from "@/lib/types";

export default async function ImportsPage() {
  const { supabase, roles } = await requireImportAccess();
  const { data, error } = await supabase.from("athletes").select("*, athlete_seasons!inner(*)").eq("athlete_seasons.season", "2026-27").order("last_name").limit(1000);
  if (error) throw new Error("The team roster could not be loaded for imports. Refresh and try again.");
  return <>
    <PageHeading section="Pacific Baseball" title="Import Center" description="Add reports and session summaries to player profiles."><Link href="/testing/entry" className="btn btn-secondary">Enter Results Manually</Link></PageHeading>
    <TeamImportCenter roster={(data ?? []) as RosterAthlete[]} />
    <div className="mt-6"><GameSheetStatus /></div>
    <details className={styles.otherTools}><summary className="cursor-pointer text-sm font-semibold">Import History &amp; Other Tools</summary><div className="mt-4 flex flex-wrap gap-3"><Link href="/admin/performance" className="btn btn-secondary">Import History</Link><Link href="/preview/import" className="btn btn-secondary">Advanced File Import</Link>{roles.includes("admin") && <><Link href="/admin/import" className="btn btn-secondary">Roster Import</Link><Link href="/admin/import/renpho" className="btn btn-secondary">Roster RENPHO IDs</Link></>}</div></details>
  </>;
}
