"use server";
import { requireAdminWorkspaceAccess } from "@/lib/auth";
import { loadContactsAllowed } from "@/lib/contacts-allowed-server";
import { battedBallType } from "@/lib/batted-ball-profile";
import { isLikelyFoul } from "@/lib/likely-foul";
import { UUID_PATTERN } from "@/lib/types";
import type { ScoutContact } from "@/lib/bws-scouting";

export type BwsPitcherContact = { count: number; groundPct: number | null; hardPct: number | null; avgEv: number | null };
export type BwsScoutingData = { hitters: Record<string, ScoutContact[]>; pitchers: Record<string, BwsPitcherContact>; failedPitchers: number };
const ids = (value: unknown, max: number) => Array.isArray(value) && value.length <= max && value.every(id => typeof id === "string" && UUID_PATTERN.test(id)) ? [...new Set(value as string[])] : null;
const num = (v: unknown, max: number) => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= max;

/**
 * Private BWS scouting (actual Admin, outside View as). Reads saved in-game Full Swing batted balls for
 * the opposing hitters, the roster hand of a linked pitcher for each ball, and contact allowed by your
 * pitchers, through the same staff readers the dashboard already uses. Nothing is written.
 */
export async function loadBwsScoutingData(hitterIds: unknown, pitcherIds: unknown): Promise<BwsScoutingData | { error: string }> {
  const access = await requireAdminWorkspaceAccess();
  const hitters = ids(hitterIds, 60), pitchers = ids(pitcherIds, 40);
  if (!hitters || !pitchers) return { error: "Choose players from the current roster." };
  const contacts: Record<string, ScoutContact[]> = Object.fromEntries(hitters.map(id => [id, []]));
  if (hitters.length) {
    const { data, error } = await access.supabase.from("full_swing_contacts").select("file_hash,source_row,athlete_id,exit_velocity,launch_angle,direction,distance")
      .in("category", ["game", "intrasquad"]).in("athlete_id", hitters).gte("played_on", "2026-09-01").lte("played_on", "2026-12-31").limit(5000);
    if (error || !Array.isArray(data)) return { error: "Batted-ball results could not be loaded." };
    // Pitcher hand per ball, only for balls linked to a roster pitcher in the same file.
    const hands = new Map<string, "R" | "L">();
    for (let i = 0; i < hitters.length; i += 6) await Promise.all(hitters.slice(i, i + 6).map(async id => {
      const { data: rows } = await access.supabase.rpc("athlete_contact_pitcher_hands", { p_athlete: id });
      if (Array.isArray(rows)) for (const row of rows) if (typeof row?.file_hash === "string" && Number.isSafeInteger(row.source_row) && (row.pitcher_throws === "R" || row.pitcher_throws === "L")) hands.set(`${row.file_hash}:${row.source_row}`, row.pitcher_throws);
    }));
    for (const row of data) {
      if (typeof row.athlete_id !== "string" || !contacts[row.athlete_id] || !num(row.exit_velocity, 200) || row.exit_velocity <= 0 || !num(row.launch_angle, 90)) continue;
      contacts[row.athlete_id].push({ exitVelocity: row.exit_velocity, launchAngle: row.launch_angle, direction: num(row.direction, 90) ? row.direction : null,
        distance: num(row.distance, 1000) && row.distance >= 0 ? row.distance : null, pitcherThrows: hands.get(`${row.file_hash}:${row.source_row}`) ?? null });
    }
  }
  const pitcherContact: Record<string, BwsPitcherContact> = {};
  let failedPitchers = 0;
  for (let i = 0; i < pitchers.length; i += 6) await Promise.all(pitchers.slice(i, i + 6).map(async id => {
    try {
      const rows = (await loadContactsAllowed(access, id)).filter(c => c.category !== "practice" && !isLikelyFoul(c));
      const share = (test: (c: typeof rows[number]) => boolean) => rows.length ? 100 * rows.filter(test).length / rows.length : null;
      pitcherContact[id] = { count: rows.length, groundPct: share(c => battedBallType(c.launchAngle) === "ground"), hardPct: share(c => c.exitVelocity >= 90), avgEv: rows.length ? rows.reduce((a, c) => a + c.exitVelocity, 0) / rows.length : null };
    } catch { failedPitchers++; }
  }));
  return { hitters: contacts, pitchers: pitcherContact, failedPitchers };
}
