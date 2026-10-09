import { initializeStorageSchema } from "./fixtures/storage-schema";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";

// Fictional identities and readings only.
const db = new PGlite();
const admin = "11111111-1111-4111-8111-111111111111", player = "33333333-3333-4333-8333-333333333333", other = "44444444-4444-4444-8444-444444444444";
const batter = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", lefty = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", peerBatter = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const hash = "d".repeat(64);
async function as<T>(id: string | null, run: () => Promise<T>) { await db.exec(`set role ${id ? "authenticated" : "anon"}`); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id ?? ""]); try { return await run(); } finally { await db.exec("reset role"); } }
const link = (rows: unknown) => db.query<{ r: { created: number; unchanged: number; skipped: number } }>("select public.save_full_swing_contact_pitchers($1,$2::jsonb) r", [hash, JSON.stringify(rows)]).then(res => res.rows[0].r);
const hands = (athlete: string) => db.query<{ file_hash: string; source_row: number; pitcher_throws: string | null }>("select * from public.athlete_contact_pitcher_hands($1)", [athlete]).then(res => res.rows);

beforeAll(async () => {
  await db.exec("create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;");
  await initializeStorageSchema(db);
  const directory = new URL("../supabase/migrations/", import.meta.url);
  for (const file of readdirSync(directory).filter(name => name.endsWith(".sql")).sort()) await db.exec(readFileSync(new URL(file, directory), "utf8"));
  for (const [id, role] of [[admin, "admin"], [player, "player"], [other, "player"]]) {
    await db.query("insert into auth.users values($1)", [id]); await db.query("insert into public.app_accounts(user_id,is_active) values($1,true)", [id]);
    await db.query("insert into public.account_roles(user_id,role) values($1,$2)", [id, role]);
  }
  for (const [id, code, throws] of [[batter, "PAC-0001", "R"], [lefty, "PAC-0002", "L"], [peerBatter, "PAC-0003", "R"]]) {
    await db.query("insert into public.athletes(id,athlete_code,first_name,last_name) values($1,$2,'Fictional','Player')", [id, code]);
    await db.query("insert into public.athlete_seasons(athlete_id,season,throws) values($1,'2026-27',$2)", [id, throws]);
  }
  await db.query("insert into public.account_athletes(user_id,athlete_id) values($1,$2),($3,$4)", [player, batter, other, peerBatter]);
  await as(admin, async () => {
    const contact = (code: string, sourceRow: number) => ({ athleteCode: code, fileHash: hash, sourceFile: "fictional-session.csv", sourceRow, pitchNumber: sourceRow - 1, playedOn: "2026-09-11", category: "intrasquad", exitVelocity: 92.5, launchAngle: 18 });
    await db.query("select public.staff_import_full_swing_contacts($1::jsonb)", [JSON.stringify([contact("PAC-0001", 2), contact("PAC-0001", 3), contact("PAC-0003", 4)])]);
    await db.query("select public.admin_import_performance($1::jsonb)", [JSON.stringify([{ observation_id: `observation:${JSON.stringify([hash, "CSV · Full Swing session summaries v1", 7, 5])}`, athlete_code: "PAC-0002", metric_key: "max_pitch_velocity", unit: "mph", value: 81.234, measured_at: "2026-09-11", source: "Full Swing · Intrasquad", file_hash: hash, source_file: "fictional-session.csv", source_sheet: "CSV · Full Swing session summaries v1", source_row: 7 }])]);
  });
});
afterAll(() => db.close());

it("links a batted ball only when the reviewed pitcher summary value matches, and never moves a link", async () => {
  expect(await as(admin, () => link([{ sourceRow: 2, pitcherSummaryRow: 7, pitcherMaxVelocity: 81.234 }, { sourceRow: 3, pitcherSummaryRow: 7, pitcherMaxVelocity: 80 }, { sourceRow: 99, pitcherSummaryRow: 7, pitcherMaxVelocity: 81.234 }]))).toEqual({ created: 1, unchanged: 0, skipped: 2 });
  expect(await as(admin, () => link([{ sourceRow: 2, pitcherSummaryRow: 7, pitcherMaxVelocity: 81.234 }, { sourceRow: 4, pitcherSummaryRow: 7, pitcherMaxVelocity: 81.234 }]))).toEqual({ created: 1, unchanged: 1, skipped: 0 });
  await as(player, async () => { await expect(link([{ sourceRow: 3, pitcherSummaryRow: 7, pitcherMaxVelocity: 81.234 }])).rejects.toThrow("Active staff"); });
  await as(admin, async () => { await expect(link([{ sourceRow: 2, pitcherSummaryRow: 7, pitcherMaxVelocity: 81.234, pitcher: "PAC-0002" }])).rejects.toThrow("Invalid pitcher link row"); });
});

it("returns only the roster hand, and only for athletes the caller may read", async () => {
  expect(await as(player, () => hands(batter))).toEqual([{ file_hash: hash, source_row: 2, pitcher_throws: "L" }]);
  await as(player, async () => { await expect(hands(peerBatter)).rejects.toThrow("Athlete access denied"); });
  await as(player, async () => { await expect(db.query("select * from private.full_swing_contact_pitchers")).rejects.toThrow(); });
  expect(await as(admin, () => hands(peerBatter))).toEqual([{ file_hash: hash, source_row: 4, pitcher_throws: "L" }]);
  await as(null, async () => { await expect(hands(batter)).rejects.toThrow(); });
});
