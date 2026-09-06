import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const enabled = process.env.RUN_LOCAL_SUPABASE_TESTS === "true";
const env = (key: string) => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing test configuration: ${key}`);
  return value;
};
function client() {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  if (!["127.0.0.1","localhost"].includes(new URL(url).hostname)) throw new Error("Integration tests refuse hosted Supabase URLs.");
  return createClient(url,env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),{auth:{persistSession:false,autoRefreshToken:false}});
}
async function signedClient(identity: string) {
  const supabase = client();
  const {data,error} = await supabase.auth.signInWithPassword({email:env(`TEST_${identity}_EMAIL`),password:env(`TEST_${identity}_PASSWORD`)});
  expect(error,`${identity} should authenticate`).toBeNull();
  return {supabase,user:data.user!};
}
async function signIn(page: Page, identity: string) {
  await page.goto("/login");
  await page.getByLabel("Email Address").fill(env(`TEST_${identity}_EMAIL`));
  await page.getByLabel("Password",{exact:true}).fill(env(`TEST_${identity}_PASSWORD`));
  await page.getByRole("button",{name:"Sign In",exact:true}).click();
  if (identity.startsWith("PLAYER_")) await expect(page).toHaveURL(new RegExp(`/athletes/${env(`TEST_${identity}_ATHLETE_ID`)}(?:\\?|$)`));
  else await expect(page).toHaveURL(/\/roster(?:\?|$)/);
}
test.describe("real local Supabase sessions (owner-provisioned identities)",() => {
  test.skip(!enabled,"Requires local Supabase and separately provisioned test identities; see docs/TESTING.md.");
  test("Player A sees own profile, cannot access B through UI, app API, or direct Supabase API, and cannot self-promote",async ({page}) => {
    const {supabase} = await signedClient("PLAYER_A");
    const own = env("TEST_PLAYER_A_ATHLETE_ID"), other = env("TEST_PLAYER_B_ATHLETE_ID");
    await signIn(page,"PLAYER_A");
    await page.goto(`/athletes/${own}`); await expect(page.getByText("Athlete profile",{exact:true})).toBeVisible();
    await page.goto(`/athletes/${other}`); await expect(page.getByRole("heading",{name:"Profile or page unavailable"})).toBeVisible();
    expect((await page.request.get(`/api/athletes/${other}`)).status()).toBe(404);
    const {data,error} = await supabase.from("athletes").select("id").eq("id",other);
    expect(error).toBeNull(); expect(data).toEqual([]);
    const ownAuth = await supabase.auth.getUser();
    const attempt = await supabase.from("account_roles").insert({user_id:ownAuth.data.user!.id,role:"admin"});
    expect(attempt.error).not.toBeNull();
    await page.goto("/admin/import"); await expect(page).toHaveURL(/access-denied/);
    await supabase.auth.signOut();
  });
  test("Player B loses UI/API/database access with an existing session after admin disables it",async ({page}) => {
    const admin = await signedClient("ADMIN"), player = await signedClient("PLAYER_B");
    const athlete = env("TEST_PLAYER_B_ATHLETE_ID");
    await signIn(page,"PLAYER_B");
    try {
      const result = await admin.supabase.rpc("admin_configure_account",{target_user:player.user.id,active:false,roles:["player"],linked_athlete:athlete});
      expect(result.error).toBeNull();
      expect((await page.request.get(`/api/athletes/${athlete}`)).status()).toBe(403);
      const denied = await player.supabase.from("athletes").select("id"); expect(denied.error).toBeNull(); expect(denied.data).toEqual([]);
      await page.goto(`/athletes/${athlete}`); await expect(page).toHaveURL(/access-denied/);
    } finally {
      const restored = await admin.supabase.rpc("admin_configure_account",{target_user:player.user.id,active:true,roles:["player"],linked_athlete:athlete});
      expect(restored.error).toBeNull();
      await admin.supabase.auth.signOut(); await player.supabase.auth.signOut();
    }
  });
  test("Coach reads roster and profiles but cannot open roster import",async ({page}) => {
    await signIn(page,"COACH");
    await page.goto("/roster"); await expect(page.getByRole("heading",{name:"Team Roster",exact:true})).toBeVisible();
    await page.goto(`/athletes/${env("TEST_PLAYER_A_ATHLETE_ID")}`); await expect(page.getByText("Athlete profile",{exact:true})).toBeVisible();
    await page.goto("/admin/import"); await expect(page).toHaveURL(/access-denied/);
  });
  test("Admin uploads, previews and approves the synthetic roster and signs out",async ({page}) => {
    await signIn(page,"ADMIN");
    await page.goto("/admin/import");
    await page.getByLabel("Season",{exact:true}).fill("2026");
    await page.getByLabel("Roster CSV").setInputFiles("fixtures/synthetic-roster.csv");
    await page.getByRole("button",{name:"Validate and preview"}).click();
    await expect(page.getByRole("heading",{name:"Review roster changes"})).toBeVisible();
    await page.getByLabel(/I have reviewed/).check();
    await page.getByRole("button",{name:"Approve and apply import"}).click();
    await expect(page.getByRole("heading",{name:"Import complete"})).toBeVisible();
    await page.getByRole("button",{name:"Sign out",exact:true}).click();
    await expect(page).toHaveURL(/login/);
  });
});
