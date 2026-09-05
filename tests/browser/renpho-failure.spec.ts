import { expect, test, type Page } from "@playwright/test";

const reloadMessage = "The local text reader could not initialize. Reload this page before trying another report.";

async function openReader(page: Page) {
  await page.goto("/preview/import");
  await page.getByRole("button", { name: "RENPHO report", exact: true }).click();
  await expect(page.getByLabel("RENPHO report file", { exact: true })).toBeEnabled();
}

async function fictionalImage(page: Page) {
  const data = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 400; canvas.height = 560;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "white"; context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "black"; context.font = "20px Arial";
    context.fillText("FICTIONAL READER FAILURE TEST", 20, 70);
    return canvas.toDataURL("image/png");
  });
  return Buffer.from(data.split(",")[1], "base64");
}

test("a failed OCR model load requires reload and cannot spawn repeated worker attempts", async ({ page, context }) => {
  test.setTimeout(150_000);
  const assetRequests: string[] = [];
  let startedWorkers = 0;
  context.on("request", request => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith("/report-assets/")) assetRequests.push(path);
  });
  page.on("worker", worker => { if (worker.url().endsWith("/report-assets/worker-7.min.js")) startedWorkers++; });
  await context.route("**/report-assets/eng.traineddata.gz", route => route.fulfill({ status: 503, contentType: "text/plain", body: "Synthetic test: model unavailable." }));
  await openReader(page);
  const file = page.getByLabel("RENPHO report file", { exact: true });
  const buffer = await fictionalImage(page);
  await file.setInputFiles({ name: "fictional-first-attempt.png", mimeType: "image/png", buffer });
  await expect(page.getByRole("alert").filter({ hasText: reloadMessage })).toBeVisible({ timeout: 90_000 });
  await expect(file).toBeEnabled();
  expect(assetRequests.some(path => path.endsWith("eng.traineddata.gz"))).toBe(true);
  expect(startedWorkers).toBe(1);
  const firstAttemptAssets = [...assetRequests];

  await file.setInputFiles({ name: "fictional-retry.png", mimeType: "image/png", buffer });
  await expect(page.getByRole("alert").filter({ hasText: reloadMessage })).toBeVisible();
  await expect(file).toBeEnabled();
  expect(assetRequests).toEqual(firstAttemptAssets);
  expect(startedWorkers).toBe(1);
  await expect(page.getByRole("button", { name: "Save RENPHO readings", exact: true })).toHaveCount(0);

  // Reload resets the module guard and disposes the old page's worker.
  await page.reload();
  await page.getByRole("button", { name: "RENPHO report", exact: true }).click();
  await expect(file).toBeEnabled();
  await file.setInputFiles({ name: "fictional-after-reload.png", mimeType: "image/png", buffer });
  await expect(page.getByRole("alert").filter({ hasText: reloadMessage })).toBeVisible({ timeout: 45_000 });
  expect(startedWorkers).toBe(2);
  expect(assetRequests.filter(path => path.endsWith("eng.traineddata.gz"))).toHaveLength(2);
});

test("a stalled PDF worker is forcibly closed and its cleanup cannot hold the reader timeout open", async ({ page, context }) => {
  test.setTimeout(45_000);
  let opened = 0, closed = 0, ocrWorkers = 0;
  page.on("worker", worker => {
    if (worker.url().endsWith("/report-assets/worker-7.min.js")) ocrWorkers++;
    if (!worker.url().endsWith("/report-assets/pdf.worker-6.3.289.min.mjs")) return;
    opened++;
    worker.on("close", () => { closed++; });
  });
  // A valid local module that never answers the PDF protocol simulates a stuck
  // worker. It receives only this fictional PDF and makes no network requests.
  await context.route("**/report-assets/pdf.worker-6.3.289.min.mjs", route => route.fulfill({ status: 200, contentType: "text/javascript", body: "self.addEventListener('message', () => {});" }));
  await page.clock.install();
  await openReader(page);
  const file = page.getByLabel("RENPHO report file", { exact: true });
  await file.setInputFiles({ name: "fictional-stalled-worker.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7\n% Fictional timeout test; no report contents.\n%%EOF\n") });
  await expect.poll(() => opened).toBe(1);
  await expect(file).toBeDisabled();
  await page.clock.fastForward(180_001);
  await page.clock.fastForward(2_000);
  await expect(page.getByRole("alert").filter({ hasText: "Reading the report took too long." })).toBeVisible({ timeout: 5_000 });
  await expect(file).toBeEnabled();
  await expect.poll(() => closed).toBe(1);
  expect(ocrWorkers).toBe(0);
  await expect(page.getByRole("button", { name: "Save RENPHO readings", exact: true })).toHaveCount(0);
});

test("leaving while the OCR model is pending requires reload before another worker can start", async ({ page, context }) => {
  test.setTimeout(90_000);
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const responses: Promise<void>[] = [];
  let modelRequests = 0, startedWorkers = 0;
  page.on("worker", worker => { if (worker.url().endsWith("/report-assets/worker-7.min.js")) startedWorkers++; });
  await context.route("**/report-assets/eng.traineddata.gz", route => {
    modelRequests++;
    const response = held.then(() => route.fulfill({ status: 503, contentType: "text/plain", body: "Synthetic canceled model load." }));
    responses.push(response);
    return response;
  });
  try {
    await openReader(page);
    const buffer = await fictionalImage(page);
    await page.getByLabel("RENPHO report file", { exact: true }).setInputFiles({ name: "fictional-pending-reader.png", mimeType: "image/png", buffer });
    await expect.poll(() => modelRequests, { timeout: 60_000 }).toBe(1);
    expect(startedWorkers).toBe(1);

    // Client navigation unmounts the reader and aborts it while retaining the page's
    // loaded modules, exactly the case that must not start a second pending worker.
    await page.locator('a[href="/preview/roster"]').first().click();
    await expect(page).toHaveURL(/\/preview\/roster$/);
    await page.locator('a[href="/preview/import"]').first().click();
    await page.getByRole("button", { name: "RENPHO report", exact: true }).click();
    const file = page.getByLabel("RENPHO report file", { exact: true });
    await expect(file).toBeEnabled();
    await file.setInputFiles({ name: "fictional-after-cancel.png", mimeType: "image/png", buffer });
    await expect(page.getByRole("alert").filter({ hasText: reloadMessage })).toBeVisible();
    await expect(file).toBeEnabled();
    expect(startedWorkers).toBe(1);
    expect(modelRequests).toBe(1);
  } finally {
    release();
    await Promise.allSettled(responses);
  }
});
