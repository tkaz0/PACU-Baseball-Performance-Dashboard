import { requireImportAccess } from "@/lib/auth";
import { PageHeading } from "@/components/page-heading";
import { MovementImport } from "@/components/movement-import";
import Link from "next/link";
export default async function Page(){
 const {supabase}=await requireImportAccess();
 const {data,error}=await supabase.from("athletes").select("athlete_code,first_name,last_name,preferred_name").order("last_name").limit(1000);
 if(error)throw new Error("Roster could not be loaded.");
 return <><PageHeading section="Import Center" title="Movement Screenings" description="Review Capstone results and save them to each player’s Physicality tab."><Link href="/imports" className="btn btn-secondary">Import Center</Link></PageHeading><MovementImport roster={(data??[]).map(r=>({code:r.athlete_code,name:`${r.preferred_name||r.first_name} ${r.last_name}`}))}/></>;
}
