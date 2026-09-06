import { test, expect, type Download, type Page } from "./local-admin";
import { utils, write } from "xlsx";

const rosterCSV = "first_name,last_name,jersey_number\nFictional Rowan,Testfield,0\nFictional Taylor,Testbrook,12\n";
const measurementCSV = "athlete_code,date,weight,speed\nSYN-001,2026-09-01,80.5,25\nSYN-001,2026-09-04,81,26\n";
const applyLabel = "I reviewed the rows and approve saving this import in this browser.";

async function openImporter(page: Page) {
  await page.goto("/preview/import");
  await expect(page.getByLabel("Spreadsheet file", { exact: true })).toBeEnabled();
}

async function uploadCSV(page: Page, contents: string, name: string) {
  await page.getByLabel("Spreadsheet file", { exact: true }).setInputFiles({
    name, mimeType: "text/csv", buffer: Buffer.from(contents),
  });
  await expect(page.getByRole("button", { name: "Validate and preview" })).toBeEnabled();
}

async function applyPreview(page: Page) {
  await page.getByLabel(applyLabel, { exact: true }).check();
  await page.getByRole("button", { name: "Apply reviewed import", exact: true }).click();
  await expect(page.getByText(/was saved in this browser\.$/)).toBeVisible();
}

async function importRoster(page: Page) {
  await openImporter(page);
  await uploadCSV(page, rosterCSV, "fictional-roster.csv");
  await page.getByRole("button", { name: "Validate and preview" }).click();
  await expect(page.getByRole("table", { name: "Import row validation and proposed changes" }).locator("tbody tr")).toHaveCount(2);
  await applyPreview(page);
}

async function mapMeasurements(page: Page, twoMetrics = false) {
  await page.getByRole("combobox", { name: "Measurement source", exact: true }).selectOption("RENPHO");
  await page.getByRole("combobox", { name: "Athlete identity column", exact: true }).selectOption("0");
  await page.getByRole("combobox", { name: "Date column", exact: true }).selectOption("1");
  await page.getByRole("combobox", { name: "Metric 1 column", exact: true }).selectOption("2");
  await page.getByLabel("Measurement name", { exact: true }).first().fill("Body mass");
  await page.getByLabel("Unit", { exact: true }).first().fill("kg");
  if (twoMetrics) {
    await page.getByRole("button", { name: "Add measurement column", exact: true }).click();
    await page.getByRole("combobox", { name: "Metric 2 column", exact: true }).selectOption("3");
    await page.getByLabel("Measurement name", { exact: true }).nth(1).fill("Bat speed");
    await page.getByLabel("Unit", { exact: true }).nth(1).fill("mph");
  }
}

async function downloadBytes(download: Download) {
  const stream = await download.createReadStream();
  if (!stream) throw new Error("The browser did not provide the requested download.");
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

test("roster review replaces samples, preserves zero after reload, exports codes, and blocks a repeated file", async ({ page }) => {
  await openImporter(page);
  await uploadCSV(page, rosterCSV, "fictional-roster.csv");
  await page.getByRole("button", { name: "Validate and preview" }).click();
  const review = page.getByRole("table", { name: "Import row validation and proposed changes" });
  await expect(review.locator("tbody tr")).toHaveCount(2);
  await expect(review).toContainText("PAC-0001");
  await expect(review).toContainText("PAC-0002");
  await expect(page.getByText(/names alone will create new athletes/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Apply reviewed import", exact: true })).toBeDisabled();
  await applyPreview(page);

  const exported = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export roster with athlete codes", exact: true }).click();
  const csv = (await downloadBytes(await exported)).toString("utf8");
  expect(csv).toContain("athlete_code");
  expect(csv).toContain("PAC-0001");
  expect(csv).toContain("PAC-0002");
  await page.goto("/preview/roster");
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await expect(page.locator("tbody")).not.toContainText("Northstar");
  await page.goto("/preview/athletes/PAC-0001");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Fictional Rowan Testfield", exact: true })).toBeVisible();
  await expect(page.locator("dt").filter({ hasText: /^Jersey Number$/ }).locator("+ dd")).toHaveText("0");

  await openImporter(page);
  await uploadCSV(page, rosterCSV, "fictional-roster.csv");
  await page.getByRole("button", { name: "Validate and preview" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "already imported for this season" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Apply reviewed import", exact: true })).toHaveCount(0);
});

test("measurement batches persist, deduplicate source values, and can be removed", async ({ page }) => {
  await openImporter(page);
  await page.getByRole("combobox", { name: "Import type", exact: true }).selectOption("measurements");
  await uploadCSV(page, measurementCSV, "fictional-measurements.csv");
  await mapMeasurements(page, true);
  await page.getByRole("button", { name: "Validate and preview" }).click();
  await expect(page.getByText(/4 new measurement values are ready for review/)).toBeVisible();
  await applyPreview(page);
  await page.goto("/preview/athletes/SYN-001");
  await page.reload();
  const readings = page.getByRole("table", { name: /Imported performance readings/ });
  await expect(readings.locator("tbody tr")).toHaveCount(4);
  await expect(readings).toContainText("80.5");
  await expect(readings).toContainText("kg");
  await expect(readings).toContainText("mph");

  await openImporter(page);
  await page.getByRole("combobox", { name: "Import type", exact: true }).selectOption("measurements");
  await uploadCSV(page, measurementCSV, "fictional-measurements.csv");
  await mapMeasurements(page, true);
  await page.getByRole("button", { name: "Validate and preview" }).click();
  await expect(page.getByText(/0 new measurement values are ready for review/)).toBeVisible();
  const reviewRows = page.getByRole("table", { name: "Import row validation and proposed changes" }).locator("tbody tr");
  await expect(reviewRows).toHaveCount(2);
  await expect(reviewRows.nth(0)).toContainText("unchanged");
  await expect(reviewRows.nth(1)).toContainText("unchanged");
  await page.getByRole("button", { name: "Remove batch", exact: true }).click();
  await page.getByRole("button", { name: "Confirm removal", exact: true }).click();
  await expect(page.getByText("Measurement batch removed from this browser.", { exact: true })).toBeVisible();
  await expect(page.getByText(/workspace changed after this preview/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Apply reviewed import", exact: true })).toBeDisabled();
  await page.goto("/preview/athletes/SYN-001");
  await expect(page.getByTestId("player-performance-profile")).toBeVisible();
  await expect(page.getByText("Not Yet Tested", { exact: true }).first()).toBeVisible();
  await expect(page.locator('[data-testid="player-metric"][data-value]')).toHaveCount(0);
  await expect(page.getByRole("table", { name: /Imported performance readings/ })).toHaveCount(0);
});

test("invalid mappings cannot apply and automatic name matches require explicit confirmation", async ({ page }) => {
  await openImporter(page);
  await page.getByRole("combobox", { name: "Import type", exact: true }).selectOption("measurements");
  await uploadCSV(page, "name,date,weight\nFictional Avery Northstar,2026-09-04,80.5\n", "fictional-names.csv");
  await page.getByRole("combobox", { name: "Match athletes by", exact: true }).selectOption("name");
  await mapMeasurements(page);
  await page.getByRole("combobox", { name: "Metric 1 column", exact: true }).selectOption("0");
  await page.getByRole("button", { name: "Validate and preview" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Identity and date columns cannot also be measurement columns" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Apply reviewed import", exact: true })).toHaveCount(0);
  await page.getByRole("combobox", { name: "Metric 1 column", exact: true }).selectOption("2");
  await page.getByRole("button", { name: "Validate and preview" }).click();
  await expect(page.getByRole("table", { name: "Import row validation and proposed changes" })).toContainText("SYN-001");
  await page.getByLabel(applyLabel, { exact: true }).check();
  await expect(page.getByRole("button", { name: "Apply reviewed import", exact: true })).toBeDisabled();
  await page.getByLabel("I reviewed all 1 source rows matched by athlete name and confirmed each athlete.", { exact: true }).check();
  await expect(page.getByRole("button", { name: "Apply reviewed import", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Apply reviewed import", exact: true }).click();
  await expect(page.getByText(/was saved in this browser\.$/)).toBeVisible();
});

test("JSON backup restores the reviewed roster after a confirmed reset", async ({ page }) => {
  await importRoster(page);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export backup", exact: true }).click();
  const backup = await downloadBytes(await download);
  expect(JSON.parse(backup.toString("utf8")).roster).toHaveLength(2);
  await page.getByLabel("Clear the saved roster, measurements, and import history from this browser.", { exact: true }).check();
  await page.getByRole("button", { name: "Reset browser workspace", exact: true }).click();
  await expect(page.getByText("This browser workspace has been reset to the fictional sample roster.", { exact: true })).toBeVisible();
  await page.getByLabel("Restore workspace JSON backup", { exact: true }).setInputFiles({ name: "fictional-backup.json", mimeType: "application/json", buffer: backup });
  await expect(page.getByRole("button", { name: "Restore backup", exact: true })).toBeDisabled();
  await page.getByLabel("Replace this browser's roster, measurements, and import history with this backup.", { exact: true }).check();
  await page.getByRole("button", { name: "Restore backup", exact: true }).click();
  await expect(page.getByText("Backup restored in this browser.", { exact: true })).toBeVisible();
  await page.goto("/preview/roster");
  await page.reload();
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await expect(page.locator("tbody")).toContainText("PAC-0001");
});

test("XLSX imports let the user choose a sheet and header row", async ({ page }) => {
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, utils.aoa_to_sheet([["Fictional workbook notes"], ["Choose Roster, header row 2"]]), "Notes");
  utils.book_append_sheet(workbook, utils.aoa_to_sheet([
    ["Fictional roster for browser verification"],
    ["athlete_code", "first_name", "last_name", "jersey_number"],
    ["TEST-101", "Fictional Morgan", "Sheetfield", 0],
  ]), "Roster");
  await openImporter(page);
  await page.getByLabel("Spreadsheet file", { exact: true }).setInputFiles({ name: "fictional-workbook.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: write(workbook, { type: "buffer", bookType: "xlsx" }) });
  await expect(page.getByRole("combobox", { name: "Sheet", exact: true })).toBeEnabled();
  await page.getByRole("combobox", { name: "Sheet", exact: true }).selectOption({ label: "Roster" });
  await page.getByLabel("Header row", { exact: true }).fill("2");
  await expect(page.getByRole("combobox", { name: "Permanent athlete code", exact: true })).toHaveValue("0");
  await expect(page.getByRole("combobox", { name: "First name", exact: true })).toHaveValue("1");
  await expect(page.getByText("Calculated cells are not imported; export values only or map raw measurements.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Validate and preview" }).click();
  await expect(page.getByRole("table", { name: "Import row validation and proposed changes" }).locator("tbody tr")).toHaveCount(1);
  await applyPreview(page);
  await page.goto("/preview/athletes/TEST-101");
  await expect(page.getByRole("heading", { name: "Fictional Morgan Sheetfield", exact: true })).toBeVisible();
  await expect(page.locator("dt").filter({ hasText: /^Jersey Number$/ }).locator("+ dd")).toHaveText("0");
});
