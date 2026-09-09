import { notFound, redirect } from "next/navigation";
import { requireAccess } from "@/lib/auth";
import { canReadPresentedAthlete } from "@/lib/access-preview";

/** Resolve a permanent code using the ordinary signed-in roster permissions. */
export default async function PlayerCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const access = await requireAccess();
  if (!/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(code)) notFound();
  const { data, error } = await access.supabase.from("athletes").select("id").eq("athlete_code", code).maybeSingle();
  if (error) throw new Error("Player profile could not be loaded.");
  if (!data || !canReadPresentedAthlete(access, data.id)) notFound();
  redirect(`/athletes/${data.id}`);
}
