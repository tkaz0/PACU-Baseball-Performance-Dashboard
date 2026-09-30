import { initializeStorageSchema } from "./fixtures/storage-schema";
import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";

// Every identity and reading in this file is fictional.
const db = new PGlite();
const admin = "11111111-1111-4111-8111-111111111111", coach = "22222222-2222-4222-8222-222222222222", player = "33333333-3333-4333-8333-333333333333";
const hitter = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", pitcher = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const hash = "a".repeat(64), summarySheet = "CSV · Full Swing session summaries v1", pitchSheet = "CSV · Classified pitch summaries v1";
type JsonRow = Record<string, string | number | null>;
type Payload = {
  fileHash: string; fileName: string; date: string; category: string; mode: string; eventCount: number;
  unresolvedPitchCount: number; excludedPlayerCount: number; removedValues: string[]; assignmentVersion: number;
  assignments: { sourceRow: number; pitchType: string }[]; measurements: JsonRow[]; samples: JsonRow[]; contacts: JsonRow[];
};
type Receipt = { requestId: string; fileHash: string; revision: number; created: number; unchanged: number; measurementCount: number; sampleCount: number; contactCount: number; publishedAt: string; restoredFromRevision: number | null; assignmentVersion: number };
function metric(key: string, value: number, unit: string, column: number, classified = false): JsonRow {
  const sheet = classified ? pitchSheet : summarySheet, row = classified ? 2 : key.includes("pitch_velocity") ? 3 : 2;
  return { observation_id: `observation:${JSON.stringify([hash, sheet, row, column])}`, athlete_code: classified || key.includes("pitch_velocity") ? "PAC-0002" : "PAC-0001",
    metric_key: key, measured_at: "2026-09-11", value, unit, source: `Full Swing · Intrasquad${classified ? " · Fastball" : ""}`,
    source_file: "fictional-session.csv", source_sheet: sheet, source_row: row, file_hash: hash };
}
function payload(): Payload {
  const measurements = [metric("max_exit_velocity", 92, "mph", 2), metric("avg_exit_velocity", 88, "mph", 3), metric("max_distance", 240, "ft", 6),
    metric("max_pitch_velocity", 82, "mph", 7), metric("avg_pitch_velocity", 80, "mph", 8),
    ...["classified_max_velocity", "classified_avg_velocity", "classified_max_spin", "classified_avg_spin", "classified_pitch_count", "classified_velocity_count", "classified_spin_count"]
      .map((key, index) => metric(key, [82, 80, 2200, 2100, 2, 2, 2][index], index < 2 ? "mph" : index < 4 ? "rpm" : "count", index, true))];
  return { fileHash: hash, fileName: "fictional-session.csv", date: "2026-09-11", category: "intrasquad", mode: "Live at Bat", eventCount: 2,
    unresolvedPitchCount: 0, excludedPlayerCount: 0, removedValues: [], assignmentVersion: 0,
    assignments: [{ sourceRow: 2, pitchType: "Fastball" }, { sourceRow: 3, pitchType: "Fastball" }], measurements,
    samples: measurements.filter(m => m.source_sheet === summarySheet).map(m => ({ athleteCode: m.athlete_code, fileHash: hash, metricKey: m.metric_key, unit: m.unit, sourceRow: m.source_row, sampleCount: 2, expectedValue: m.value })),
    contacts: [2, 3].map((row, i) => ({ athleteCode: "PAC-0001", fileHash: hash, sourceFile: "fictional-session.csv", sourceRow: row, pitchNumber: row - 1,
      playedOn: "2026-09-11", category: "intrasquad", exitVelocity: [84, 92][i], launchAngle: 20, direction: 10, distance: [190, 240][i] })) };
}
async function as<T>(id: string | null, run: () => Promise<T>): Promise<T> {
  await db.exec(`set role ${id ? "authenticated" : "anon"}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id ?? ""]);
  try { return await run(); } finally { await db.exec("reset role"); }
}
async function publish(p = payload(), expected = 0, replace = false, requestId = randomUUID()) {
  return (await db.query<{ receipt: Receipt }>("select public.staff_publish_full_swing_session($1,$2,$3::jsonb,$4) receipt", [requestId, expected, JSON.stringify(p), replace])).rows[0].receipt;
}
async function restore(expected: number, target: number, requestId = randomUUID()) {
  return (await db.query<{ receipt: Receipt }>("select public.admin_restore_full_swing_session($1,$2,$3,$4) receipt", [requestId, hash, expected, target])).rows[0].receipt;
}
async function counts() {
  return (await db.query<Record<"measurements" | "samples" | "contacts" | "labels" | "publications" | "revisions" | "requests", number>>("select (select count(*)::int from public.performance_measurements) measurements,(select count(*)::int from private.full_swing_session_samples) samples,(select count(*)::int from public.full_swing_contacts) contacts,(select count(*)::int from private.full_swing_pitch_assignments) labels,(select count(*)::int from private.full_swing_publications) publications,(select count(*)::int from private.full_swing_publication_revisions) revisions,(select count(*)::int from private.full_swing_publication_requests) requests")).rows[0];
}
async function projection() { return (await db.query<{ data: Record<string, unknown> }>("select private.full_swing_projection($1) data", [hash])).rows[0].data; }
function corrected(original: Payload): Payload {
  const next = structuredClone(original); next.assignmentVersion = 1; next.removedValues = ["3:ExitSpeed", "3:Distance", "3:SpinRate"];
  const changes: Record<string, number> = { max_exit_velocity: 84, avg_exit_velocity: 84, max_distance: 190, classified_max_spin: 2000, classified_avg_spin: 2000, classified_spin_count: 1 };
  next.measurements = next.measurements.map(m => ({ ...m, value: changes[String(m.metric_key)] ?? m.value }));
  next.samples = next.samples.map(s => ({ ...s, sampleCount: String(s.metricKey).includes("pitch_velocity") ? 2 : 1, expectedValue: changes[String(s.metricKey)] ?? s.expectedValue }));
  next.contacts = next.contacts.slice(0, 1);
  return next;
}
beforeAll(async () => {
  await db.exec("create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;");
  const directory = new URL("../supabase/migrations/", import.meta.url);
  await initializeStorageSchema(db);
  for (const file of readdirSync(directory).filter(name => name.endsWith(".sql")).sort()) await db.exec(readFileSync(new URL(file, directory), "utf8"));
  for (const [id, role] of [[admin, "admin"], [coach, "coach"], [player, "player"]]) {
    await db.query("insert into auth.users values($1)", [id]);
    await db.query("insert into public.app_accounts(user_id,is_active) values($1,true)", [id]);
    await db.query("insert into public.account_roles(user_id,role) values($1,$2)", [id, role]);
  }
  await db.query("insert into public.athletes(id,athlete_code,first_name,last_name) values($1,'PAC-0001','Fictional','Hitter'),($2,'PAC-0002','Fictional','Pitcher')", [hitter, pitcher]);
  await db.query("insert into public.account_athletes(user_id,athlete_id) values($1,$2)", [player, hitter]);
  await db.query("insert into public.athlete_seasons(athlete_id,season) values($1,'2026-27'),($2,'2026-27')", [hitter, pitcher]);
}, 30000);
beforeEach(async () => {
  await db.exec("delete from private.full_swing_publication_requests;delete from private.full_swing_publication_revisions;delete from private.full_swing_publications;delete from private.csv_measurement_archives;delete from public.full_swing_contacts;delete from private.full_swing_session_samples;delete from private.full_swing_pitch_assignments;delete from public.performance_measurements;delete from public.performance_imports;delete from public.audit_events;update public.app_accounts set is_active=true;");
});
afterAll(() => db.close());

it("publishes all reviewed stages atomically, retries exactly, and returns a staff-only count receipt", async () => {
  const input = payload(), request = randomUUID();
  const result = await as(coach, () => publish(input, 0, false, request));
  expect(result).toMatchObject({ requestId: request, fileHash: hash, revision: 1, created: 12, unchanged: 0, measurementCount: 12, sampleCount: 5, contactCount: 2, assignmentVersion: 1 });
  expect(Number.isFinite(Date.parse(result.publishedAt))).toBe(true);
  expect(await counts()).toEqual({ measurements: 12, samples: 5, contacts: 2, labels: 1, publications: 1, revisions: 1, requests: 1 });
  expect(await as(coach, () => publish(input, 0, false, request))).toEqual(result);
  await as(admin, async () => { await expect(publish({ ...input, excludedPlayerCount: 1 }, 0, false, request)).rejects.toThrow("already used"); });
  const metadata = (await as(coach, () => db.query<{ data: Record<string, unknown>[] }>("select public.staff_full_swing_session_publications() data"))).rows[0].data;
  expect(metadata).toHaveLength(1);
  expect(metadata[0]).toMatchObject({ measurementCount: 12, sampleCount: 5, contactCount: 2, revision: 1, restoreTargetRevision: null });
  for (const forbidden of ["measurements", "contacts", "samples", "assignments", "payload", "athleteCode", "sourceRow", "value"]) expect(metadata[0]).not.toHaveProperty(forbidden);
});

it("rolls back labels, measurements, receipts and samples when the final contact validation fails", async () => {
  const input = payload(); input.contacts[1].launchAngle = 91;
  await as(coach, async () => { await expect(publish(input)).rejects.toThrow("Invalid contact value"); });
  expect(await counts()).toEqual({ measurements: 0, samples: 0, contacts: 0, labels: 0, publications: 0, revisions: 0, requests: 0 });
  expect((await db.query("select * from public.performance_imports")).rows).toHaveLength(0);
});

it("rejects mismatched contexts, orphan counts, duplicate source coordinates and Machine BP pitching", async () => {
  const invalids = [payload(), payload(), payload(), payload(), payload(), payload()];
  invalids[0].measurements[0].file_hash = "b".repeat(64);
  invalids[1].contacts[0].category = "practice";
  invalids[2].samples[0].expectedValue = 999;
  invalids[3].measurements.push({ ...invalids[3].measurements[0] });
  invalids[4].mode = "Machine BP";
  invalids[5].removedValues = ["3:Unreviewed"];
  for (const input of invalids) await as(admin, async () => { await expect(publish(input)).rejects.toThrow(); });
  expect((await counts()).publications).toBe(0);
});

it("supports Machine BP Practice hitting without player pitching or inferred pitch labels", async () => {
  const input = payload(); input.mode = "Machine BP"; input.category = "practice"; input.assignments = [];
  input.measurements = input.measurements.filter(m => m.athlete_code === "PAC-0001").map(m => ({ ...m, source: "Full Swing · Practice" }));
  input.samples = input.samples.filter(s => s.athleteCode === "PAC-0001"); input.contacts = input.contacts.map(c => ({ ...c, category: "practice" }));
  expect(await as(coach, () => publish(input))).toMatchObject({ measurementCount: 3, contactCount: 2 });
  expect((await db.query("select metric_key from public.performance_measurements where athlete_id=$1", [pitcher])).rows).toHaveLength(0);
});

it("adopts only a complete matching legacy review and never silently omits older saved results", async () => {
  const input = payload();
  await as(coach, () => db.query("select public.admin_import_performance($1::jsonb)", [JSON.stringify(input.measurements)]));
  const missing = structuredClone(input); missing.measurements = missing.measurements.filter(m => m.metric_key !== "max_distance"); missing.samples = missing.samples.filter(s => s.metricKey !== "max_distance");
  await as(coach, async () => { await expect(publish(missing)).rejects.toThrow("missing from this review"); });
  const changed = structuredClone(input); changed.measurements[0].value = 99; changed.samples[0].expectedValue = 99;
  await as(coach, async () => { await expect(publish(changed)).rejects.toThrow("differ"); });
  expect(await as(coach, () => publish(input))).toMatchObject({ created: 0, unchanged: 12, revision: 1 });
});

it("corrects averages, maxima, counts and charts together, preserves another file, and exactly restores originals", async () => {
  const original = payload(); await as(admin, () => publish(original));
  const before = await projection();
  const unrelated = { ...metric("max_exit_velocity", 97, "mph", 2), file_hash: "b".repeat(64), observation_id: `observation:${JSON.stringify(["b".repeat(64), summarySheet, 2, 2])}` };
  await as(admin, () => db.query("select public.admin_import_performance($1::jsonb)", [JSON.stringify([unrelated])]));
  const result = await as(admin, () => publish(corrected(original), 1, true));
  expect(result).toMatchObject({ revision: 2, measurementCount: 12, sampleCount: 5, contactCount: 1 });
  const values = (await db.query<{ metric_key: string; value: number }>("select metric_key,value from public.performance_measurements where file_hash=$1", [hash])).rows;
  expect(values).toEqual(expect.arrayContaining([{ metric_key: "max_exit_velocity", value: 84 }, { metric_key: "avg_exit_velocity", value: 84 }, { metric_key: "classified_max_spin", value: 2000 }, { metric_key: "classified_avg_spin", value: 2000 }, { metric_key: "classified_spin_count", value: 1 }, { metric_key: "classified_pitch_count", value: 2 }]));
  expect((await db.query("select sample_count from private.full_swing_session_samples where metric_key='avg_exit_velocity'")).rows).toEqual([{ sample_count: 1 }]);
  expect((await db.query("select * from public.full_swing_contacts")).rows).toHaveLength(1);
  const correctedBoard = (await as(player, () => db.query<{ data: { value: number }[] }>("select public.team_leaderboard('classified_avg_spin','full swing · intrasquad · fastball','rpm','fall_2026') data"))).rows[0].data;
  expect(correctedBoard[0].value).toBe(2000);
  expect((await db.query("select value from public.performance_measurements where file_hash=$1", ["b".repeat(64)])).rows).toEqual([{ value: 97 }]);
  const restoreId = randomUUID(); const restored = await as(admin, () => restore(2, 1, restoreId));
  expect(restored).toMatchObject({ revision: 3, restoredFromRevision: 1, contactCount: 2 });
  const after = await projection();
  for (const key of ["measurements", "samples", "contacts"]) expect(after[key]).toEqual(before[key]);
  expect(await as(admin, () => restore(2, 1, restoreId))).toEqual(restored);
  expect((await counts()).revisions).toBe(3);
});

it("rejects stale revisions, player remapping, context changes and non-admin corrections", async () => {
  const original = payload(); await as(coach, () => publish(original));
  const next = corrected(original);
  await as(admin, async () => { await expect(publish(next, 0, true)).rejects.toThrow("Session changed"); });
  await as(coach, async () => { await expect(publish(next, 1, true)).rejects.toThrow("administrator"); });
  const moved = structuredClone(next); moved.measurements = moved.measurements.map(m => m.athlete_code === "PAC-0001" ? { ...m, athlete_code: "PAC-0002" } : m); moved.samples = moved.samples.map(s => s.athleteCode === "PAC-0001" ? { ...s, athleteCode: "PAC-0002" } : s); moved.contacts = moved.contacts.map(c => ({ ...c, athleteCode: "PAC-0002" }));
  await as(admin, async () => { await expect(publish(moved, 1, true)).rejects.toThrow("cannot move"); });
  const changedContext = structuredClone(next); changedContext.date = "2026-09-12"; changedContext.measurements = changedContext.measurements.map(m => ({ ...m, measured_at: changedContext.date })); changedContext.contacts = changedContext.contacts.map(c => ({ ...c, playedOn: changedContext.date }));
  await as(admin, async () => { await expect(publish(changedContext, 1, true)).rejects.toThrow("original file or session context"); });
  expect((await counts()).revisions).toBe(1);
});

it("detects an external archived reading before correction or undo and preserves the archive guard on adoption", async () => {
  const original = payload(); await as(admin, () => publish(original));
  const input = corrected(original); await as(admin, () => publish(input, 1, true));
  const choices = (await as(admin, () => db.query<{ data: { id: string; fingerprint: string }[] }>("select public.admin_csv_max_readings($1) data", [hitter]))).rows[0].data;
  await as(admin, () => db.query("select public.admin_archive_csv_max_reading($1,$2,$3,$4,true)", [randomUUID(), hitter, choices[0].id, choices[0].fingerprint]));
  await as(admin, async () => { await expect(publish(input, 2, true)).rejects.toThrow("outside this review"); await expect(restore(2, 1)).rejects.toThrow("outside this review"); });
  const metadata = (await as(coach, () => db.query<{ data: { fullyPublished: boolean; restoreTargetRevision: number | null }[] }>("select public.staff_full_swing_session_publications() data"))).rows[0].data;
  expect(metadata[0]).toMatchObject({ fullyPublished: false, restoreTargetRevision: null });
  expect((await counts()).measurements).toBe(11);
  // Removing only ledger records simulates adoption of a pre-ledger archived legacy file.
  await db.exec("delete from private.full_swing_publication_requests;delete from private.full_swing_publication_revisions;delete from private.full_swing_publications;");
  input.assignmentVersion = 1;
  await as(admin, async () => { await expect(publish(input)).rejects.toThrow("These CSV readings were removed"); });
  expect((await counts()).measurements).toBe(11);
  expect((await counts()).publications).toBe(0);
});

it("marks externally changed pitch labels for review and refuses to overwrite the external change", async () => {
  const input = payload(); await as(admin, () => publish(input));
  await as(coach, () => db.query("select public.staff_full_swing_pitch_labels($1,1,$2::jsonb)", [hash, JSON.stringify([{ sourceRow: 2, pitchType: "Fastball" }])]));
  const metadata = (await as(coach, () => db.query<{ data: { fullyPublished: boolean }[] }>("select public.staff_full_swing_session_publications() data"))).rows[0].data;
  expect(metadata[0].fullyPublished).toBe(false);
  const revised = corrected(input); revised.assignmentVersion = 2;
  await as(admin, async () => { await expect(publish(revised, 1, true)).rejects.toThrow("outside this review"); });
  expect((await counts()).revisions).toBe(1);
});

it("saves over 500 classified measurements in transactional chunks without dropping any reviewed rows", async () => {
  const input = payload(); input.measurements = []; input.samples = []; input.contacts = []; input.assignments = []; input.eventCount = 72;
  for (let i = 0; i < 72; i++) {
    const code = `PAC-${String(100 + i).padStart(4, "0")}`;
    await db.query("insert into public.athletes(athlete_code,first_name,last_name) values($1,'Fictional','Chunk') on conflict(athlete_code) do nothing", [code]);
    input.assignments.push({ sourceRow: i + 2, pitchType: "Fastball" });
    input.measurements.push(...payload().measurements.filter(m => m.source_sheet === pitchSheet).map(m => ({ ...m, athlete_code: code, source_row: i + 2, observation_id: `observation:${JSON.stringify([hash, pitchSheet, i + 2, JSON.parse(String(m.observation_id).slice(12))[3]])}` })));
  }
  expect(input.measurements).toHaveLength(504);
  expect(await as(coach, () => publish(input))).toMatchObject({ created: 504, measurementCount: 504 });
  expect((await db.query("select * from public.performance_imports")).rows).toHaveLength(2);
});

it("denies Player, anonymous and inactive staff access and keeps private projection tables inaccessible", async () => {
  for (const id of [player, null]) await as(id, async () => {
    await expect(publish()).rejects.toThrow();
    await expect(db.exec("select public.staff_full_swing_session_publications()")).rejects.toThrow();
    await expect(db.query("select public.staff_full_swing_session_state($1)", [hash])).rejects.toThrow();
    await expect(restore(2, 1)).rejects.toThrow();
  });
  await as(coach, async () => {
    await expect(db.exec("select * from private.full_swing_publications")).rejects.toThrow("permission denied");
    await expect(db.query("select private.full_swing_projection($1)", [hash])).rejects.toThrow("permission denied");
  });
  await db.query("update public.app_accounts set is_active=false where user_id=$1", [coach]);
  await as(coach, async () => { await expect(publish()).rejects.toThrow("Active staff"); });
});

it("returns exact masks and immutable context for re-review without exposing saved numerical projections", async () => {
  const input = payload(); await as(admin, () => publish(input)); await as(admin, () => publish(corrected(input), 1, true));
  const state = (await as(coach, () => db.query<{ data: Record<string, unknown> }>("select public.staff_full_swing_session_state($1) data", [hash]))).rows[0].data;
  expect(state).toMatchObject({ revision: 2, removedValues: ["3:ExitSpeed", "3:Distance", "3:SpinRate"], fileName: "fictional-session.csv", date: "2026-09-11", category: "intrasquad", mode: "Live at Bat" });
  for (const field of ["payload", "measurements", "samples", "contacts", "projection"]) expect(state).not.toHaveProperty(field);
  const empty = (await as(coach, () => db.query<{ data: Record<string, unknown> }>("select public.staff_full_swing_session_state($1) data", ["f".repeat(64)]))).rows[0].data;
  expect(empty).toMatchObject({ revision: 0, receipt: null, metadata: null, removedValues: [], fileName: null });
});
