import { expect, test, type Download, type Page } from "@playwright/test";
import type { LocalWorkspace } from "../../lib/local-workspace";

// This fixture contains only fictional profiles and readings, restored through
// the normal reviewed backup flow in a fresh isolated Playwright browser.
function fictionalWorkspace(): LocalWorkspace {
  return {
    version: 1, revision: 0, mode: "local",
    roster: [
      { code: "SYN-001", first: "Fictional Avery", preferred: "Avery", last: "Northstar", jersey: 0 },
      { code: "SYN-002", first: "Fictional Blake", preferred: "Blake", last: "Cloudfield", jersey: 12 },
    ].map(a => ({
      id: a.code, athlete_code: a.code, first_name: a.first, preferred_name: a.preferred, last_name: a.last,
      pacific_email: `${a.code.toLowerCase()}@example.com`, profile_photo_url: null, created_at: "", updated_at: "",
      athlete_seasons: [{ athlete_id: a.code, season: "2026", jersey_number: a.jersey, primary_position: "CF",
        secondary_position: null, player_type: "position", bats: "L", throws: "R", academic_class: "freshman",
        eligibility_year: 1, graduation_year: 2030, roster_status: "active" }],
    })),
    batches: [{ id: "fictional-view-batch", kind: "measurements", fileName: "fictional-view.csv", source: "Fictional test",
      importedAt: "2026-01-02T00:00:00.000Z", created: 2, updated: 0, unchanged: 0, fileHash: "a".repeat(64) }],
    measurements: [
      { code: "SYN-001", metric: "Fictional own reading", value: 0 },
      { code: "SYN-002", metric: "Fictional other reading", value: 22 },
    ].map((m, index) => ({
      id: `fictional-view-reading-${index}`, athlete_code: m.code, measured_at: "2026-01-01", source: "Fictional test",
      metric: m.metric, value: m.value, unit: "s", source_file: "fictional-view.csv", source_sheet: "CSV",
      source_row: index + 2, file_hash: "a".repeat(64), batch_id: "fictional-view-batch",
    })),
  };
}

async function openViewMenu(page: Page) {
  const summary = page.locator("details.view-menu > summary");
  await expect(summary).toBeVisible();
  await summary.click();
}

async function selectPlayer(page: Page) {
  await openViewMenu(page);
  await expect(page.getByRole("button", { name: "Preview player", exact: true })).toBeDisabled();
  await page.getByRole("combobox", { name: "Player to preview", exact: true }).selectOption("SYN-001");
  await page.getByRole("button", { name: "Preview player", exact: true }).click();
  await expect(page.getByText("Viewing as: Player", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Avery Northstar", exact: true })).toBeVisible();
}

async function expectNoManagement(page: Page) {
  await expect(page.locator('a[href="/preview/import"], a[href="/preview/access"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Export backup|Restore backup|Export roster with athlete codes|Reset browser workspace/ })).toHaveCount(0);
  await expect(page.getByLabel("Restore workspace JSON backup", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Spreadsheet file", { exact: true })).toHaveCount(0);
}

async function expectDenied(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByRole("heading", { name: "Not part of this view", exact: true })).toBeVisible();
  await expectNoManagement(page);
  await expect(page.getByRole("table", { name: /Imported performance readings/ })).toHaveCount(0);
}

async function restoreFictionalWorkspace(page: Page) {
  await page.goto("/preview/import");
  const file = page.getByLabel("Restore workspace JSON backup", { exact: true });
  await expect(file).toBeEnabled();
  await file.setInputFiles({ name: "fictional-view-backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(fictionalWorkspace())) });
  await page.getByLabel("Replace this browser's roster, measurements, and import history with this backup.", { exact: true }).check();
  await page.getByRole("button", { name: "Restore backup", exact: true }).click();
  await expect(page.getByText("Backup restored in this browser.", { exact: true })).toBeVisible();
}

async function downloadJSON(download: Download) {
  const stream = await download.createReadStream();
  if (!stream) throw new Error("The browser did not provide the requested fictional test backup.");
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function exportBackup(page: Page) {
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export backup", exact: true }).click();
  return downloadJSON(await download);
}

test("coach preview retains the team, removes management, and blocks direct management URLs", async ({ page }) => {
  await page.goto("/preview/access");
  await expect(page.getByRole("heading", { name: "Access & views", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Import Center", exact: true })).toBeVisible();
  await openViewMenu(page);
  await page.getByRole("button", { name: /^Coach/ }).click();
  await expect(page.getByText("Viewing as: Coach", { exact: true })).toBeVisible();
  await expectNoManagement(page);
  await page.goto("/preview/roster");
  await expect(page.locator("tbody tr")).toHaveCount(10);
  await expectNoManagement(page);
  await page.goto("/preview/athletes/SYN-002");
  await expect(page.getByRole("heading", { name: "Blake Cloudfield", exact: true })).toBeVisible();
  await expectNoManagement(page);
  for (const path of ["/preview/import", "/preview/access"]) await expectDenied(page, path);
  await page.reload();
  await expect(page.getByText("Viewing as: Coach", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Not part of this view", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Exit preview", exact: true }).click();
  await expect(page.getByText("Viewing as: Coach", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Import Center", exact: true })).toBeVisible();
});

test("player preview requires a selection, persists, and blocks the roster and other profiles", async ({ page }) => {
  await page.goto("/preview");
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
  await selectPlayer(page);
  await expect(page.locator("dt").filter({ hasText: /^Jersey number$/ }).locator("+ dd")).toHaveText("0");
  await expectNoManagement(page);
  await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Master roster", exact: true })).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText("Blake Cloudfield");
  await page.reload();
  await expect(page.getByText("Viewing as: Player", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Avery Northstar", exact: true })).toBeVisible();
  for (const path of ["/preview/athletes/SYN-002", "/preview/roster", "/preview/import", "/preview/access"]) await expectDenied(page, path);
  await page.goto("/preview");
  await expect(page.getByRole("heading", { name: "Avery Northstar", exact: true })).toBeVisible();
  await expect(page.locator("main")).not.toContainText("Blake Cloudfield");
  await page.getByRole("button", { name: "Exit preview", exact: true }).click();
  await page.goto("/preview/roster");
  await expect(page.locator("tbody tr")).toHaveCount(10);
  await expect(page.locator("tbody")).toContainText("Blake Cloudfield");
});

test("player measurements are scoped and exiting preserves the complete saved backup exactly", async ({ page }) => {
  await restoreFictionalWorkspace(page);
  const before = await exportBackup(page);
  expect(before.roster).toHaveLength(2);
  expect(before.measurements).toHaveLength(2);
  await selectPlayer(page);
  const readings = page.getByRole("table", { name: /Imported performance readings/ });
  await expect(readings.locator("tbody tr")).toHaveCount(1);
  await expect(readings).toContainText("Fictional own reading");
  await expect(readings.locator("tbody tr").first().locator("td").nth(2)).toHaveText("0");
  await expect(page.locator("main")).not.toContainText("Fictional other reading");
  await expect(page.locator("main")).not.toContainText("Cloudfield");
  await expectNoManagement(page);
  await page.reload();
  await expect(page.getByText("Viewing as: Player", { exact: true })).toBeVisible();
  await expect(readings.locator("tbody tr")).toHaveCount(1);
  await expectNoManagement(page);
  await page.getByRole("button", { name: "Exit preview", exact: true }).click();
  await page.goto("/preview/import");
  await expect(page.getByRole("button", { name: "Export backup", exact: true })).toBeEnabled();
  expect(await exportBackup(page)).toEqual(before);
  await page.goto("/preview/athletes/SYN-002");
  await expect(page.getByRole("heading", { name: "Blake Cloudfield", exact: true })).toBeVisible();
  await expect(readings).toContainText("Fictional other reading");
  await expect(readings).not.toContainText("Fictional own reading");
});
