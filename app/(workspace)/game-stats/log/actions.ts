"use server";
import {revalidatePath} from "next/cache";
import {requireImportAccess} from "@/lib/auth";
import {loadTestingRoster} from "@/lib/testing-checklist-server";
import {validateGameLog,type GameLogSaveResult} from "@/lib/game-log";
export async function saveGameLog(input:unknown,confirmed:boolean):Promise<GameLogSaveResult>{
 await requireImportAccess();if(confirmed!==true)return {status:"invalid",error:"Confirm the player, game and counts before saving."};
 let value;try{value=validateGameLog(input);}catch(e){return {status:"invalid",error:e instanceof Error?e.message:"Review this game entry."};}
 const roster=await loadTestingRoster();if(!roster.some(a=>a.id===value.athleteId))return {status:"invalid",error:"Choose an eligible rostered player."};
 const access=await requireImportAccess();
 const {data,error}=await access.supabase.rpc("save_game_log",{p_input:value});
 if(error){if(error.code==="23505")return {status:"invalid",error:"This player already has an entry for that date, opponent and game number. Open the saved entry to correct it."};if(error.code==="40001")return {status:"invalid",error:"This game entry changed. Refresh the saved entry before editing."};return {status:"uncertain",error:"The save could not be confirmed. Check the game log or retry this same reviewed entry."};}
 if(!data||data.status!=="saved"||data.id!==value.id||data.version!==value.expectedVersion+1)return {status:"uncertain",error:"The save receipt could not be verified. Retry this same reviewed entry."};
 for(const path of ["/game-stats","/game-stats/log","/game-stats/review",`/athletes/${value.athleteId}`])revalidatePath(path);
 return {status:"saved",id:data.id,version:data.version};
}
