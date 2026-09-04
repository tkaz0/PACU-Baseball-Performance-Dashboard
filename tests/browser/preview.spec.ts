import { test, expect, type Page } from "@playwright/test";

const banner = "Sample roster · Fictional athletes · No sign-in needed";
const names = [
  "Avery Northstar", "Blake Cloudfield", "Casey Maplebrook", "Drew Stonehaven",
  "Ellis Meadowvale", "Finley Skyridge", "Gray Willowcrest", "Harper Sunmeadow",
  "Indigo Brookhaven", "Jordan Westcloud",
];

async function expectPublicWorkspace(page: Page) {
  await expect(page.getByText(banner, { exact: true })).toBeVisible();
  await expect(page.locator('a[href^="/admin/"]')).toHaveCount(0);
}

test("the public home opens the fictional preview without signing in", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/preview\/?$/);
  await expectPublicWorkspace(page);
  await page.locator('a[href="/preview/roster"]').first().click();
  await expect(page).toHaveURL(/\/preview\/roster\/?$/);
  await expectPublicWorkspace(page);
});

test("the 2026 preview roster shows ten fictional athletes and searches by code", async ({ page }) => {
  await page.goto("/preview/roster?season=2026");
  const rows = page.locator("tbody tr");
  await expect(rows).toHaveCount(10);
  for (const name of names) {
    await expect(rows.getByText(name, { exact: true })).toBeVisible();
  }
  await expectPublicWorkspace(page);

  await page.getByLabel("Search athletes").fill("SYN-001");
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect(page).toHaveURL(/q=SYN-001/);
  expect(new URL(page.url()).searchParams.get("season")).toBe("2026");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("SYN-001");
  await expect(rows.first()).toContainText("Avery Northstar");
  await expect(rows.getByText("Blake Cloudfield", { exact: true })).toHaveCount(0);
});

test("fixture profiles preserve jersey zero and unknown browser-local IDs show an unavailable state", async ({ page }) => {
  await page.goto("/preview/roster?q=SYN-001&season=2026");
  await page.getByRole("link", { name: "View Avery Northstar profile", exact: true }).click();
  await expect(page).toHaveURL(/\/preview\/athletes\/SYN-001$/);
  await expect(page.getByRole("heading", { name: "Avery Northstar", exact: true })).toBeVisible();
  await expect(page.getByText("Fictional Avery Northstar", { exact: true })).toBeVisible();
  await expect(page.locator("dt").filter({ hasText: /^Jersey number$/ }).locator("+ dd")).toHaveText("0");
  await expectPublicWorkspace(page);

  const response = await page.goto("/preview/athletes/SYN-999");
  // The server returns the profile shell; only this browser can know its local athlete IDs.
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Profile unavailable", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Avery Northstar", exact: true })).toHaveCount(0);
});

test("opening the preview does not authorize private athlete data or administration", async ({ page, request }) => {
  await page.goto("/preview/athletes/SYN-001");
  await expectPublicWorkspace(page);

  // The public fixture's code must not become a shortcut into the protected data API.
  const response = await request.get("/api/athletes/SYN-001");
  expect([401, 503]).toContain(response.status());
  expect(await response.json()).toEqual({ error: "Access denied" });
  expect(response.headers()["cache-control"]).toContain("no-store");

  for (const route of ["/admin/import", "/admin/access"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    await expect(page.getByRole("heading", { name: "Welcome back.", exact: true })).toBeVisible();
    await expect(page.getByText("Avery Northstar", { exact: true })).toHaveCount(0);
  }
});
