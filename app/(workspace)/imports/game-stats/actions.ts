"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireImportAccess } from "@/lib/auth";
import { validateGameImport } from "@/lib/game-import";
import { UUID_PATTERN } from "@/lib/types";
export async function importGameSnapshot(form:FormData) {
  await requireImportAccess();
  const payloads=form.getAll("snapshot"),confirm=form.getAll("confirm");
  if(payloads.length!==1||typeof payloads[0]!=="string"||new TextEncoder().encode(payloads[0]).byteLength>1024*1024||confirm.length!==1||confirm[0]!=="yes")redirect("/imports/game-stats?error=review");
  let checked;
  try{checked=validateGameImport(JSON.parse(payloads[0]));}catch{redirect("/imports/game-stats?error=input");}
  const access=await requireImportAccess();
  let response;
  try{response=await access.supabase.rpc("import_game_snapshot",{p_source:checked.source,p_hash:checked.contentHash,p_fetched_at:checked.fetchedAt,p_rows:checked.observations});}catch{redirect("/imports/game-stats?error=save");}
  const {data,error}=response;
  if(error||!data||!UUID_PATTERN.test(data.snapshot_id)||typeof data.changed!=="boolean"||data.observations!==checked.observations.length)redirect("/imports/game-stats?error=save");
  revalidatePath("/game-stats");revalidatePath("/athletes","layout");
  redirect(`/imports/game-stats?saved=${data.snapshot_id}`);
}
