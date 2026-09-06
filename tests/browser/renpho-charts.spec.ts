import { expect, test, type Locator, type Page } from "./local-admin";
import type { LocalWorkspace } from "../../lib/local-workspace";

type Reading = readonly [metric: string, value: number, unit: string];
type FictionalReport = {
  hash: string; date: string; importedAt: string; file: string; readings: Reading[];
  source?: string; sheet?: string;
};

// These backups contain only fictional data and enter through the same validated
// JSON restore flow as a user backup. No production storage or OCR is accessed.
function workspace(reports: FictionalReport[]): LocalWorkspace {
  return {
    version: 1, revision: 0, mode: "local",
    roster: [{
      id: "SYN-001", athlete_code: "SYN-001", first_name: "Fictional Avery",
      preferred_name: "Avery", last_name: "Northstar", pacific_email: "fictional.avery@example.com",
      profile_photo_url: null, created_at: "", updated_at: "", athlete_seasons: [{
        athlete_id: "SYN-001", season: "2026", jersey_number: 0, primary_position: "CF",
        secondary_position: null, player_type: "position", bats: "L", throws: "R",
        academic_class: "freshman", eligibility_year: 1, graduation_year: 2030, roster_status: "active",
      }],
    }],
    batches: reports.map((report, index) => ({
      id: `fictional-chart-batch-${index}`, kind: "measurements", fileName: report.file,
      fileHash: report.hash.repeat(64), source: report.source ?? "RENPHO", importedAt: report.importedAt,
      created: report.readings.length, updated: 0, unchanged: 0,
    })),
    measurements: reports.flatMap((report, reportIndex) => report.readings.map(([metric, value, unit], index) => ({
      id: `fictional-chart-reading-${reportIndex}-${index}`, athlete_code: "SYN-001",
      measured_at: report.date, source: report.source ?? "RENPHO", metric, value, unit,
      source_file: report.file, source_sheet: report.sheet ?? "RENPHO report · Page 1",
      source_row: index + 1, file_hash: report.hash.repeat(64), batch_id: `fictional-chart-batch-${reportIndex}`,
    }))),
  };
}

function comparisonReports(): FictionalReport[] {
  return [
    { hash: "a", date: "2026-08-01", importedAt: "2026-09-10T13:00:00.000Z", file: "fictional-old-lb.pdf",
      readings: [["Weight", 180, "lb"], ["Body Fat Mass", 30, "lb"], ["Skeletal Muscle Mass", 75, "lb"], ["Body Fat Percentage", 18, "%"]] },
    { hash: "b", date: "2026-08-15", importedAt: "2026-08-15T11:00:00.000Z", file: "fictional-kg.pdf",
      readings: [["Weight", 81, "kg"], ["Body Fat Percentage", 18, "%"]] },
    { hash: "c", date: "2026-09-04", importedAt: "2026-09-04T10:00:00.000Z", file: "fictional-earlier-import.pdf",
      readings: [["Weight", 179, "lb"], ["Muscle Mass", 140, "lb"], ["Body Fat Percentage", 17, "%"]] },
    { hash: "d", date: "2026-09-04", importedAt: "2026-09-04T11:00:00.000Z", file: "fictional-latest-report.pdf",
      readings: [["Weight", 176, "lb"], ["Body Fat Mass", 26.4, "lb"], ["Bone Mass", 0, "lb"], ["Body Fat Percentage", 15, "%"], ["Subcutaneous Fat", 11, "%"]] },
    { hash: "d", date: "2026-09-03", importedAt: "2026-09-03T11:00:00.000Z", file: "fictional-latest-report.pdf",
      readings: [["Weight", 178, "lb"], ["Body Fat Percentage", 16, "%"]] },
    { hash: "e", date: "2026-09-05", importedAt: "2026-09-05T11:00:00.000Z", file: "fictional-labeled-csv.csv", sheet: "CSV",
      readings: [["Weight", 999, "lb"]] },
    { hash: "f", date: "2026-09-06", importedAt: "2026-09-06T11:00:00.000Z", file: "fictional-other-source.csv", source: "Other",
      readings: [["Weight", 888, "lb"]] },
  ];
}

async function restoreProfile(page: Page, data: LocalWorkspace) {
  await page.goto("/preview/import");
  const restoreFile = page.getByLabel("Restore workspace JSON backup", { exact: true });
  await expect(restoreFile).toBeEnabled();
  await restoreFile.setInputFiles({ name: "fictional-chart-backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(data)) });
  await page.getByLabel("Replace this browser's roster, measurements, and import history with this backup.", { exact: true }).check();
  await page.getByRole("button", { name: "Restore backup", exact: true }).click();
  await expect(page.getByText("Backup restored in this browser.", { exact: true })).toBeVisible();
  await page.goto("/preview/athletes/SYN-001");
  await page.getByRole("tab", { name: "Physicality", exact: true }).click();
  const reportDetails = page.getByText("Full RENPHO charts & report history", { exact: true });
  if (await reportDetails.count()) await reportDetails.click();
}

async function selectReport(charts: Locator, file: string, date: string) {
  const select = charts.getByRole("combobox", { name: "RENPHO report", exact: true });
  const option = select.locator("option").filter({ hasText: file }).filter({ hasText: date });
  await expect(option).toHaveCount(1);
  await select.selectOption((await option.getAttribute("value"))!);
}

async function expectReading(figure: Locator, metric: string, value: number, unit: string) {
  // Read the public chart contract on the row itself; do not infer a value from a
  // color, rounded tick, or a similarly named measurement in another report.
  const row = figure.locator(`[data-testid="renpho-bar"][data-metric=${JSON.stringify(metric)}][data-unit=${JSON.stringify(unit)}]`);
  await expect(row).toHaveCount(1);
  await expect(row).toHaveAttribute("data-value", String(value));
  await expect(row).toContainText(metric);
  await expect(row).toContainText(String(value));
  await expect(row).toContainText(unit);
}

async function expectBarRatio(figure: Locator, metric: string, unit: string, ratio: number) {
  const row = figure.locator(`[data-testid="renpho-bar"][data-metric=${JSON.stringify(metric)}][data-unit=${JSON.stringify(unit)}]`);
  const actual = await row.locator(".renpho-bar-track").evaluate(track => {
    const fill = track.querySelector("span")!;
    return fill.getBoundingClientRect().width / track.getBoundingClientRect().width;
  });
  expect(actual).toBeCloseTo(ratio, 2);
}

test("RENPHO charts select one exact reviewed report without unit conversion or older-value backfill", async ({ page }) => {
  const data = workspace(comparisonReports());
  await restoreProfile(page, data);
  const charts = page.getByRole("region", { name: "RENPHO charts", exact: true });
  await expect(charts).toBeVisible();
  const selector = charts.getByRole("combobox", { name: "RENPHO report", exact: true });
  await expect(selector.locator("option:checked")).toContainText("fictional-latest-report.pdf");
  await expect(selector.locator("option:checked")).toContainText("2026-09-04");
  await expect(selector.locator("option")).toHaveCount(5);
  await expect(selector).not.toContainText("fictional-labeled-csv.csv");
  await expect(selector).not.toContainText("fictional-other-source.csv");

  const mass = charts.getByRole("figure", { name: "Body mass measurements (lb)", exact: true });
  await expect(mass.getByTestId("renpho-bar")).toHaveCount(3);
  await expectReading(mass, "Weight", 176, "lb");
  await expectReading(mass, "Body Fat Mass", 26.4, "lb");
  await expectReading(mass, "Bone Mass", 0, "lb");
  await expect(mass).toHaveAttribute("data-axis-min", "0");
  await expect(mass).toHaveAttribute("data-axis-max", "200");
  await expectBarRatio(mass, "Weight", "lb", 0.88);
  await expectBarRatio(mass, "Body Fat Mass", "lb", 0.132);
  await expectBarRatio(mass, "Bone Mass", "lb", 0);
  await expect(mass).not.toContainText("Muscle Mass");
  const percentages = charts.getByRole("figure", { name: "Reported percentages", exact: true });
  await expectReading(percentages, "Body Fat Percentage", 15, "%");
  await expectReading(percentages, "Subcutaneous Fat", 11, "%");
  await expect(percentages.getByTestId("renpho-bar")).toHaveCount(2);
  await expect(percentages).toHaveAttribute("data-axis-min", "0");
  await expect(percentages).toHaveAttribute("data-axis-max", "100");
  await expectBarRatio(percentages, "Body Fat Percentage", "%", 0.15);
  await expectBarRatio(percentages, "Subcutaneous Fat", "%", 0.11);

  await selectReport(charts, "fictional-latest-report.pdf", "2026-09-03");
  await expectReading(mass, "Weight", 178, "lb");
  await expect(mass.getByTestId("renpho-bar")).toHaveCount(1);
  await selectReport(charts, "fictional-earlier-import.pdf", "2026-09-04");
  await expectReading(mass, "Weight", 179, "lb");
  await expectReading(mass, "Muscle Mass", 140, "lb");
  await selectReport(charts, "fictional-kg.pdf", "2026-08-15");
  await expectReading(charts.getByRole("figure", { name: "Body mass measurements (kg)", exact: true }), "Weight", 81, "kg");
  await expect(mass).toHaveCount(0);
  await expect(page.getByRole("table", { name: /Imported performance readings/ }).locator("tbody tr")).toHaveCount(data.measurements.length);
});

test("RENPHO history preserves exact dates, same-day reports, units, and source provenance", async ({ page }) => {
  await restoreProfile(page, workspace(comparisonReports()));
  const charts = page.getByRole("region", { name: "RENPHO charts", exact: true });
  const history = charts.getByRole("figure", { name: "Report history chart", exact: true });
  const measurement = charts.getByRole("combobox", { name: "History measurement", exact: true });
  await measurement.selectOption({ label: "Weight (lb)" });
  const bars = history.getByTestId("renpho-history-bar");
  await expect(bars).toHaveCount(4);
  const points = await bars.evaluateAll(rows => rows.map(row => ({
    date: row.getAttribute("data-date"), value: row.getAttribute("data-value"), unit: row.getAttribute("data-unit"),
  })));
  expect(points.map(point => point.date)).toEqual(["2026-08-01", "2026-09-03", "2026-09-04", "2026-09-04"]);
  expect(points.map(point => point.value).sort()).toEqual(["176", "178", "179", "180"]);
  expect(points.every(point => point.unit === "lb")).toBe(true);
  await expect(history).toContainText("fictional-old-lb.pdf");
  await expect(history).toContainText("fictional-earlier-import.pdf");
  await expect(history).toContainText("fictional-latest-report.pdf");
  await charts.getByText("View chart values and sources", { exact: true }).click();
  const sources = charts.getByRole("table", { name: "Values and sources for the displayed report history chart", exact: true });
  await expect(sources.locator("tbody tr")).toHaveCount(4);
  const latestSource = sources.locator("tbody tr").filter({ has: page.getByRole("cell", { name: "176", exact: true }) });
  await expect(latestSource).toContainText("2026-09-04");
  await expect(latestSource).toContainText("fictional-latest-report.pdf · RENPHO report · Page 1 · Row 1");
  await expect(history).toHaveAttribute("data-axis-min", "0");
  await expect(history).toHaveAttribute("data-axis-max", "200");

  await measurement.selectOption({ label: "Weight (kg)" });
  await expect(bars).toHaveCount(1);
  await expect(bars).toHaveAttribute("data-value", "81");
  await expect(bars).toHaveAttribute("data-unit", "kg");
  await expect(bars).toHaveAttribute("data-date", "2026-08-15");
  await expect(history).not.toContainText("180");
  await measurement.selectOption({ label: "Body Fat Percentage (%)" });
  await expect(bars).toHaveCount(5);
  await expect(history).toHaveAttribute("data-axis-min", "0");
  await expect(history).toHaveAttribute("data-axis-max", "100");
});

test("ambiguous duplicate readings are omitted from charts and remain reviewable in measurement history", async ({ page }) => {
  const reports: FictionalReport[] = [
    { hash: "a", date: "2026-08-01", importedAt: "2026-08-01T11:00:00.000Z", file: "fictional-complete.pdf",
      readings: [["Weight", 180, "lb"], ["Skeletal Muscle Mass", 75, "lb"]] },
    { hash: "b", date: "2026-09-04", importedAt: "2026-09-04T11:00:00.000Z", file: "fictional-ambiguous.pdf",
      readings: [["Weight", 176, "lb"], ["Weight", 177, "lb"], ["Weight", 80, "kg"], ["Body Fat Percentage", 15, "%"]] },
  ];
  await restoreProfile(page, workspace(reports));
  const charts = page.getByRole("region", { name: "RENPHO charts", exact: true });
  await expect(charts.locator('[data-testid="renpho-bar"][data-metric="Weight"][data-unit="lb"]')).toHaveCount(0);
  await expectReading(charts.getByRole("figure", { name: "Body mass measurements (kg)", exact: true }), "Weight", 80, "kg");
  await expect(charts.getByTestId("renpho-bar").filter({ hasText: "Skeletal Muscle Mass" })).toHaveCount(0);
  const table = page.getByRole("table", { name: /Imported performance readings/ });
  await expect(table.locator("tbody tr")).toHaveCount(6);
  await expect(table).toContainText("176");
  await expect(table).toContainText("177");
});

test("a single report has an honest baseline and accessible, unclipped charts on phone and desktop", async ({ page }) => {
  const report = comparisonReports()[3];
  await restoreProfile(page, workspace([{ ...report,
    readings: report.readings.map(([metric, value, unit]): Reading => [metric, metric === "Body Fat Percentage" ? 0 : value, unit]),
  }]));
  const charts = page.getByRole("region", { name: "RENPHO charts", exact: true });
  await expect(charts.getByRole("heading", { name: "Body mass measurements", exact: true })).toBeVisible();
  await expect(charts.getByRole("heading", { name: "Reported percentages", exact: true })).toBeVisible();
  await expect(charts.getByRole("heading", { name: "Report history", exact: true })).toBeVisible();
  await expect(charts.getByText("Your first report is the starting point. Import another report to compare dates.", { exact: true })).toBeVisible();
  await expect(charts.getByTestId("renpho-history-bar")).toHaveCount(1);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    for (const select of [charts.getByRole("combobox", { name: "RENPHO report", exact: true }), charts.getByRole("combobox", { name: "History measurement", exact: true })]) {
      await select.scrollIntoViewIfNeeded();
      await select.focus();
      await expect(select).toBeFocused();
      const bounds = await select.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    }
  }
  await charts.getByRole("combobox", { name: "History measurement", exact: true }).selectOption({ label: "Body Fat Percentage (%)" });
  const history = charts.getByRole("figure", { name: "Report history chart", exact: true });
  await expect(history).toHaveAttribute("data-axis-max", "100");
  await expect(history.getByTestId("renpho-history-bar")).toHaveAttribute("data-value", "0");
  expect(await history.locator(".renpho-bar-track > span").evaluate(fill => fill.getBoundingClientRect().width)).toBe(0);
});

test("source labels alone do not create reviewed RENPHO report charts", async ({ page }) => {
  await restoreProfile(page, workspace(comparisonReports().slice(-2)));
  await expect(page.getByRole("region", { name: "RENPHO charts", exact: true })).toHaveCount(0);
  await expect(page.getByRole("table", { name: /Imported performance readings/ }).locator("tbody tr")).toHaveCount(2);
});
