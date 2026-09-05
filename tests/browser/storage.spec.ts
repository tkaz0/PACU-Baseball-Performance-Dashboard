import { test, expect, type Page } from "./local-admin";

const sampleBanner = "Sample roster · Fictional athletes · Administrator workspace";
const approval = "I reviewed the rows and approve saving this import in this browser.";
const firstAthlete = {
  code: "SYN-STORAGE-001", first: "Fictional BrowserOne", last: "StorageSentinel",
  email: "fictional.browser.one@example.com", fileName: "fictional-storage-one.csv",
};
const secondAthlete = {
  code: "SYN-STORAGE-002", first: "Fictional BrowserTwo", last: "StorageSentinel",
  email: "fictional.browser.two@example.com", fileName: "fictional-storage-two.csv",
};
type FictionalAthlete = typeof firstAthlete;

async function prepareRosterPreview(page: Page, athlete: FictionalAthlete) {
  await page.goto("/preview/import");
  await expect(page.getByLabel("Spreadsheet file", { exact: true })).toBeEnabled();
  const csv = [
    "athlete_code,first_name,last_name,pacific_email,jersey_number",
    `${athlete.code},${athlete.first},${athlete.last},${athlete.email},0`,
  ].join("\n");
  await page.getByLabel("Spreadsheet file", { exact: true }).setInputFiles({
    name: athlete.fileName, mimeType: "text/csv", buffer: Buffer.from(csv),
  });
  await page.getByRole("button", { name: "Validate and preview", exact: true }).click();
  await expect(page.getByRole("heading", { name: "3. Review and save", exact: true })).toBeVisible();
  const preview = page.getByRole("table", { name: "Import row validation and proposed changes", exact: true });
  await expect(preview.locator("tbody tr")).toHaveCount(1);
  await expect(preview.locator("tbody tr")).toContainText(athlete.code);
  await expect(page.getByRole("button", { name: "Apply reviewed import", exact: true })).toBeDisabled();
}

async function applyPreview(page: Page, athlete: FictionalAthlete) {
  await page.getByLabel(approval, { exact: true }).check();
  await page.getByRole("button", { name: "Apply reviewed import", exact: true }).click();
  await expect(page.getByText(`${athlete.fileName} was saved in this browser.`, { exact: true })).toBeVisible();
}

async function storedSummary(page: Page) {
  return page.evaluate(async () => {
    // Read the real application database; the app has already opened and initialized it.
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open("pacu-local-workspace-v1", 1);
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    try {
      return await new Promise<{ revision: number; mode: string; codes: string[]; batches: number; measurements: number } | null>((resolve, reject) => {
        const read = db.transaction("workspace", "readonly").objectStore("workspace").get("current");
        read.onsuccess = () => {
          const saved = read.result;
          resolve(saved ? {
            revision: saved.revision, mode: saved.mode,
            codes: saved.roster.map((athlete: { athlete_code: string }) => athlete.athlete_code),
            batches: saved.batches.length, measurements: saved.measurements.length,
          } : null);
        };
        read.onerror = () => reject(read.error);
      });
    } finally { db.close(); }
  });
}

test("canceling a roster preview changes no saved data and a local import sends no file values", async ({ page, context }) => {
  const violations: string[] = [];
  const sentinels = [firstAthlete.code, firstAthlete.first, firstAthlete.last, firstAthlete.email, firstAthlete.fileName];
  context.on("request", request => {
    const url = new URL(request.url());
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) violations.push(`Unexpected ${request.method()} request to ${url.pathname}`);
    if (url.hostname.includes("supabase")) violations.push("Unexpected Supabase request");
    const content = [request.url(), request.postData() ?? "", JSON.stringify(request.headers())].join("\n");
    if (sentinels.some(value => content.includes(value) || content.includes(encodeURIComponent(value)))) violations.push("A request contained a fictional file value");
  });

  await prepareRosterPreview(page, firstAthlete);
  expect(await storedSummary(page)).toBeNull();
  // Leaving the review without approval is cancellation; no save control is submitted.
  await page.locator('a[href="/preview/roster"]').first().click();
  await expect(page.getByText(sampleBanner, { exact: true })).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(10);
  expect(await storedSummary(page)).toBeNull();

  await prepareRosterPreview(page, firstAthlete);
  await applyPreview(page, firstAthlete);
  expect(await storedSummary(page)).toEqual({ revision: 1, mode: "local", codes: [firstAthlete.code], batches: 1, measurements: 0 });
  expect(violations).toEqual([]);
});

test("a committed import invalidates another tab's preview while a separate browser stays independent", async ({ page, context, browser, baseURL }) => {
  const secondPage = await context.newPage();
  const isolated = await browser.newContext({ baseURL, storageState: await context.storageState() });
  try {
    await prepareRosterPreview(page, firstAthlete);
    await prepareRosterPreview(secondPage, secondAthlete);
    await secondPage.getByLabel(approval, { exact: true }).check();
    await expect(secondPage.getByRole("button", { name: "Apply reviewed import", exact: true })).toBeEnabled();

    await applyPreview(page, firstAthlete);
    await expect(secondPage.getByRole("alert").filter({ hasText: "Your workspace changed after this preview." })).toBeVisible();
    await expect(secondPage.getByRole("button", { name: "Apply reviewed import", exact: true })).toBeDisabled();
    expect(await storedSummary(secondPage)).toEqual({ revision: 1, mode: "local", codes: [firstAthlete.code], batches: 1, measurements: 0 });

    await secondPage.goto("/preview/roster");
    await expect(secondPage.locator("tbody tr")).toHaveCount(1);
    await expect(secondPage.locator("tbody tr")).toContainText(firstAthlete.code);
    await expect(secondPage.getByText(secondAthlete.code, { exact: true })).toHaveCount(0);

    const otherBrowser = await isolated.newPage();
    await otherBrowser.goto("/preview/roster");
    await expect(otherBrowser.getByText(sampleBanner, { exact: true })).toBeVisible();
    await expect(otherBrowser.locator("tbody tr")).toHaveCount(10);
    expect(await storedSummary(otherBrowser)).toBeNull();
  } finally {
    await secondPage.close();
    await isolated.close();
  }
});

test("an aborted IndexedDB write reports failure and preserves the sample roster after reload", async ({ page }) => {
  await prepareRosterPreview(page, firstAthlete);
  expect(await storedSummary(page)).toBeNull();
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value: unknown, key?: IDBValidKey) {
      const request = original.call(this, value, key);
      if (this.name === "workspace") {
        IDBObjectStore.prototype.put = original;
        // Abort after queuing the actual put, exercising transaction rollback and onabort.
        this.transaction.abort();
        document.documentElement.dataset.pacuStorageAborted = "true";
      }
      return request;
    };
  });
  await page.getByLabel(approval, { exact: true }).check();
  await page.getByRole("button", { name: "Apply reviewed import", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-pacu-storage-aborted", "true");
  await expect(page.getByRole("alert").filter({ hasText: "Could not save. Your previous data is unchanged." })).toBeVisible();
  await expect(page.getByText(`${firstAthlete.fileName} was saved in this browser.`, { exact: true })).toHaveCount(0);
  expect(await storedSummary(page)).toBeNull();

  await page.reload();
  await expect(page.getByText(sampleBanner, { exact: true })).toBeVisible();
  await page.locator('a[href="/preview/roster"]').first().click();
  await expect(page.locator("tbody tr")).toHaveCount(10);
  await expect(page.getByText(firstAthlete.code, { exact: true })).toHaveCount(0);
  expect(await storedSummary(page)).toBeNull();
});
