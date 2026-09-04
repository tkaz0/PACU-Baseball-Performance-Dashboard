import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { parseRosterCsv, type RosterInput } from "@/lib/roster/csv";
import type { ImportPreview } from "@/lib/types";

// Actual PostgreSQL RLS, grants, constraints and PL/pgSQL run in isolated PGlite.
// Only Supabase's external Auth schema/uid() contract is emulated. No network/hosted data.
const db = new PGlite();
const ids = {
  admin: "11111111-1111-4111-8111-111111111111",
  coach: "22222222-2222-4222-8222-222222222222",
  playerA: "33333333-3333-4333-8333-333333333333",
  playerB: "44444444-4444-4444-8444-444444444444",
  unlinked: "55555555-5555-4555-8555-555555555555",
  disabled: "66666666-6666-4666-8666-666666666666",
  otherAdmin: "77777777-7777-4777-8777-777777777777",
  unconfigured: "88888888-8888-4888-8888-888888888888",
};
const rows = parseRosterCsv(readFileSync(new URL("../fixtures/synthetic-roster.csv",import.meta.url),"utf8"));
let athleteA: string, athleteB: string;
async function asUser<T>(id: string | null, operation: () => Promise<T>) {
  await db.exec(`set role ${id ? "authenticated" : "anon"}`);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)",[id ?? ""]);
  try { return await operation(); } finally { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub', '', false)"); }
}
async function stage(input: unknown = rows, season = "2026") {
  const r = await db.query<{id:string}>("select public.stage_roster_import($1::jsonb,$2,'synthetic-roster.csv',$3) as id",[JSON.stringify(input),season,"a".repeat(64)]);
  return r.rows[0].id;
}
async function apply(id: string) { return db.query("select public.approve_roster_import($1::uuid)",[id]); }
async function preview(id: string) { return (await db.query<{preview:ImportPreview}>("select preview from public.roster_imports where id=$1",[id])).rows[0].preview; }
async function configure(user: string, active: boolean, roles: string[], athlete: string | null = null) {
  return db.query("select public.admin_configure_account($1::uuid,$2::boolean,$3::text[],$4::uuid)",[user,active,roles,athlete]);
}
beforeAll(async () => {
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema public, auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `);
  const migrationDir = new URL("../supabase/migrations/",import.meta.url);
  for (const file of readdirSync(migrationDir).filter(f => f.endsWith(".sql")).sort()) await db.exec(readFileSync(new URL(file,migrationDir),"utf8"));
  for (const id of Object.values(ids)) await db.query("insert into auth.users(id) values($1)",[id]);
  await db.query("insert into public.app_accounts(user_id,is_active) values($1,true)",[ids.admin]);
  await db.query("insert into public.account_roles(user_id,role) values($1,'admin')",[ids.admin]);
  await asUser(ids.admin,async () => {
    await apply(await stage());
    const athletes = await db.query<{id:string;athlete_code:string}>("select id,athlete_code from public.athletes order by athlete_code");
    athleteA = athletes.rows[0].id; athleteB = athletes.rows[1].id;
    await configure(ids.playerA,true,["player"],athleteA);
    await configure(ids.playerB,true,["player"],athleteB);
    await configure(ids.coach,true,["coach"]);
    await configure(ids.unlinked,true,["player"]);
    await configure(ids.disabled,false,["player"]);
    await configure(ids.otherAdmin,true,["admin","player"]);
  });
});
afterAll(async () => { await db.close(); });

describe("database authorization with separate identities", () => {
  it("denies anonymous reads and import/admin RPCs", async () => {
    await asUser(null,async () => {
      await expect(db.query("select * from public.athletes")).rejects.toThrow("permission denied");
      await expect(stage()).rejects.toThrow("permission denied");
      await expect(configure(ids.playerA,true,["admin"])).rejects.toThrow("permission denied");
    });
  });
  it("Player A reads only A through direct queries and season joins; cannot retrieve B", async () => {
    await asUser(ids.playerA,async () => {
      expect((await db.query<{id:string}>("select id from public.athletes")).rows).toEqual([{id:athleteA}]);
      expect((await db.query("select * from public.athletes where id=$1",[athleteB])).rows).toHaveLength(0);
      expect((await db.query("select * from public.athlete_seasons where athlete_id=$1",[athleteB])).rows).toHaveLength(0);
      expect((await db.query("select a.id,s.season from public.athletes a join public.athlete_seasons s on s.athlete_id=a.id")).rows).toHaveLength(1);
    });
  });
  it("Player B independently reads only B", async () => {
    await asUser(ids.playerB, async () => expect((await db.query<{id:string}>("select id from public.athletes")).rows).toEqual([{id:athleteB}]));
  });
  it("rejects a player's self-role, link, status and roster mutations, including direct RPCs", async () => {
    await asUser(ids.playerA,async () => {
      for (const sql of ["insert into public.account_roles(user_id,role) values(auth.uid(),'admin')", "update public.account_roles set role='admin'", "update public.app_accounts set is_active=true", "update public.account_athletes set athlete_id='"+athleteB+"'", "update public.athletes set first_name='Tampered'", "delete from public.athletes", "insert into public.athletes(athlete_code,first_name,last_name) values('BAD-001','Bad','Write')", "update public.athlete_seasons set jersey_number=99"]) await expect(db.exec(sql)).rejects.toThrow("permission denied");
      await expect(configure(ids.playerA,true,["admin"])).rejects.toThrow("administrator required");
      await expect(stage()).rejects.toThrow("administrator required");
      await expect(apply("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")).rejects.toThrow("administrator required");
      await expect(db.query("select private.plan_roster($1::jsonb,'2026')",[JSON.stringify(rows)])).rejects.toThrow("permission denied");
    });
  });
  it("unlinked, unconfigured and disabled identities have no data access", async () => {
    for (const id of [ids.unlinked,ids.unconfigured,ids.disabled]) await asUser(id,async () => {
      expect((await db.query("select * from public.athletes")).rows).toHaveLength(0);
      expect((await db.query("select * from public.athlete_seasons")).rows).toHaveLength(0);
    });
  });
  it("denies a previously active player immediately using the same JWT subject after disabling", async () => {
    await asUser(ids.admin, () => configure(ids.playerA,false,["player"],athleteA));
    await asUser(ids.playerA,async () => {
      expect((await db.query("select * from public.athletes")).rows).toHaveLength(0);
      expect((await db.query("select * from public.account_roles")).rows).toHaveLength(0);
      expect((await db.query("select * from public.account_athletes")).rows).toHaveLength(0);
    });
    await asUser(ids.admin, () => configure(ids.playerA,true,["player"],athleteA));
  });
  it("Coach reads the roster but cannot import or manage access", async () => {
    await asUser(ids.coach,async () => {
      expect((await db.query("select id from public.athletes")).rows).toHaveLength(10);
      expect((await db.query("select * from public.roster_imports")).rows).toHaveLength(0);
      await expect(stage()).rejects.toThrow("administrator required");
      await expect(configure(ids.playerA,true,["coach"])).rejects.toThrow("administrator required");
    });
  });
  it("supports Admin + Player and restricts self-modification and duplicate account links", async () => {
    await asUser(ids.otherAdmin,async () => {
      expect((await db.query("select id from public.athletes")).rows).toHaveLength(10);
      await expect(configure(ids.otherAdmin,false,["player"])).rejects.toThrow("own access");
      await expect(configure(ids.unlinked,true,["player"],athleteA)).rejects.toThrow("already linked");
    });
  });
  it("disabled administrators cannot read imports/audit or call mutations with the old subject", async () => {
    await asUser(ids.admin, () => configure(ids.otherAdmin,false,["admin","player"]));
    await asUser(ids.otherAdmin,async () => {
      for (const table of ["athletes","athlete_seasons","roster_imports","audit_events","app_accounts"]) expect((await db.query(`select * from public.${table}`)).rows).toHaveLength(0);
      await expect(stage()).rejects.toThrow("administrator required");
      await expect(configure(ids.admin,false,["player"])).rejects.toThrow("administrator required");
    });
    await asUser(ids.admin, () => configure(ids.otherAdmin,true,["admin","player"]));
  });
});

describe("transactional roster imports", () => {
  it("creates exactly 10 unique identities and preserves jersey 0 / null", async () => {
    expect((await db.query("select * from public.athletes")).rows).toHaveLength(10);
    const result = await db.query<{jersey_number:number|null}>("select jersey_number from public.athlete_seasons where athlete_id=$1",[athleteA]);
    expect(result.rows[0].jersey_number).toBe(0);
    expect((await db.query("select * from public.athlete_seasons where jersey_number is null")).rows).toHaveLength(1);
  });
  it("repeat file is unchanged, repeat approval is idempotent, and audit is recorded", async () => {
    await asUser(ids.admin, async () => {
      const id = await stage();
      expect(await preview(id)).toMatchObject({create:0,update:0,unchanged:10,reject:0});
      await apply(id); await apply(id);
      expect((await db.query("select * from public.audit_events where import_id=$1 and event_type='roster_applied'",[id])).rows).toHaveLength(1);
      expect((await db.query("select * from public.athletes")).rows).toHaveLength(10);
    });
  });
  it("flags every duplicate code and conflicting email row; rejects entire batch", async () => {
    await asUser(ids.admin,async () => {
      for (const input of [[rows[0],rows[0]],[{...rows[0],athlete_code:"NEW-001"},rows[1]],[{...rows[0],pacific_email:"shared@example.com"},{...rows[1],pacific_email:"shared@example.com"}]]) {
        const id = await stage(input);
        expect((await preview(id)).reject).toBeGreaterThan(0);
        await expect(apply(id)).rejects.toThrow("rejected rows");
        expect((await db.query("select status from public.roster_imports where id=$1",[id])).rows).toEqual([{status:"draft"}]);
      }
      expect((await db.query("select * from public.athletes")).rows).toHaveLength(10);
    });
  });
  it("rejects invalid enums, numbers, names, URLs, email values, and unknown fields via direct RPC", async () => {
    const bad: Record<string,unknown>[] = [{jersey_number:"100"},{jersey_number:"-1"},{jersey_number:"0.5"},{eligibility_year:"0"},{graduation_year:"1800"},{primary_position:"quarterback"},{player_type:"catcher"},{bats:"X"},{throws:"X"},{academic_class:"unknown"},{roster_status:"deleted"},{pacific_email:"wrong"},{profile_photo_url:"javascript:alert(1)"},{profile_photo_url:"https://?"},{first_name:""},{first_name:"\t"},{roles:["admin"]},{jersey_number:0}];
    await asUser(ids.admin,async () => {
      for (const invalid of bad) {
        const id = await stage([{...rows[0],...invalid}]);
        expect((await preview(id)).reject, JSON.stringify(invalid)).toBe(1);
      }
      await expect(stage(rows,"bad season")).rejects.toThrow("Season");
      await expect(stage({rows})).rejects.toThrow("array");
      expect((await preview(await stage([null]))).reject).toBe(1);
    });
  });
  it("blank cells do not clear populated fields, zero survives, and omitted athletes remain", async () => {
    const blank = {...rows[0],preferred_name:"",pacific_email:"",jersey_number:"",primary_position:""};
    await asUser(ids.admin,async () => {
      const id = await stage([blank]); expect((await preview(id)).unchanged).toBe(1); await apply(id);
      expect((await db.query("select preferred_name,pacific_email from public.athletes where id=$1",[athleteA])).rows[0]).toEqual({preferred_name:"Avery",pacific_email:"synthetic.avery@example.com"});
      expect((await db.query("select jersey_number from public.athlete_seasons where athlete_id=$1",[athleteA])).rows[0]).toEqual({jersey_number:0});
      expect((await db.query("select * from public.athletes")).rows).toHaveLength(10);
    });
  });
  it("matches only permanent code, preserves ID and account link after name/jersey/email changes", async () => {
    await asUser(ids.admin,async () => {
      const changed = {...rows[0],preferred_name:"Synthetic Update",jersey_number:"9",pacific_email:"updated.synthetic@example.com"};
      const id = await stage([changed]); expect((await preview(id)).update).toBe(1); await apply(id);
      expect((await db.query("select id from public.athletes where athlete_code='SYN-001'")).rows).toEqual([{id:athleteA}]);
      expect((await db.query("select athlete_id from public.account_athletes where user_id=$1",[ids.playerA])).rows).toEqual([{athlete_id:athleteA}]);
      expect((await db.query("select * from public.app_accounts")).rows).toHaveLength(7);
      await apply(await stage([rows[0]]));
    });
  });
  it("adds a season without duplicating permanent identity", async () => {
    await asUser(ids.admin,async () => {
      const id = await stage([rows[0]],"2027"); expect((await preview(id)).update).toBe(1); await apply(id);
      expect((await db.query("select * from public.athletes")).rows).toHaveLength(10);
      expect((await db.query("select * from public.athlete_seasons where athlete_id=$1",[athleteA])).rows).toHaveLength(2);
    });
  });
  it("rejects stale and expired previews and approval by another administrator", async () => {
    let stale = "";
    await asUser(ids.admin,async () => {
      stale = await stage([{...rows[0],jersey_number:"8"}]);
      await apply(await stage([{...rows[0],jersey_number:"7"}]));
      await expect(apply(stale)).rejects.toThrow("Roster changed");
      await apply(await stage([rows[0]]));
    });
    await asUser(ids.otherAdmin,async () => { await expect(apply(stale)).rejects.toThrow("uploading administrator"); });
    await db.query("update public.roster_imports set created_at=now()-interval '2 days' where id=$1",[stale]);
    await asUser(ids.admin,async () => { await expect(apply(stale)).rejects.toThrow("expired"); });
  });
  it("rolls back all writes and audit when a later row fails during approval", async () => {
    const input: RosterInput[] = [rows[0],rows[1]].map((r,i)=>({...r,athlete_code:`ROLL-${i+1}`,pacific_email:`roll-${i+1}@example.com`}));
    const id = await asUser(ids.admin, () => stage(input));
    await db.exec("alter table public.athletes add constraint simulate_later_failure check (athlete_code <> 'ROLL-2')");
    await asUser(ids.admin,async () => { await expect(apply(id)).rejects.toThrow("simulate_later_failure"); });
    expect((await db.query("select * from public.athletes where athlete_code like 'ROLL-%'")).rows).toHaveLength(0);
    expect((await db.query("select * from public.audit_events where import_id=$1 and event_type <> 'roster_previewed'",[id])).rows).toHaveLength(0);
    expect((await db.query("select status from public.roster_imports where id=$1",[id])).rows).toEqual([{status:"draft"}]);
    await db.exec("alter table public.athletes drop constraint simulate_later_failure");
  });
});
