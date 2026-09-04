"use server";
import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAccess } from "@/lib/auth";
import { MAX_BYTES, parseRosterCsv } from "@/lib/roster/csv";
import { UUID_PATTERN } from "@/lib/types";

export async function stageImport(form: FormData) {
  const { supabase } = await requireAccess(["admin"]);
  const file = form.get("file");
  const season = String(form.get("season") ?? "").trim();
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".csv") || file.size === 0 || file.size > MAX_BYTES) redirect("/admin/import?error=file");
  if (!/^20\d{2}(-\d{2})?$/.test(season)) redirect("/admin/import?error=season");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let source: string;
  try { source = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { redirect("/admin/import?validation=Save%20the%20CSV%20with%20UTF-8%20encoding%20and%20upload%20again."); }
  let rows;
  try { rows = parseRosterCsv(source); } catch (error) {
    const message = error instanceof Error ? error.message : "CSV could not be read.";
    redirect(`/admin/import?validation=${encodeURIComponent(message)}`);
  }
  const { data: id, error } = await supabase.rpc("stage_roster_import", {
    p_rows: rows, p_season: season, p_filename: file.name.replace(/[\x00-\x1f\x7f]/g, "").slice(0,160),
    p_sha256: createHash("sha256").update(bytes).digest("hex"),
  });
  if (error || !id) redirect("/admin/import?error=stage");
  redirect(`/admin/import/${id}`);
}
export async function approveImport(form: FormData) {
  const { supabase } = await requireAccess(["admin"]);
  const id = String(form.get("import_id") ?? "");
  if (!UUID_PATTERN.test(id)) redirect("/admin/import?error=draft");
  if (form.get("confirm") !== "yes") redirect(`/admin/import/${id}?error=confirm`);
  // Only the persisted draft ID is accepted. SQL revalidates the authoritative preview.
  const { error } = await supabase.rpc("approve_roster_import", { p_import_id: id });
  if (error) redirect(`/admin/import/${id}?error=approval`);
  revalidatePath("/overview"); revalidatePath("/roster"); revalidatePath("/athletes", "layout");
  redirect(`/admin/import/${id}?applied=1`);
}
