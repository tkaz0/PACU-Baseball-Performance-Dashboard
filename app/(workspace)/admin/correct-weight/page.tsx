import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminWorkspaceAccess } from "@/lib/auth";
import { UUID_PATTERN, athleteName, type RosterAthlete } from "@/lib/types";
import { loadAthletePerformance } from "@/lib/performance-server";
import { WeightCorrection } from "@/components/weight-correction";
import { normalizePlayerMetric } from "@/lib/player-performance";
export default async function CorrectWeightPage({ searchParams }: { searchParams: Promise<{ athlete?: string }> }) {
  const access = await requireAdminWorkspaceAccess();
  const { athlete: id } = await searchParams;
  if (!id || !UUID_PATTERN.test(id)) notFound();
  const { data, error } = await access.supabase.from("athletes").select("id,athlete_code,first_name,last_name,preferred_name").eq("id", id).maybeSingle();
  if (error) throw new Error("Unable to load the selected player.");
  if (!data) notFound();
  const player = data as RosterAthlete, performance = await loadAthletePerformance(access, player);
  const readings = performance.measurements.filter(row => normalizePlayerMetric(row.metric, row.unit)?.key === "weight" && ["lb", "kg"].includes(row.unit)).sort((a, b) => b.measured_at.localeCompare(a.measured_at)).map(row => ({ id: row.id, value: row.value, unit: row.unit, date: row.measured_at, source: row.source, file: row.source_file }));
  return <><Link className="text-link" href={`/athletes/${id}`}>Back to profile</Link><h1 className="mt-5 text-2xl font-bold">Correct Recorded Weight</h1><p className="mb-6 font-semibold">{athleteName(player)} · {player.athlete_code}</p><WeightCorrection athleteId={id} readings={readings} /></>;
}
