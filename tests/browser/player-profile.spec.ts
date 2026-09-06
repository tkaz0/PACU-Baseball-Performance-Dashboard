import { expect, test, type Page } from "./local-admin";
import { mkdir } from "node:fs/promises";
import type { LocalWorkspace } from "../../lib/local-workspace";

// Fictional team and measurements only, restored through the normal reviewed UI.
function fictionalPerformanceWorkspace(): LocalWorkspace {
  const names = ["Avery Northstar", "Blake Cloudfield", "Casey Brookstone", "Drew Starling", "Elliot Sunfield", "Finley Westbrook"];
  const roster = names.map((name, index) => {
    const [first, last] = name.split(" ");
    const code = `SYN-${String(index + 1).padStart(3, "0")}`;
    return { id: code, athlete_code: code, first_name: `Fictional ${first}`, preferred_name: first, last_name: last,
      pacific_email: `fictional.${first.toLowerCase()}@example.com`, profile_photo_url: null, created_at: "", updated_at: "",
      athlete_seasons: [{ athlete_id: code, season: "2026-27", jersey_number: index, primary_position: "CF", secondary_position: null,
        player_type: "position", bats: "L", throws: "R", academic_class: "freshman", eligibility_year: 1, graduation_year: 2030, roster_status: "active" }] };
  });
  const batches: LocalWorkspace["batches"] = roster.map((_, index) => ({ id: `fictional-body-${index}`, kind: "measurements", fileName: `fictional-body-${index}.png`,
    fileHash: "abcdef"[index].repeat(64), source: "RENPHO", importedAt: "2026-09-04T00:00:00.000Z", created: 3, updated: 0, unchanged: 0 }));
  batches.push({ id: "fictional-testing", kind: "measurements", fileName: "fictional-testing.csv", fileHash: "f".repeat(64), source: "Fictional testing",
    importedAt: "2026-09-04T00:00:00.000Z", created: 15, updated: 0, unchanged: 0 });
  const measurements = roster.flatMap((athlete, index) => {
    const body = ([ ["Weight", 170 + index * 3, "lb"], ["Body Fat Percentage", 11 + index, "%"], ["Muscle Mass", 130 + index, "lb"] ] as const).map(([metric, value, unit], row) => ({
      id: `fictional-body-${index}-${row}`, athlete_code: athlete.athlete_code, measured_at: "2026-08-09", source: "RENPHO", metric, value, unit,
      source_file: `fictional-body-${index}.png`, source_sheet: "RENPHO report · Page 1", source_row: row + 1, file_hash: "abcdef"[index].repeat(64), batch_id: `fictional-body-${index}`,
    }));
    const testing = ([ ["Max Exit Velocity", 90 + index, "mph"], ["Home to First", 4.5 - index / 10, "s"], ...(index < 3 ? [["Average Exit Velocity", 80 + index, "mph"]] : []) ] as [string, number, string][]).map(([metric, value, unit], row) => ({
      id: `fictional-testing-${index}-${row}`, athlete_code: athlete.athlete_code, measured_at: "2026-09-03", source: "Fictional testing", metric, value, unit,
      source_file: "fictional-testing.csv", source_sheet: "CSV", source_row: index * 3 + row + 2, file_hash: "f".repeat(64), batch_id: "fictional-testing",
    }));
    return [...body, ...testing];
  });
  return { version: 1, revision: 0, mode: "local", roster, batches, measurements };
}

async function restoreAndPreviewPlayer(page: Page) {
  await page.goto("/preview/import");
  const restoreFile = page.getByLabel("Restore workspace JSON backup", { exact: true });
  await expect(restoreFile).toBeEnabled();
  await restoreFile.setInputFiles({ name: "fictional-performance-backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(fictionalPerformanceWorkspace())) });
  await page.getByLabel("Replace this browser's roster, measurements, and import history with this backup.", { exact: true }).check();
  await page.getByRole("button", { name: "Restore backup", exact: true }).click();
  await expect(page.getByText("Backup restored in this browser.", { exact: true })).toBeVisible();
  await page.locator("details.view-menu > summary").click();
  await page.getByRole("combobox", { name: "Player to preview", exact: true }).selectOption("SYN-001");
  await page.getByRole("button", { name: "Preview player", exact: true }).click();
  await expect(page.getByText("Viewing as: Player", { exact: true })).toBeVisible();
}

test("player snapshot shows exact own readings and team percentiles without peer records or admin fields", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await restoreAndPreviewPlayer(page);
  const profile = page.getByTestId("player-performance-profile");
  await expect(profile.getByRole("heading", { name: "Avery Northstar", exact: true })).toBeVisible();
  await expect(profile.locator("dt").filter({ hasText: /^Jersey Number$/ }).locator("+ dd")).toHaveText("0");
  for (const text of ["fictional.avery@example.com", "Eligibility year", "Blake Cloudfield", "Account and roster details"]) await expect(page.locator("main")).not.toContainText(text);
  await expect(profile.getByRole("heading", { name: "Pitching", exact: true, includeHidden: true })).toHaveCount(0);
  await profile.getByRole("tab", { name: "Hitting", exact: true }).click();
  const max = profile.getByTestId("player-metric").filter({ has: page.locator('h3', { hasText: /^Max EV$/ }) });
  await expect(max).toHaveAttribute("data-value", "90");
  await expect(max).toHaveAttribute("data-unit", "mph");
  await expect(max).toHaveAttribute("data-date", "2026-09-03");
  await expect(max).toContainText("Pacific n=6");
  await expect(max.getByRole("meter")).toHaveAttribute("aria-valuenow", "0");
  const average = profile.getByTestId("player-metric").filter({ has: page.locator('h3', { hasText: /^Average EV$/ }) });
  await expect(average).toHaveAttribute("data-value", "80");
  await expect(average).not.toContainText("Need 5 comparable players");
  await expect(average.getByRole("meter")).toHaveCount(0);
  await profile.getByRole("tab", { name: "Physicality", exact: true }).click();
  const body = profile.getByTestId("player-metric").filter({ has: page.locator('h3', { hasText: /^Weight$/ }) });
  await expect(body).toHaveAttribute("data-value", "170");
  await expect(body).toHaveAttribute("data-date", "2026-08-09");
  await expect(body).toContainText("Last Tested: Aug 9, 2026");
  await expect(body.getByTestId("player-percentile")).toHaveAttribute("data-direction", "neutral");
  await profile.getByRole("tab", { name: "Hitting", exact: true }).click();
  const missing = profile.getByTestId("player-metric").filter({ has: page.locator('h3', { hasText: /^Max Bat Speed$/ }) });
  await expect(missing).toContainText("Not Yet Tested");
  await expect(missing.getByRole("meter")).toHaveCount(0);
  await expect(profile.getByTestId("player-performance-methods")).not.toHaveAttribute("open", "");

  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await profile.getByTestId("player-metric").evaluateAll(rows => rows.every(row => row.scrollWidth <= row.clientWidth))).toBe(true);
    if (process.env.PACU_PROFILE_SCREENSHOTS === "1") {
      await mkdir("work/player-profile-review", { recursive: true });
      await page.screenshot({ path: `work/player-profile-review/player-${width}.png`, fullPage: true });
    }
  }
  expect(errors).toEqual([]);
});

test("players can expand their full RENPHO charts, own history and source methods", async ({ page }) => {
  await restoreAndPreviewPlayer(page);
  const charts = page.getByRole("region", { name: "RENPHO charts", exact: true });
  await expect(charts).not.toBeVisible();
  await page.getByRole("tab", { name: "Physicality", exact: true }).click();
  await page.getByText("Full RENPHO charts & report history", { exact: true }).click();
  await expect(charts).toBeVisible();
  await page.locator("#performance-history > summary").click();
  const history = page.getByRole("table", { name: "Imported performance readings for Avery Northstar", exact: true });
  await expect(history.locator("tbody tr")).toHaveCount(6);
  await expect(history).not.toContainText("fictional-body-1.png");
  await page.getByText("Sources & Percentiles", { exact: true }).click();
  const sources = page.getByRole("table", { name: "Sources for the performance snapshot", exact: true });
  await expect(sources).toBeVisible();
  await expect(sources).toContainText("Muscle mass ÷ weight × 100");
  await expect(sources).not.toContainText("fictional-body-1.png");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});


test("profile tabs have keyboard selection and only the chosen panel is visible", async ({ page }) => {
  await restoreAndPreviewPlayer(page);
  const profile=page.getByTestId("player-performance-profile"),physicality=profile.getByRole("tab",{name:"Physicality",exact:true});
  const overview=profile.getByRole("tab",{name:"Overview",exact:true});
  await expect(overview).toHaveAttribute("aria-selected","true");
  await expect(profile.getByRole("tabpanel",{name:"Overview",exact:true})).toBeVisible();
  await overview.focus();await page.keyboard.press("ArrowRight");
  await expect(physicality).toBeFocused();
  await expect(profile.getByRole("tabpanel",{name:"Physicality",exact:true})).toBeVisible();
  await physicality.focus();await page.keyboard.press("ArrowRight");
  await expect(profile.getByRole("tab",{name:"Hitting",exact:true})).toBeFocused();
  await expect(profile.getByRole("tabpanel",{name:"Hitting",exact:true})).toBeVisible();
  await expect(profile.getByRole("tabpanel",{name:"Physicality",exact:true,includeHidden:true})).not.toBeVisible();
  await page.keyboard.press("End");await expect(profile.getByRole("tab",{name:"Throwing",exact:true})).toBeFocused();
  await expect(profile.getByRole("heading",{name:"Outfield Velocity",exact:true})).toBeVisible();
  await expect(profile.getByRole("heading",{name:"Infield Velocity",exact:true})).toHaveCount(0);
  await page.keyboard.press("Home");await expect(overview).toBeFocused();
  await page.keyboard.press("ArrowLeft");await expect(profile.getByRole("tab",{name:"Throwing",exact:true})).toBeFocused();
});
