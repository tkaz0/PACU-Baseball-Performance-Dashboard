import { test, expect } from "@playwright/test";

test("domain home and every local workspace entry require sign-in", async ({ page }) => {
  for (const path of ["/", "/preview", "/preview/roster?season=2026", "/preview/import", "/preview/access", "/preview/athletes/SYN-001"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login\/?$/);
    await expect(page.getByRole("heading", { name: /^Welcome Back$/i })).toBeVisible();
    await expect(page.locator('a[href^="/preview"]')).toHaveCount(0);
    await expect(page.getByText("Avery Northstar", { exact: true })).toHaveCount(0);
  }
});

test("anonymous local workspace navigation never opens device data", async ({ page }) => {
  await page.addInitScript(() => {
    const state = window as typeof window & { workspaceDatabaseOpens: number };
    state.workspaceDatabaseOpens = 0;
    const original = indexedDB.open.bind(indexedDB);
    indexedDB.open = (name: string, version?: number) => { state.workspaceDatabaseOpens += 1; return original(name, version); };
  });
  await page.goto("/preview/import");
  await expect(page).toHaveURL(/\/login\/?$/);
  expect(await page.evaluate(() => (window as typeof window & { workspaceDatabaseOpens: number }).workspaceDatabaseOpens)).toBe(0);
});

test("anonymous local workspace authorization endpoint returns no account or data", async ({ request }) => {
  const response = await request.get("/api/local-workspace/access");
  expect([401, 503]).toContain(response.status());
  expect(await response.json()).toEqual({ allowed: false });
  expect(response.headers()["cache-control"]).toContain("no-store");
});
