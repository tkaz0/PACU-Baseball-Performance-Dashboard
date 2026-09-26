import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminWorkspaceAccess } from "@/lib/auth";
import { UUID_PATTERN, athleteName, type RosterAthlete } from "@/lib/types";
import { readCsvRemovalReview } from "@/lib/csv-removal";
import { CsvRemoval } from "@/components/csv-removal";
import { CsvMaxReadingCorrection } from "@/components/csv-max-reading-correction";
import { readCsvMaxReadings } from "@/lib/csv-max-reading";
export default async function CsvCorrections({searchParams}:{searchParams:Promise<{athlete?:string}>}) {
 const access=await requireAdminWorkspaceAccess(), {athlete:id}=await searchParams;
 if(!id || !UUID_PATTERN.test(id)) notFound();
 const {data:athlete,error}=await access.supabase.from("athletes").select("id,athlete_code,first_name,last_name,preferred_name").eq("id",id).maybeSingle();
 if(error) throw new Error("Unable to load the selected player."); if(!athlete) notFound();
 const {data,error:readError}=await access.supabase.rpc("admin_csv_measurement_batches",{p_athlete:id});
 if(readError) throw new Error("CSV corrections are unavailable. Check the database setup.");
 const review=readCsvRemovalReview(data);
 const {data:maximums,error:maxError}=await access.supabase.rpc("admin_csv_max_readings",{p_athlete:id});
 if(maxError) throw new Error("Individual CSV corrections are unavailable. Check the database setup.");
 const readings=readCsvMaxReadings(maximums);
 return <><Link className="text-link" href={`/athletes/${id}`}>Back to Profile</Link><h1 className="mt-5 text-2xl font-bold">Correct CSV Assignments</h1><p className="font-semibold">{athleteName(athlete as RosterAthlete)}</p><p className="muted max-w-2xl">Flag a single Full Swing maximum or remove a mistakenly assigned file. Removed readings are retained privately and can be restored here.</p><CsvMaxReadingCorrection athleteId={id} rows={readings}/><CsvRemoval athleteId={id} review={review}/></>;
}
