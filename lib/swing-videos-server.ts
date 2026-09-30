import "server-only";
import type { requireAccess } from "@/lib/auth";
import { canReadPresentedAthlete } from "@/lib/access-preview";
import { UUID_PATTERN } from "@/lib/types";
import { validSwingVideoSize, validSwingVideoTitle, type SwingVideo } from "@/lib/swing-videos";

export async function loadSwingVideos(access: Awaited<ReturnType<typeof requireAccess>>, athleteId: string): Promise<SwingVideo[]> {
  if (!UUID_PATTERN.test(athleteId) || !canReadPresentedAthlete(access,athleteId)) throw new Error("Swing video access denied.");
  const { data,error } = await access.supabase.rpc("athlete_swing_videos",{p_athlete_id:athleteId});
  if (error || !Array.isArray(data) || data.length > 500) throw new Error("Swing videos could not be loaded.");
  const result: SwingVideo[] = data.map((row: Record<string,unknown>) => {
    if (!row || typeof row !== "object" || !UUID_PATTERN.test(String(row.id)) || typeof row.fileHash !== "string" || !/^[a-f0-9]{64}$/.test(row.fileHash) ||
      !Number.isSafeInteger(row.sourceRow) || Number(row.sourceRow)<2 || Number(row.sourceRow)>1000000 || !validSwingVideoTitle(row.title) || !validSwingVideoSize(row.bytes) ||
      typeof row.createdAt !== "string" || !Number.isFinite(Date.parse(row.createdAt))) throw new Error("Swing video format is invalid.");
    return {id:row.id as string,fileHash:row.fileHash,sourceRow:row.sourceRow as number,title:row.title,bytes:row.bytes,createdAt:row.createdAt};
  });
  if(new Set(result.map(row=>row.id)).size!==result.length)throw new Error("Duplicate swing video.");
  return result;
}
