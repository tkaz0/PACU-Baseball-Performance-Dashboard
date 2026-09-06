import { existsSync } from "node:fs";
import { test as base, expect } from "@playwright/test";

export { expect } from "@playwright/test";
export type { Download, Locator, Page } from "@playwright/test";

/** Real local authentication only; never substitute a production route bypass. */
export const test = base.extend<{ localAdminSession: void }>({
  localAdminSession: [async ({ page, baseURL }, use, testInfo) => {
    testInfo.skip(!existsSync(".env.test.local") || process.env.RUN_LOCAL_SUPABASE_TESTS !== "true",
      "Requires .env.test.local and a separately provisioned local Admin; see docs/TESTING.md.");
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!baseURL || !supabaseUrl || ![baseURL, supabaseUrl].every(value => ["localhost", "127.0.0.1"].includes(new URL(value).hostname))) {
      throw new Error("Browser import tests refuse non-local app or Supabase environments.");
    }
    const email = process.env.TEST_ADMIN_EMAIL, password = process.env.TEST_ADMIN_PASSWORD;
    if (!email || !password) throw new Error("Configure the local TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD privately.");
    await page.goto("/login");
    await page.getByLabel(/^Email Address$/i).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: /^Sign In$/i }).click();
    await expect(page).toHaveURL(/\/roster(?:\?|$)/);
    const access = await page.request.get("/api/local-workspace/access");
    expect(access.status(), "The local test account must be an active Admin outside View as").toBe(200);
    expect((await access.json()).allowed).toBe(true);
    await use();
  }, { auto: true }],
});
