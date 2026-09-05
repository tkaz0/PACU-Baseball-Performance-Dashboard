import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";

// Isolated PostgreSQL execution, with only the external Supabase Auth contract
// emulated. All identities are fictional; no hosted accounts or emails are used.
const db = new PGlite();
const actors = {
  admin: "11111111-1111-4111-8111-111111111111",
  coach: "22222222-2222-4222-8222-222222222222",
  player: "33333333-3333-4333-8333-333333333333",
  inactiveAdmin: "44444444-4444-4444-8444-444444444444",
  unconfigured: "55555555-5555-4555-8555-555555555555",
  noRoles: "66666666-6666-4666-8666-666666666666",
  secondAdmin: "77777777-7777-4777-8777-777777777777",
};
let nextUser = 0;
let nextAthlete = 0;

async function asUser<T>(id: string | null, operation: () => Promise<T>) {
  await db.exec(`set role ${id ? "authenticated" : "anon"}`);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id ?? ""]);
  try { return await operation(); }
  finally { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub', '', false)"); }
}
async function freshUser() {
  const id = `90000000-0000-4000-8000-${String(++nextUser).padStart(12, "0")}`;
  await db.query("insert into auth.users(id) values($1)", [id]);
  return id;
}
async function freshAthlete() {
  const index = ++nextAthlete;
  const id = `a0000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
  await db.query("insert into public.athletes(id,athlete_code,first_name,last_name) values($1,$2,'Fictional','Invitefixture')", [id, `SYN-INV-${index}`]);
  return id;
}
const provision = (target: string | null, role: string | null, athlete: string | null = null) => db.query(
  "select public.admin_provision_invited_account($1::uuid,$2::text,$3::uuid)", [target, role, athlete],
);
const configure = (target: string, active: boolean, roles: string[], athlete: string | null = null) => db.query(
  "select public.admin_configure_account($1::uuid,$2::boolean,$3::text[],$4::uuid)", [target, active, roles, athlete],
);
async function accountState(target: string) {
  return {
    account: (await db.query("select * from public.app_accounts where user_id=$1", [target])).rows,
    roles: (await db.query("select * from public.account_roles where user_id=$1 order by role", [target])).rows,
    links: (await db.query("select * from public.account_athletes where user_id=$1", [target])).rows,
    audit: (await db.query("select * from public.audit_events where target_id=$1 order by created_at,id", [target])).rows,
  };
}
const emptyAccount = { account: [], roles: [], links: [], audit: [] };

beforeAll(async () => {
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema public, auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `);
  const migrationDir = new URL("../supabase/migrations/", import.meta.url);
  for (const file of readdirSync(migrationDir).filter(file => file.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(new URL(file, migrationDir), "utf8"));
  }
  for (const id of Object.values(actors)) await db.query("insert into auth.users(id) values($1)", [id]);
  for (const [key, role] of [["admin", "admin"], ["coach", "coach"], ["player", "player"], ["inactiveAdmin", "admin"], ["secondAdmin", "admin"]] as const) {
    await db.query("insert into public.app_accounts(user_id,is_active) values($1,$2)", [actors[key], key !== "inactiveAdmin"]);
    await db.query("insert into public.account_roles(user_id,role) values($1,$2)", [actors[key], role]);
  }
  await db.query("insert into public.app_accounts(user_id,is_active) values($1,true)", [actors.noRoles]);
});
afterAll(async () => { await db.close(); });

describe("invited account provisioning authorization", () => {
  it("denies anonymous execution at the public function grant", async () => {
    const target = await freshUser();
    await asUser(null, () => expect(provision(target, "coach")).rejects.toMatchObject({ code: "42501" }));
    expect(await accountState(target)).toEqual(emptyAccount);
  });
  it.each(["coach", "player", "inactiveAdmin", "unconfigured", "noRoles"] as const)("rejects %s as an administrator even with a valid Auth subject", async actor => {
    const target = await freshUser();
    await asUser(actors[actor], () => expect(provision(target, "coach")).rejects.toMatchObject({ code: "42501" }));
    expect(await accountState(target)).toEqual(emptyAccount);
  });
  it("rechecks a formerly active administrator using the same subject after revocation", async () => {
    const target = await freshUser();
    await asUser(actors.admin, () => configure(actors.secondAdmin, false, ["admin"]));
    try {
      await asUser(actors.secondAdmin, () => expect(provision(target, "coach")).rejects.toMatchObject({ code: "42501" }));
      expect(await accountState(target)).toEqual(emptyAccount);
    } finally { await asUser(actors.admin, () => configure(actors.secondAdmin, true, ["admin"])); }
  });
});

describe("narrow invitation role and link contract", () => {
  it("provisions exactly one active coach role with no link and one audit event", async () => {
    const target = await freshUser();
    const authBefore = (await db.query("select id from auth.users order by id")).rows;
    await asUser(actors.admin, () => provision(target, "coach"));
    const saved = await accountState(target);
    expect(saved.account).toMatchObject([{ user_id: target, is_active: true }]);
    expect(saved.roles).toEqual([{ user_id: target, role: "coach" }]);
    expect(saved.links).toEqual([]);
    expect(saved.audit).toMatchObject([{ actor_id: actors.admin, event_type: "account_configured", target_id: target,
      details: { before: null, after: { active: true, roles: ["coach"], athlete_id: null } } }]);
    expect((await db.query("select id from auth.users order by id")).rows).toEqual(authBefore);
  });
  it("provisions an active player with exactly the administrator-selected athlete", async () => {
    const target = await freshUser(); const athlete = await freshAthlete(); const other = await freshAthlete();
    await asUser(actors.admin, () => provision(target, "player", athlete));
    const saved = await accountState(target);
    expect(saved.roles).toEqual([{ user_id: target, role: "player" }]);
    expect(saved.links).toMatchObject([{ user_id: target, athlete_id: athlete, linked_by: actors.admin }]);
    await asUser(target, async () => {
      expect((await db.query("select id from public.athletes")).rows).toEqual([{ id: athlete }]);
      expect((await db.query("select id from public.athletes where id=$1", [other])).rows).toEqual([]);
    });
  });
  it.each([null, "admin", "coach,player", "", "Coach", "player "])("rejects unsupported single role %s", async role => {
    const target = await freshUser();
    await asUser(actors.admin, () => expect(provision(target, role)).rejects.toMatchObject({ code: "22023" }));
    expect(await accountState(target)).toEqual(emptyAccount);
  });
  it("requires a player link and forbids any coach link before saving", async () => {
    const target = await freshUser(); const athlete = await freshAthlete();
    await asUser(actors.admin, async () => {
      await expect(provision(target, "player")).rejects.toMatchObject({ code: "22023" });
      await expect(provision(target, "coach", athlete)).rejects.toMatchObject({ code: "22023" });
    });
    expect(await accountState(target)).toEqual(emptyAccount);
  });
  it("requires an existing Auth user and an existing, available athlete", async () => {
    const target = await freshUser(); const athlete = await freshAthlete(); const owner = await freshUser();
    const nonexistent = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    await asUser(actors.admin, async () => {
      await expect(provision(null, "coach")).rejects.toMatchObject({ code: "22023" });
      await expect(provision(nonexistent, "coach")).rejects.toThrow("existing Auth user ID");
      await expect(provision(target, "player", nonexistent)).rejects.toThrow("Athlete does not exist");
      await configure(owner, true, ["player"], athlete);
      await expect(provision(target, "player", athlete)).rejects.toThrow("already linked");
    });
    expect(await accountState(target)).toEqual(emptyAccount);
    expect(await accountState(nonexistent)).toEqual(emptyAccount);
    expect((await accountState(owner)).links).toMatchObject([{ user_id: owner, athlete_id: athlete }]);
  });
});

describe("preservation and transactional guard behavior", () => {
  it.each([true, false])("never overwrites an existing account with active=%s, its roles, link or audit", async active => {
    const target = await freshUser(); const athlete = await freshAthlete();
    await asUser(actors.admin, () => configure(target, active, ["coach", "player"], athlete));
    const before = await accountState(target);
    await asUser(actors.admin, () => expect(provision(target, "coach")).rejects.toMatchObject({ code: "23505" }));
    expect(await accountState(target)).toEqual(before);
  });
  it("also preserves an existing role-free account instead of treating it as new", async () => {
    const before = await accountState(actors.noRoles);
    await asUser(actors.admin, () => expect(provision(actors.noRoles, "coach")).rejects.toMatchObject({ code: "23505" }));
    expect(await accountState(actors.noRoles)).toEqual(before);
  });
  it("another administrator's retry cannot replace a just-provisioned account", async () => {
    const target = await freshUser(); const athlete = await freshAthlete();
    await asUser(actors.admin, () => provision(target, "coach"));
    const before = await accountState(target);
    await asUser(actors.secondAdmin, () => expect(provision(target, "player", athlete)).rejects.toMatchObject({ code: "23505" }));
    expect(await accountState(target)).toEqual(before);
  });
  it("rolls back account, role and link if audit insertion fails", async () => {
    const target = await freshUser(); const athlete = await freshAthlete();
    // This UUID is generated by the fictional fixture helper, never external input.
    await db.exec(`alter table public.audit_events add constraint fictional_invite_audit_failure check (target_id <> '${target}'::uuid)`);
    try {
      await asUser(actors.admin, () => expect(provision(target, "player", athlete)).rejects.toThrow("fictional_invite_audit_failure"));
      expect(await accountState(target)).toEqual(emptyAccount);
    } finally { await db.exec("alter table public.audit_events drop constraint fictional_invite_audit_failure"); }
  });
  it("pins definer search paths and limits execution grants without granting table writes", async () => {
    const catalog = (await db.query<{ name: string; definer: boolean; settings: string[] }>(`
      select n.nspname || '.' || p.proname as name,p.prosecdef as definer,p.proconfig as settings
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where p.oid in ('private.provision_invited_account(uuid,text,uuid)'::regprocedure,
        'public.admin_provision_invited_account(uuid,text,uuid)'::regprocedure)
      order by name
    `)).rows;
    expect(catalog).toEqual([
      { name: "private.provision_invited_account", definer: true, settings: ['search_path=""'] },
      { name: "public.admin_provision_invited_account", definer: false, settings: ['search_path=""'] },
    ]);
    for (const name of ["private.provision_invited_account(uuid,text,uuid)", "public.admin_provision_invited_account(uuid,text,uuid)"]) {
      expect((await db.query<{ anon: boolean; authenticated: boolean }>("select has_function_privilege('anon',$1,'EXECUTE') as anon,has_function_privilege('authenticated',$1,'EXECUTE') as authenticated", [name])).rows).toEqual([{ anon: false, authenticated: true }]);
    }
    expect((await db.query<{ allowed: boolean }>("select has_table_privilege('authenticated','public.app_accounts','INSERT,UPDATE,DELETE') as allowed")).rows).toEqual([{ allowed: false }]);
  });
  it("places the shared lock before live authorization and absence checks, then delegates to the audited writer", async () => {
    // PGlite uses one connection: this verifies race-prevention structure, not
    // a claim of real concurrent Supabase transaction integration coverage.
    const source = (await db.query<{ body: string }>("select prosrc as body from pg_proc where oid='private.provision_invited_account(uuid,text,uuid)'::regprocedure")).rows[0].body;
    const lock = source.indexOf("perform pg_catalog.pg_advisory_xact_lock(72104001)");
    const auth = source.indexOf("if not private.has_role('admin')");
    const absence = source.indexOf("if exists(select 1 from public.app_accounts");
    const save = source.indexOf("perform private.configure_account(");
    expect(lock).toBeGreaterThanOrEqual(0);
    expect(auth).toBeGreaterThan(lock);
    expect(absence).toBeGreaterThan(auth);
    expect(save).toBeGreaterThan(absence);
    const configuredSource = (await db.query<{ body: string }>("select prosrc as body from pg_proc where oid='private.configure_account(uuid,boolean,text[],uuid)'::regprocedure")).rows[0].body;
    expect(configuredSource).toContain("perform pg_catalog.pg_advisory_xact_lock(72104001)");
  });
});
