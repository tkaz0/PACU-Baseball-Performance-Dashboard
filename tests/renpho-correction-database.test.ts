import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const db = new PGlite();
const admin = "11111111-1111-4111-8111-111111111111", coach = "22222222-2222-4222-8222-222222222222", player = "33333333-3333-4333-8333-333333333333";
const first = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", second = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const requestId = "44444444-4444-4444-8444-444444444444", hashA = "a".repeat(64), hashB = "b".repeat(64);
const page = "RENPHO report · Page 1";
function request(ids = true) { return { requestId, reports: [
  { fileHash: hashA, fromAthleteCode: "SYN-001", toAthleteCode: "SYN-002", renphoId: ids ? "FICTIONAL-001" : null },
  { fileHash: hashB, fromAthleteCode: "SYN-002", toAthleteCode: "SYN-001", renphoId: ids ? "FICTIONAL-002" : null },
] }; }
function measurement(hash: string, code: string, changes: Record<string, unknown> = {}) {
  return { observation_id: `observation:${JSON.stringify([hash, page, 2, 0])}`, athlete_code: code, metric_key: "weight", measured_at: "2026-09-12", value: 160, unit: "lb", source: "RENPHO", source_file: "fictional-report.png", source_sheet: page, source_row: 2, file_hash: hash, ...changes };
}
async function asUser<T>(id: string | null, run: () => Promise<T>): Promise<T> {
  await db.exec(`set role ${id ? "authenticated" : "anon"}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id ?? ""]);
  try { return await run(); } finally { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub','',false)"); }
}
async function preview(input: unknown = request()) {
  return (await db.query<{ data: { fingerprint: string; reports: Record<string, unknown>[] } }>("select public.admin_preview_renpho_report_swap($1::jsonb) data", [JSON.stringify(input)])).rows[0].data;
}
async function apply(fingerprint: string, input: unknown = request(), reviewed: unknown = true) {
  return (await db.query<{ data: { requestId: string; measurementsMoved: number; aliasesMoved: number } }>("select public.admin_apply_renpho_report_swap($1::jsonb,$2,$3::boolean) data", [JSON.stringify(input), fingerprint, reviewed])).rows[0].data;
}
async function snapshot() {
  return {
    measurements: (await db.query<Record<string, unknown>>("select * from public.performance_measurements order by file_hash,observation_id")).rows,
    aliases: (await db.query<Record<string, unknown>>("select * from private.renpho_identity_aliases order by renpho_id")).rows,
    accounts: (await db.query("select * from public.app_accounts order by user_id")).rows,
    links: (await db.query("select * from public.account_athletes order by user_id")).rows,
    corrections: (await db.query("select * from private.renpho_report_corrections")).rows,
  };
}
beforeAll(async () => {
  await db.exec("create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;");
  const directory = new URL("../supabase/migrations/", import.meta.url);
  for (const file of readdirSync(directory).filter(name => name.endsWith(".sql")).sort()) await db.exec(readFileSync(new URL(file, directory), "utf8"));
  for (const [id, role] of [[admin, "admin"], [coach, "coach"], [player, "player"]]) {
    await db.query("insert into auth.users(id) values($1)", [id]);
    await db.query("insert into public.app_accounts(user_id,is_active) values($1,true)", [id]);
    await db.query("insert into public.account_roles(user_id,role) values($1,$2)", [id, role]);
  }
  await db.query("insert into public.athletes(id,athlete_code,first_name,last_name) values($1,'SYN-001','Fictional','One'),($2,'SYN-002','Fictional','Two')", [first, second]);
  await db.query("insert into public.account_athletes(user_id,athlete_id) values($1,$2)", [player, first]);
});
beforeEach(async () => {
  await db.exec("delete from private.renpho_report_corrections;delete from private.renpho_identity_aliases;delete from public.performance_measurements;delete from public.performance_imports;delete from public.audit_events;update public.app_accounts set is_active=true;");
  await asUser(admin, async () => {
    await db.query("select public.admin_upsert_renpho_ids($1::jsonb,true)", [JSON.stringify([
      { athlete_code: "SYN-001", renpho_id: "FICTIONAL-001" }, { athlete_code: "SYN-002", renpho_id: "FICTIONAL-002" }, { athlete_code: "SYN-001", renpho_id: "FICTIONAL-HISTORICAL" },
    ])]);
    await db.query("select public.admin_import_performance($1::jsonb)", [JSON.stringify([
      measurement(hashA, "SYN-001"), measurement(hashB, "SYN-002", { value: 180 }),
      measurement("c".repeat(64), "SYN-001", { value: 170 }),
    ])]);
  });
});
afterAll(async () => { await db.close(); });

function reassignment(ids: string[] = ["FICTIONAL-001", "FICTIONAL-HISTORICAL"]) {
  return { requestId, report: { fileHash: hashA, fromAthleteCode: "SYN-001", toAthleteCode: "SYN-002", renphoIds: ids } };
}
async function reassignmentPreview(input: unknown = reassignment()) {
  return (await db.query<{ data: { fingerprint: string; report: Record<string, unknown> } }>("select public.admin_preview_renpho_report_reassignment($1::jsonb) data", [JSON.stringify(input)])).rows[0].data;
}
async function reassign(fingerprint: string, input: unknown = reassignment(), reviewed: unknown = true) {
  return (await db.query<{ data: { requestId: string; measurementsMoved: number; aliasesMoved: number } }>("select public.admin_apply_renpho_report_reassignment($1::jsonb,$2,$3::boolean) data", [JSON.stringify(input), fingerprint, reviewed])).rows[0].data;
}

describe("reviewed single-report reassignment", () => {
  it("moves exactly one report and two explicitly reviewed aliases without changing identities, values or other reports", async () => {
    await asUser(admin, () => db.query("select public.admin_upsert_renpho_ids($1::jsonb,true)", [JSON.stringify([{ athlete_code: "SYN-001", renpho_id: "FICTIONAL-UNSELECTED" }])]));
    const before = await snapshot(); const review = await asUser(admin, () => reassignmentPreview());
    expect(review.report).toEqual({ ...reassignment().report, measurementCount: 1, measuredAt: "2026-09-12", sourceFile: "fictional-report.png" });
    expect(await snapshot()).toEqual(before);
    expect(await asUser(admin, () => reassign(review.fingerprint))).toEqual({ requestId, measurementsMoved: 1, aliasesMoved: 2 });
    const after = await snapshot();
    expect(after.measurements).toEqual(before.measurements.map(row => ({ ...row, athlete_id: row.file_hash === hashA ? second : row.athlete_id })));
    expect(after.aliases).toEqual(before.aliases.map(row => ({ ...row, athlete_id: ["FICTIONAL-001", "FICTIONAL-HISTORICAL"].includes(row.renpho_id as string) ? second : row.athlete_id })));
    expect(after.accounts).toEqual(before.accounts); expect(after.links).toEqual(before.links);
    expect((await db.query<{ details: unknown }>("select details from public.audit_events where event_type='renpho_report_reassigned'")).rows).toEqual([{ details: { reports: 1, measurementsMoved: 1, aliasesMoved: 2 } }]);
  });
  it("allows no alias changes and retries without moving the report again", async () => {
    const input = reassignment([]), before = await snapshot(); const review = await asUser(admin, () => reassignmentPreview(input));
    const receipt = await asUser(admin, () => reassign(review.fingerprint, input)); expect(receipt.aliasesMoved).toBe(0);
    const after = await snapshot(); expect(after.aliases).toEqual(before.aliases);
    expect(await asUser(admin, () => reassign(review.fingerprint, input))).toEqual(receipt); expect(await snapshot()).toEqual(after);
    await asUser(admin, async () => { await expect(reassignmentPreview(input)).rejects.toThrow("already submitted"); await expect(reassign("f".repeat(64), input)).rejects.toThrow("different review"); await expect(apply(review.fingerprint)).rejects.toThrow("different review"); });
  });
  it("rejects anonymous, nonadmin, inactive accounts and unreviewed saves", async () => {
    const review = await asUser(admin, () => reassignmentPreview());
    for (const actor of [null, coach, player]) await asUser(actor, async () => { await expect(reassignmentPreview()).rejects.toThrow(); await expect(reassign(review.fingerprint)).rejects.toThrow(); });
    await db.query("update public.app_accounts set is_active=false where user_id=$1", [admin]);
    await asUser(admin, async () => { await expect(reassignmentPreview()).rejects.toThrow("Active administrator"); await expect(reassign(review.fingerprint)).rejects.toThrow("Active administrator"); });
    await db.query("update public.app_accounts set is_active=true where user_id=$1", [admin]);
    await asUser(admin, async () => { await expect(reassign(review.fingerprint, reassignment(), false)).rejects.toThrow("Review"); });
    expect((await snapshot()).corrections).toHaveLength(0);
  });
  it("rejects invalid, duplicate or unowned alias selections and malformed inputs", async () => {
    const invalid = [null, {}, { ...reassignment(), extra: true }, { ...reassignment(), requestId: "invalid" },
      { ...reassignment(), report: { ...reassignment().report, toAthleteCode: "SYN-001" } },
      { ...reassignment(), report: { ...reassignment().report, toAthleteCode: "SYN-999" } },
      { ...reassignment(), report: { ...reassignment().report, image: "Fictional image" } },
      reassignment(["FICTIONAL-001", "fictional-001"]), reassignment(["FICTIONAL-002"]), reassignment(["UNKNOWN"]), reassignment(["A", "B", "C"]), reassignment([""]),
    ];
    const before = await snapshot();
    await asUser(admin, async () => { for (const value of invalid) { await expect(reassignmentPreview(value)).rejects.toThrow(); await expect(reassign("f".repeat(64), value)).rejects.toThrow(); } });
    expect(await snapshot()).toEqual(before);
  });
  it("rejects changed observations and alias ownership since review", async () => {
    const review = await asUser(admin, () => reassignmentPreview());
    await db.query("update public.performance_measurements set value=value+1 where file_hash=$1", [hashA]);
    const changed = await snapshot();
    await asUser(admin, async () => { await expect(reassign(review.fingerprint)).rejects.toThrow("changed since review"); });
    expect(await snapshot()).toEqual(changed);
    const secondReview = await asUser(admin, () => reassignmentPreview());
    await db.query("update private.renpho_identity_aliases set athlete_id=$1 where renpho_id='FICTIONAL-001'", [second]);
    await asUser(admin, async () => { await expect(reassign(secondReview.fingerprint)).rejects.toThrow("report ID"); });
    expect((await snapshot()).corrections).toHaveLength(0);
  });
  it("requires whole canonical report ownership and one date", async () => {
    await db.query("update public.performance_measurements set source='Fictional other' where file_hash=$1", [hashA]);
    await asUser(admin, async () => { await expect(reassignmentPreview()).rejects.toThrow("ownership or source"); });
    await db.query("update public.performance_measurements set source='RENPHO' where file_hash=$1", [hashA]);
    await asUser(admin, () => db.query("select public.admin_import_performance($1::jsonb)", [JSON.stringify([measurement(hashA, "SYN-001", { observation_id: `observation:${JSON.stringify([hashA, page, 3, 1])}`, source_row: 3, measured_at: "2026-09-13", metric_key: "body_fat_pct", value: 15, unit: "%" })])]));
    await asUser(admin, async () => { await expect(reassignmentPreview()).rejects.toThrow("one test date"); });
  });
  it("rolls back observations, aliases and private receipt on audit failure", async () => {
    const review = await asUser(admin, () => reassignmentPreview()); const before = await snapshot();
    await db.exec("create function public.fictional_fail_reassignment_audit() returns trigger language plpgsql as $$begin raise exception 'Fictional audit failure';end$$;create trigger fictional_reassignment_audit before insert on public.audit_events for each row execute function public.fictional_fail_reassignment_audit();");
    try { await asUser(admin, async () => { await expect(reassign(review.fingerprint)).rejects.toThrow("Fictional audit failure"); }); }
    finally { await db.exec("drop trigger fictional_reassignment_audit on public.audit_events;drop function public.fictional_fail_reassignment_audit()" ); }
    expect(await snapshot()).toEqual(before);
  });
  it("supports corrected-owner original report retries and missing height backfill", async () => {
    const review = await asUser(admin, () => reassignmentPreview()); await asUser(admin, () => reassign(review.fingerprint));
    const before = await snapshot();
    const rows = [measurement(hashA, "SYN-002"), measurement(hashA, "SYN-002", { observation_id: `observation:${JSON.stringify([hashA, page, 3001, 21])}`, source_row: 3001, metric_key: "height", value: 72, unit: "in" })];
    const save = () => db.query<{ data: { created: number; unchanged: number } }>("select public.staff_import_renpho('FICTIONAL-001','SYN-002',$1::jsonb) data", [JSON.stringify(rows)]);
    expect((await asUser(coach, save)).rows[0].data).toMatchObject({ created: 1, unchanged: 1 });
    expect((await asUser(coach, save)).rows[0].data).toMatchObject({ created: 0, unchanged: 2 });
    expect((await snapshot()).measurements.filter(row => row.metric_key !== "height")).toEqual(before.measurements);
  });
  it("keeps helpers private, search paths pinned and shared locks ordered", async () => {
    for (const signature of ["private.preview_renpho_report_reassignment(jsonb)", "private.apply_renpho_report_reassignment(jsonb,text,boolean)"]) {
      const entry = (await db.query<{ definition: string; prosecdef: boolean; proconfig: string[]; anonymous: boolean }>("select pg_get_functiondef(oid) definition,prosecdef,proconfig,has_function_privilege('anon',oid,'EXECUTE') anonymous from pg_catalog.pg_proc where oid=$1::regprocedure", [signature])).rows[0];
      expect(entry.prosecdef).toBe(true); expect(entry.proconfig).toContain('search_path=""'); expect(entry.anonymous).toBe(false);
      expect(entry.definition.indexOf("pg_advisory_xact_lock(72104001)")).toBeLessThan(entry.definition.indexOf("pg_advisory_xact_lock(72104002)"));
      expect(entry.definition.indexOf("pg_advisory_xact_lock(72104002)")).toBeLessThan(entry.definition.indexOf("private.has_role('admin')"));
    }
    await asUser(admin, async () => {
      await expect(db.query("select private.normalized_renpho_reassignment($1::jsonb)", [JSON.stringify(reassignment())])).rejects.toThrow("permission denied");
      await expect(db.query("select private.renpho_reassignment_snapshot($1::jsonb)", [JSON.stringify(reassignment())])).rejects.toThrow("permission denied");
    });
  });
});

describe("reviewed reciprocal RENPHO corrections", () => {
  it("previews minimal metadata then swaps only ownership with private retry receipt and count-only audit", async () => {
    const before = await snapshot();
    const review = await asUser(admin, () => preview());
    expect(review.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(review.reports).toEqual(request().reports.map(row => ({ ...row, measurementCount: 1, measuredAt: "2026-09-12", sourceFile: "fictional-report.png" })));
    expect(await snapshot()).toEqual(before);
    expect(await asUser(admin, () => apply(review.fingerprint))).toEqual({ requestId, measurementsMoved: 2, aliasesMoved: 2 });
    const after = await snapshot();
    expect(after.measurements).toEqual(before.measurements.map(row => ({ ...row, athlete_id: row.file_hash === hashA ? second : row.file_hash === hashB ? first : row.athlete_id })));
    expect(after.aliases).toEqual(before.aliases.map(row => ({ ...row, athlete_id: row.renpho_id === "FICTIONAL-001" ? second : row.renpho_id === "FICTIONAL-002" ? first : row.athlete_id })));
    expect(after.accounts).toEqual(before.accounts); expect(after.links).toEqual(before.links);
    const audit = (await db.query<{ details: unknown }>("select details from public.audit_events where event_type='renpho_reports_corrected'")).rows;
    expect(audit).toEqual([{ details: { reports: 2, measurementsMoved: 2, aliasesMoved: 2 } }]);
    const publicRows = (await db.query("select to_jsonb(a) data from public.audit_events a union all select to_jsonb(p) data from public.performance_measurements p")).rows;
    expect(JSON.stringify(publicRows)).not.toContain("FICTIONAL-001");
    expect((await asUser(player, () => db.query("select file_hash from public.performance_measurements order by file_hash"))).rows).toEqual([{ file_hash: hashB }, { file_hash: "c".repeat(64) }]);
  });
  it("retries identically without swapping back and refuses request UUID reuse", async () => {
    const review = await asUser(admin, () => preview());
    const firstReceipt = await asUser(admin, () => apply(review.fingerprint));
    const beforeRetry = await snapshot();
    expect(await asUser(admin, () => apply(review.fingerprint))).toEqual(firstReceipt);
    expect(await snapshot()).toEqual(beforeRetry);
    await asUser(admin, async () => {
      await expect(preview()).rejects.toThrow("already submitted");
      await expect(apply("f".repeat(64))).rejects.toThrow("different review");
      await expect(apply(review.fingerprint, request(false))).rejects.toThrow("different review");
    });
    expect((await db.query("select * from public.audit_events where event_type='renpho_reports_corrected'")).rows).toHaveLength(1);
  });
  it("leaves all aliases untouched when null is explicitly selected", async () => {
    const before = await snapshot(); const input = request(false);
    const review = await asUser(admin, () => preview(input));
    expect(await asUser(admin, () => apply(review.fingerprint, input))).toEqual({ requestId, measurementsMoved: 2, aliasesMoved: 0 });
    expect((await snapshot()).aliases).toEqual(before.aliases);
  });
  it("recognizes the corrected owner on original-file retries and adds height without changing earlier observations", async () => {
    const review = await asUser(admin, () => preview()); await asUser(admin, () => apply(review.fingerprint));
    const before = await snapshot();
    const rows = [measurement(hashA, "SYN-002"), measurement(hashA, "SYN-002", {
      observation_id: `observation:${JSON.stringify([hashA, page, 3001, 21])}`,
      source_row: 3001, metric_key: "height", value: 72, unit: "in",
    })];
    const save = () => db.query<{ data: { created: number; unchanged: number } }>("select public.staff_import_renpho('FICTIONAL-001','SYN-002',$1::jsonb) data", [JSON.stringify(rows)]);
    expect((await asUser(coach, save)).rows[0].data).toMatchObject({ created: 1, unchanged: 1 });
    expect((await asUser(coach, save)).rows[0].data).toMatchObject({ created: 0, unchanged: 2 });
    const after = await snapshot();
    expect(after.measurements.filter(row => row.metric_key !== "height")).toEqual(before.measurements);
    expect(after.measurements.filter(row => row.metric_key === "height")).toEqual([expect.objectContaining({ athlete_id: second, file_hash: hashA, source_column: 21, value: 72, unit: "in" })]);
    expect(after.aliases).toEqual(before.aliases); expect(after.links).toEqual(before.links);
    const reread = (await asUser(coach, () => db.query<{ data: { athlete_code: string }[] }>("select public.performance_report_measurements($1) data", [hashA]))).rows[0].data;
    expect(reread).toHaveLength(2); expect(reread.every(row => row.athlete_code === "SYN-002")).toBe(true);
    await asUser(coach, async () => { await expect(db.query("select public.staff_import_renpho('FICTIONAL-001','SYN-001',$1::jsonb)", [JSON.stringify([measurement(hashA, "SYN-001")])])).rejects.toThrow("different player"); });
  });
  it("fails closed for anonymous, Coach, Player, inactive Admin and revoked Admin", async () => {
    const review = await asUser(admin, () => preview());
    const before = await snapshot();
    for (const actor of [null, coach, player]) await asUser(actor, async () => { await expect(preview()).rejects.toThrow(); await expect(apply(review.fingerprint)).rejects.toThrow(); });
    await db.query("update public.app_accounts set is_active=false where user_id=$1", [admin]);
    await asUser(admin, async () => { await expect(preview()).rejects.toThrow("Active administrator"); await expect(apply(review.fingerprint)).rejects.toThrow("Active administrator"); });
    await db.query("update public.app_accounts set is_active=true where user_id=$1", [admin]);
    await db.query("delete from public.account_roles where user_id=$1", [admin]);
    try { await asUser(admin, async () => { await expect(preview()).rejects.toThrow("Active administrator"); await expect(apply(review.fingerprint)).rejects.toThrow("Active administrator"); }); }
    finally { await db.query("insert into public.account_roles(user_id,role) values($1,'admin')", [admin]); }
    expect(await snapshot()).toEqual(before);
  });
  it("requires explicit review and exact valid reciprocal payloads", async () => {
    const review = await asUser(admin, () => preview()); const before = await snapshot();
    const invalid = [null, [], {}, { ...request(), extra: true }, { ...request(), requestId: "bad" }, { ...request(), reports: [] }, { ...request(), reports: [request().reports[0], request().reports[0]] }, { ...request(), reports: request().reports.map(row => ({ ...row, extra: "no" })) }, { ...request(), reports: request().reports.map(row => ({ ...row, renphoId: "" })) }];
    await asUser(admin, async () => {
      for (const input of invalid) { await expect(preview(input)).rejects.toThrow(); await expect(apply(review.fingerprint, input)).rejects.toThrow(); }
      await expect(apply(review.fingerprint, request(), false)).rejects.toThrow("Review");
      await expect(apply("bad")).rejects.toThrow("Review");
    });
    expect(await snapshot()).toEqual(before);
  });
  it("rejects stale review after a changed reading and does not move any report", async () => {
    const review = await asUser(admin, () => preview());
    await db.query("update public.performance_measurements set value=value+1 where file_hash=$1", [hashA]);
    const changed = await snapshot();
    await asUser(admin, async () => { await expect(apply(review.fingerprint)).rejects.toThrow("changed since review"); });
    expect(await snapshot()).toEqual(changed);
  });
  it("rejects stale review after a newly added observation", async () => {
    const review = await asUser(admin, () => preview());
    await asUser(coach, () => db.query("select public.admin_import_performance($1::jsonb)", [JSON.stringify([measurement(hashA, "SYN-001", { observation_id: `observation:${JSON.stringify([hashA, page, 3, 1])}`, source_row: 3, metric_key: "body_fat_pct", value: 15, unit: "%" })])]));
    const changed = await snapshot();
    await asUser(admin, async () => { await expect(apply(review.fingerprint)).rejects.toThrow("changed since review"); });
    expect(await snapshot()).toEqual(changed);
  });
  it("requires each selected report alias to remain with the source player", async () => {
    const review = await asUser(admin, () => preview());
    await db.query("update private.renpho_identity_aliases set athlete_id=$1 where renpho_id='FICTIONAL-001'", [second]);
    const changed = await snapshot();
    await asUser(admin, async () => { await expect(preview()).rejects.toThrow("report ID"); await expect(apply(review.fingerprint)).rejects.toThrow("report ID"); });
    expect(await snapshot()).toEqual(changed);
  });
  it("rejects missing reports, mixed owners, other sources and mixed dates", async () => {
    const input = request(); input.reports[0].fileHash = "f".repeat(64);
    await asUser(admin, async () => { await expect(preview(input)).rejects.toThrow("saved readings"); });
    for (const field of ["athlete_id", "source", "source_sheet"]) {
      const value = field === "athlete_id" ? second : "Fictional other source";
      const old = (await db.query<Record<string, unknown>>(`select ${field} from public.performance_measurements where file_hash=$1`, [hashA])).rows[0][field];
      await db.query(`update public.performance_measurements set ${field}=$1 where file_hash=$2`, [value, hashA]);
      try { await asUser(admin, async () => { await expect(preview()).rejects.toThrow("ownership or source"); }); }
      finally { await db.query(`update public.performance_measurements set ${field}=$1 where file_hash=$2`, [old, hashA]); }
    }
    await asUser(admin, () => db.query("select public.admin_import_performance($1::jsonb)", [JSON.stringify([measurement(hashA, "SYN-001", { observation_id: `observation:${JSON.stringify([hashA, page, 3, 1])}`, source_row: 3, measured_at: "2026-09-13", metric_key: "body_fat_pct", value: 15, unit: "%" })])]));
    await asUser(admin, async () => { await expect(preview()).rejects.toThrow("one test date"); });
    expect((await snapshot()).corrections).toHaveLength(0);
  });
  it("rolls back both reports and aliases if the audit write fails", async () => {
    const review = await asUser(admin, () => preview()); const before = await snapshot();
    await db.exec("create function public.fictional_fail_correction_audit() returns trigger language plpgsql as $$begin raise exception 'Fictional audit failure';end$$;create trigger fictional_correction_audit before insert on public.audit_events for each row execute function public.fictional_fail_correction_audit();");
    try { await asUser(admin, async () => { await expect(apply(review.fingerprint)).rejects.toThrow("Fictional audit failure"); }); }
    finally { await db.exec("drop trigger fictional_correction_audit on public.audit_events;drop function public.fictional_fail_correction_audit()"); }
    expect(await snapshot()).toEqual(before);
  });
  it("keeps private state/helper access closed and existing import conflict protection intact", async () => {
    const review = await asUser(admin, () => preview()); await asUser(admin, () => apply(review.fingerprint));
    for (const actor of [admin, coach, player]) await asUser(actor, async () => {
      await expect(db.query("select * from private.renpho_report_corrections")).rejects.toThrow("permission denied");
      await expect(db.query("delete from private.renpho_report_corrections")).rejects.toThrow("permission denied");
      await expect(db.query("select private.renpho_swap_snapshot($1::jsonb)", [JSON.stringify(request())])).rejects.toThrow("permission denied");
      await expect(db.query("select private.normalized_renpho_swap($1::jsonb)", [JSON.stringify(request())])).rejects.toThrow("permission denied");
    });
    await asUser(coach, async () => { await expect(db.query("select public.admin_import_performance($1::jsonb)", [JSON.stringify([measurement(hashA, "SYN-001")])])).rejects.toThrow("different reviewed data"); });
  });
  it("pins search paths and shares account-before-roster lock order", async () => {
    for (const signature of ["private.preview_renpho_report_swap(jsonb)", "private.apply_renpho_report_swap(jsonb,text,boolean)"]) {
      const entry = (await db.query<{ definition: string; prosecdef: boolean; proconfig: string[]; anonymous: boolean }>("select pg_get_functiondef(oid) definition,prosecdef,proconfig,has_function_privilege('anon',oid,'EXECUTE') anonymous from pg_catalog.pg_proc where oid=$1::regprocedure", [signature])).rows[0];
      expect(entry.prosecdef).toBe(true); expect(entry.proconfig).toContain('search_path=""'); expect(entry.anonymous).toBe(false);
      expect(entry.definition.indexOf("pg_advisory_xact_lock(72104001)")).toBeLessThan(entry.definition.indexOf("pg_advisory_xact_lock(72104002)"));
      expect(entry.definition.indexOf("pg_advisory_xact_lock(72104002)")).toBeLessThan(entry.definition.indexOf("private.has_role('admin')"));
    }
    // One PGlite connection verifies the lock structure and retry behavior, not
    // a concurrent authenticated Supabase deployment.
  });
});
