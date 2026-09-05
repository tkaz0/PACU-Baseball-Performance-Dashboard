import { test, expect } from "./local-admin";

test("dashboard, roster, profile, and importer fit mobile and desktop without page overflow", async ({ page }) => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1050 }]) {
    await page.setViewportSize(viewport);
    for (const route of ["/preview", "/preview/roster", "/preview/athletes/SYN-001", "/preview/import"]) {
      await page.goto(route);
      await expect(page.getByText("Sample roster · Fictional athletes · Administrator workspace", { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${route} at ${viewport.width}px`).toBe(true);
    }
    await page.getByLabel("Spreadsheet file", { exact: true }).setInputFiles({ name: "fictional-layout.csv", mimeType: "text/csv", buffer: Buffer.from("first_name,last_name,jersey_number\nFictional Layout,Testfield,0\n") });
    await page.getByRole("button", { name: "Validate and preview", exact: true }).click();
    await expect(page.getByRole("heading", { name: "3. Review and save", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `import review at ${viewport.width}px`).toBe(true);
  }
});
