import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";
const db = new PGlite();
const admin = "11111111-1111-4111-8111-111111111111", coach = "22222222-2222-4222-8222-222222222222", player = "33333333-3333-4333-8333-333333333333", other = "44444444-4444-4444-8444-444444444444", athlete = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", peer = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", note = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
async function as<T>(id: string | null, run: () => Promise<T>) { await db.exec(`set role ${id ? "authenticated" : "anon"}`); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id ?? ""]); try { return await run(); } finally { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub','',false)"); } }
const read = (id = athlete) => db.query<{ notes: Array<Record<string, unknown>> }>("select public.athlete_trend_annotations($1) notes", [id]);
const save = (revision: number, shared = false, archived = false, target = athlete, id = note, text = "Fictional stance adjustment", category = "stance") => db.query<{ receipt: { id: string; revision: number } }>("select public.staff_save_trend_annotation($1,$2,$3,$4,$5,$6,$7,$8,$9) receipt", [target, id, revision, "2026-09-01", category, "all", text, shared, archived]);
beforeAll(async () => {
  await db.exec("create role anon nologin; create role authenticated nologin; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema public,auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;");
  for (const file of ["202609040001_identity_and_access.sql", "202609300002_trend_annotations.sql"]) await db.exec(readFileSync(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
  for (const [id, role] of [[admin, "admin"], [coach, "coach"], [player, "player"], [other, "player"]]) { await db.query("insert into auth.users(id) values($1)", [id]); await db.query("insert into public.app_accounts(user_id,is_active) values($1,true)", [id]); await db.query("insert into public.account_roles(user_id,role) values($1,$2)", [id, role]); }
  await db.query("insert into public.athletes(id,athlete_code,first_name,last_name) values($1,'SYN-001','Fictional','One'),($2,'SYN-002','Fictional','Two')", [athlete, peer]);
  await db.query("insert into public.account_athletes(user_id,athlete_id) values($1,$2),($3,$4)", [player, athlete, other, peer]);
});
afterAll(() => db.close());
it("stores staff context separately and exposes only explicit sharing to the linked player", async () => {
  expect((await as(admin, () => save(0))).rows[0].receipt).toEqual({ id: note, revision: 1 });
  expect((await as(player, () => read())).rows[0].notes).toEqual([]);
  expect((await as(coach, () => read())).rows[0].notes[0]).toMatchObject({ note: "Fictional stance adjustment", shared: false, revision: 1 });
  await as(coach, () => save(1, true));
  expect((await as(player, () => read())).rows[0].notes[0]).toMatchObject({ note: "Fictional stance adjustment", shared: true, revision: 2 });
  await as(player, async () => { await expect(db.exec("select * from public.trend_annotations")).rejects.toThrow(); await expect(save(2)).rejects.toThrow("Active staff required"); await expect(read(peer)).rejects.toThrow("access denied"); });
  await as(other, async () => { await expect(read()).rejects.toThrow("access denied"); });
  await as(null, async () => { await expect(read()).rejects.toThrow(); await expect(save(2)).rejects.toThrow(); });
});
it("rejects stale writes and prevents moving an existing note to another player", async () => {
  await as(coach, async () => { await expect(save(1, true)).rejects.toThrow("changed"); await expect(save(2, true, false, peer)).rejects.toThrow("changed"); });
  expect((await as(admin, () => read())).rows[0].notes).toHaveLength(1);
  expect((await as(admin, () => read())).rows[0].notes[0].revision).toBe(2);
  await as(admin, () => save(2, true, true));
  expect((await as(player, () => read())).rows[0].notes).toEqual([]);
  expect((await as(admin, () => read())).rows[0].notes[0]).toMatchObject({ archived: true, revision: 3 });
});
it("validates note text, known categories, current dates and nullable inputs at the database boundary", async () => {
  await as(admin, async () => {
    for (const text of ["", "x".repeat(401), "a\nb"]) await expect(save(3, true, false, athlete, note, text)).rejects.toThrow("Invalid coaching note");
    await expect(save(3, true, false, athlete, note, "Fictional note", "diagnosis")).rejects.toThrow("Invalid coaching note");
    await expect(db.query("select public.staff_save_trend_annotation($1,$2,3,'2026-09-01','other','unreviewed','Invalid scope',false,false)", [athlete, note])).rejects.toThrow("Invalid coaching note");
    await expect(db.query("select public.staff_save_trend_annotation($1,$2,3,current_date+1,'other','all','Future note',false,false)", [athlete, note])).rejects.toThrow("Invalid coaching note");
    await expect(db.query("select public.staff_save_trend_annotation($1,$2,3,null,'other','all','Undated note',false,false)", [athlete, note])).rejects.toThrow("Invalid coaching note");
  });
  const audit = (await db.query<{ details: Record<string, unknown> }>("select details from public.audit_events where event_type='trend_annotation_saved'" )).rows;
  expect(audit).toHaveLength(3);
  expect(audit.every(row => !JSON.stringify(row).includes("Fictional"))).toBe(true);
});
it("rechecks active staff status and linked-player status after revocation", async () => {
  await db.query("update public.app_accounts set is_active=false where user_id in ($1,$2)", [coach, player]);
  await as(coach, async () => { await expect(read()).rejects.toThrow("access denied"); await expect(save(3)).rejects.toThrow("Active staff required"); });
  await as(player, async () => { await expect(read()).rejects.toThrow("access denied"); });
});
