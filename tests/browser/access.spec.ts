import { test, expect } from "@playwright/test";
const otherAthlete = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
test("anonymous pages redirect to sign-in without revealing athletes", async ({ page }) => {
  for (const route of ["/overview","/roster",`/athletes/${otherAthlete}`,"/admin/import","/admin/access"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading",{name:"Welcome back."})).toBeVisible();
    await expect(page.getByText("Northstar")).toHaveCount(0);
  }
});
test("anonymous API requests return no athlete and disable caching", async ({ request }) => {
  const response = await request.get(`/api/athletes/${otherAthlete}`);
  expect([401,503]).toContain(response.status());
  expect(await response.json()).toEqual({error:"Access denied"});
  expect(response.headers()["cache-control"]).toContain("no-store");
});
test("login has no signup or demo bypass and reset navigation works", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("link",{name:/sign up|demo/i})).toHaveCount(0);
  await page.getByRole("link",{name:"Forgot password?"}).click();
  await expect(page).toHaveURL(/forgot-password/);
  await expect(page.getByRole("heading",{name:"Reset your password"})).toBeVisible();
  await page.goto("/reset-password");
  await expect(page).toHaveURL(/login/);
  await page.goto("/auth/confirm?type=invite&token_hash=not-a-token");
  await expect(page).toHaveURL(/auth\/confirm\?type=invite&error=invalid/);
  await expect(page.getByRole("heading", { name: "Invitation unavailable" })).toBeVisible();
});
test("login fits mobile and desktop and has labelled controls", async ({ page }) => {
  for (const viewport of [{width:390,height:844},{width:1440,height:1000}]) {
    await page.setViewportSize(viewport);
    await page.goto("/login");
    await expect(page.getByLabel("Email address")).toBeVisible();
    await expect(page.getByLabel("Password",{exact:true})).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
test("downloadable template contains the 16 specified headers and no identities", async ({ request }) => {
  const r = await request.get("/templates/master-roster.csv");
  expect(r.ok()).toBe(true);
  const text = await r.text();
  expect(text.trim().split("\n")).toHaveLength(1);
  expect(text.trim().split(",")).toHaveLength(16);
  expect(text).toContain("athlete_code,first_name,preferred_name,last_name,pacific_email");
});
