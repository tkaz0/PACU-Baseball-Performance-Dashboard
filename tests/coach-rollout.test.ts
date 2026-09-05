import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";

// Fictional identities and email addresses only; isolated in-memory PostgreSQL.
const db = new PGlite();
const actors = {
  admin: "11111111-1111-4111-8111-111111111111", coach: "22222222-2222-4222-8222-222222222222",
  player: "33333333-3333-4333-8333-333333333333", inactive: "44444444-4444-4444-8444-444444444444",
  unconfigured: "55555555-5555-4555-8555-555555555555", secondAdmin: "66666666-6666-4666-8666-666666666666",
};
async function asUser<T>(subject: string | null, run: () => Promise<T>) {
  await db.exec(`set role ${subject ? "authenticated" : "anon"}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [subject ?? ""]);
  try { return await run(); }
  finally { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub','',false)"); }
}
async function prepare(name: string | null = "Fictional Coach", email: string | null = "coach@example.com", reviewed: boolean | null = true) {
  return (await db.query<{ id: string }>("select public.admin_prepare_coach($1,$2,$3) as id", [name, email, reviewed])).rows[0].id;
}
async function authorizationState() {
  return { users: (await db.query("select * from auth.users order by id")).rows,
    accounts: (await db.query("select * from public.app_accounts order by user_id")).rows,
    roles: (await db.query("select * from public.account_roles order by user_id,role")).rows,
    links: (await db.query("select * from public.account_athletes order by user_id")).rows };
}

beforeAll(async () => {
  await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
  const dir = new URL("../supabase/migrations/", import.meta.url);
  for (const filename of readdirSync(dir).filter(name => name.endsWith(".sql")).sort()) await db.exec(readFileSync(new URL(filename, dir), "utf8"));
  for (const [actor, id] of Object.entries(actors)) {
    await db.query("insert into auth.users(id) values($1)", [id]);
    if (actor === "unconfigured") continue;
    await db.query("insert into public.app_accounts(user_id,is_active) values($1,$2)", [id, actor !== "inactive"]);
    await db.query("insert into public.account_roles(user_id,role) values($1,$2)", [id, actor === "coach" || actor === "player" ? actor : "admin"]);
  }
});
beforeEach(async () => {
  await db.exec("delete from public.coach_invitation_candidates; delete from public.audit_events where event_type='coach_candidate_prepared';");
});
afterAll(async () => { await db.close(); });

describe("coach preparation authorization", () => {
  it("denies anonymous reads and execution", async () => {
    await asUser(null, async () => {
      await expect(db.query("select * from public.coach_invitation_candidates")).rejects.toMatchObject({ code: "42501" });
      await expect(prepare()).rejects.toMatchObject({ code: "42501" });
    });
  });
  it.each(["coach", "player", "inactive", "unconfigured"] as const)("hides candidates from %s and denies saving through either function", async actor => {
    await asUser(actors.admin, () => prepare());
    await asUser(actors[actor], async () => {
      expect((await db.query("select * from public.coach_invitation_candidates")).rows).toEqual([]);
      await expect(prepare()).rejects.toMatchObject({ code: "42501" });
      await expect(db.query("select private.prepare_coach('Fictional','other@example.com',true)")).rejects.toMatchObject({ code: "42501" });
    });
    expect((await db.query("select * from public.coach_invitation_candidates")).rows).toHaveLength(1);
  });
  it("allows active admin reads but denies direct writes even for that admin", async () => {
    const id = await asUser(actors.admin, () => prepare());
    await asUser(actors.admin, async () => {
      expect((await db.query("select id from public.coach_invitation_candidates")).rows).toEqual([{ id }]);
      for (const sql of ["insert into public.coach_invitation_candidates(display_name,email,created_by) values('Fictional','other@example.com',auth.uid())",
        "update public.coach_invitation_candidates set display_name='Changed'", "delete from public.coach_invitation_candidates"]) await expect(db.query(sql)).rejects.toMatchObject({ code: "42501" });
    });
  });
  it("rechecks revoked active status on the next call", async () => {
    await db.query("update public.app_accounts set is_active=false where user_id=$1", [actors.secondAdmin]);
    try { await asUser(actors.secondAdmin, () => expect(prepare()).rejects.toMatchObject({ code: "42501" })); }
    finally { await db.query("update public.app_accounts set is_active=true where user_id=$1", [actors.secondAdmin]); }
    expect((await db.query("select * from public.coach_invitation_candidates")).rows).toHaveLength(0);
  });
});

describe("reviewed coach candidate preparation", () => {
  it("normalizes a reviewed candidate, audits it and leaves all Auth/access records untouched", async () => {
    const before = await authorizationState();
    const id = await asUser(actors.admin, () => prepare("  Fictional Coach  ", "  COACH@EXAMPLE.COM  "));
    expect((await db.query("select id,display_name,email,created_by from public.coach_invitation_candidates")).rows).toEqual([
      { id, display_name: "Fictional Coach", email: "coach@example.com", created_by: actors.admin },
    ]);
    expect((await db.query("select actor_id,event_type,target_id,details from public.audit_events where event_type='coach_candidate_prepared'")).rows).toEqual([
      { actor_id: actors.admin, event_type: "coach_candidate_prepared", target_id: id, details: { before: null, after: { display_name: "Fictional Coach", email: "coach@example.com" } } },
    ]);
    expect(await authorizationState()).toEqual(before);
  });
  it("repeats unchanged without duplicate records/audits, then updates only the reviewed name", async () => {
    const firstId = await asUser(actors.admin, () => prepare());
    const created = (await db.query<Record<string, unknown>>("select * from public.coach_invitation_candidates")).rows[0];
    expect(await asUser(actors.secondAdmin, () => prepare("Fictional Coach", "COACH@EXAMPLE.COM"))).toBe(firstId);
    expect((await db.query("select * from public.audit_events where event_type='coach_candidate_prepared'")).rows).toHaveLength(1);
    expect(await asUser(actors.secondAdmin, () => prepare("Fictional Coach Updated", "coach@example.com"))).toBe(firstId);
    expect((await db.query("select * from public.coach_invitation_candidates")).rows).toEqual([{ ...created, display_name: "Fictional Coach Updated" }]);
    expect((await db.query("select * from public.audit_events where event_type='coach_candidate_prepared'")).rows).toHaveLength(2);
  });
  it.each([false, null])("requires explicit review, including direct RPC calls (%s)", async reviewed => {
    await asUser(actors.admin, () => expect(prepare("Fictional Coach", "coach@example.com", reviewed)).rejects.toMatchObject({ code: "22023" }));
    expect((await db.query("select * from public.coach_invitation_candidates")).rows).toHaveLength(0);
  });
  it.each([
    [null, "coach@example.com"], ["", "coach@example.com"], [" ", "coach@example.com"], ["x".repeat(161), "coach@example.com"],
    ["Fictional\nCoach", "coach@example.com"], ["Fictional Coach", null], ["Fictional Coach", "not-email"],
    ["Fictional Coach", "coach @example.com"], ["Fictional Coach", "coach@example.com\n"], ["Fictional Coach", "x".repeat(243) + "@example.com"],
  ])("rejects invalid candidate fields %#", async (name, email) => {
    await asUser(actors.admin, () => expect(prepare(name, email)).rejects.toMatchObject({ code: "22023" }));
    expect((await db.query("select * from public.coach_invitation_candidates")).rows).toHaveLength(0);
  });
  it("rolls the candidate change back if its audit write fails", async () => {
    await db.exec(`create function public.reject_coach_audit() returns trigger language plpgsql as $$begin if new.event_type='coach_candidate_prepared' then raise exception 'fictional audit failure'; end if; return new; end;$$;
      create trigger reject_coach_audit before insert on public.audit_events for each row execute function public.reject_coach_audit();`);
    try { await asUser(actors.admin, () => expect(prepare()).rejects.toThrow("fictional audit failure")); }
    finally { await db.exec("drop trigger reject_coach_audit on public.audit_events; drop function public.reject_coach_audit();"); }
    expect((await db.query("select * from public.coach_invitation_candidates")).rows).toHaveLength(0);
  });
  it("serializes absence/upsert checks with the same account lock and pins function privileges", async () => {
    const result = await db.query<{ definition: string; security_definer: boolean; config: string[] }>(`select pg_get_functiondef(p.oid) as definition,p.prosecdef as security_definer,p.proconfig as config from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname='prepare_coach'`);
    const fn = result.rows[0];
    expect(fn.security_definer).toBe(true); expect(fn.config).toContain('search_path=""');
    expect(fn.definition.indexOf("pg_advisory_xact_lock(72104001)")).toBeLessThan(fn.definition.indexOf("private.has_role('admin')"));
    expect(fn.definition.indexOf("private.has_role('admin')")).toBeLessThan(fn.definition.indexOf("select * into previous"));
    expect(fn.definition).toContain("on conflict(email) do update");
    for (const name of ["public.admin_prepare_coach(text,text,boolean)", "private.prepare_coach(text,text,boolean)"]) {
      expect((await db.query<{ allowed: boolean }>("select has_function_privilege('anon',$1,'execute') as allowed", [name])).rows[0].allowed).toBe(false);
      expect((await db.query<{ allowed: boolean }>("select has_function_privilege('authenticated',$1,'execute') as allowed", [name])).rows[0].allowed).toBe(true);
    }
  });
});
