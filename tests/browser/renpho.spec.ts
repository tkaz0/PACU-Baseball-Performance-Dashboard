import { expect, test, type Page } from "@playwright/test";

// Draw a complete, fictional portrait report in the supported layout. This exercises
// the installed OCR worker; it does not mock recognition or use any private report.
async function fictionalReport(page: Page, mimeType: "image/png" | "image/jpeg" = "image/png"): Promise<Buffer> {
  const dataURL = await page.evaluate(mimeType => {
    const canvas = document.createElement("canvas");
    canvas.width = 1900; canvas.height = 2600;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#111"; ctx.textBaseline = "middle";
    const text = (value: string, x: number, y: number, size = 26) => {
      ctx.font = `${size}px Arial`; ctx.fillText(value, x, y);
    };
    text("RENPHO", 80, 115, 42);
    text("Body Composition Analysis Report", 550, 115, 43);
    text("ID: FICTIONAL-OCR-01     Test Date: September 4, 2026 at 1:02:03 PM", 90, 242, 28);
    text("Measurement(kg)", 368, 380, 25);
    text("Optimal Range", 730, 380, 25);
    text("Evaluation", 1000, 380, 25);
    const labels = ["Weight", "Body Fat Mass", "Bone Mass", "Protein Mass", "Body Water Mass", "Muscle Mass", "Skeletal Muscle Mass"];
    const values = ["80.0", "12.0", "3.0", "14.0", "42.0", "61.0", "34.0"];
    const edges = [.1584, .1824, .2065, .2305, .2545, .2785, .301, .324];
    labels.forEach((label, index) => {
      const y = (edges[index] + edges[index + 1]) / 2 * canvas.height;
      text(label, 85, y, 24); text(values[index], 430, y, 29);
      text("999 - 9999", 730, y, 24); text("Reference only", 1000, y, 22);
    });
    text("BMI 24.0", 1260, 990, 29);
    text("Body Fat Percentage 15.0 %", 1260, 1080, 29);
    ["Visceral Fat 8", "BMR 1750 kcal", "Fat-Free Mass 68.0 kg", "Subcutaneous Fat 12.0 %", "SMI 8.4 kg/m2", "Metabolic Age 22", "WHR 0.85"].forEach((value, index) => text(value, 1260, 2160 + index * 44, 27));
    text("FICTIONAL REPORT FOR SOFTWARE TESTING ONLY", 100, 1500, 30);
    text("No real athlete, account, or medical record", 100, 1560, 26);
    return canvas.toDataURL(mimeType, 1);
  }, mimeType);
  return Buffer.from(dataURL.split(",")[1], "base64");
}

// Minimal image-only PDF: exact byte offsets, one shared JPEG XObject, no scripts,
// remote resources, font dependencies, metadata, or third-party fixture files.
function imagePDF(jpeg: Buffer, pageCount = 1): Buffer {
  const imageId = 3 + pageCount;
  const contentId = imageId + 1;
  const content = Buffer.from("q\n570 0 0 780 0 0 cm\n/ReportImage Do\nQ\n");
  const objects: Buffer[] = [
    Buffer.from("<< /Type /Catalog /Pages 2 0 R >>"),
    Buffer.from(`<< /Type /Pages /Count ${pageCount} /Kids [${Array.from({ length: pageCount }, (_, index) => `${index + 3} 0 R`).join(" ")}] >>`),
    ...Array.from({ length: pageCount }, () => Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 570 780] /Resources << /XObject << /ReportImage ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`)),
    Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width 1900 /Height 2600 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`), jpeg, Buffer.from("\nendstream")]),
    Buffer.concat([Buffer.from(`<< /Length ${content.length} >>\nstream\n`), content, Buffer.from("endstream")]),
  ];
  const chunks = [Buffer.from("%PDF-1.7\n%\xE2\xE3\xCF\xD3\n", "latin1")];
  const offsets: number[] = [];
  let offset = chunks[0].length;
  objects.forEach((object, index) => {
    offsets.push(offset);
    const chunk = Buffer.concat([Buffer.from(`${index + 1} 0 obj\n`), object, Buffer.from("\nendobj\n")]);
    chunks.push(chunk); offset += chunk.length;
  });
  chunks.push(Buffer.from(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(value => `${String(value).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF\n`));
  return Buffer.concat(chunks);
}

test("RENPHO OCR stays local and requires reviewed identity, date, values and current workspace before saving", async ({ page, context }) => {
  test.setTimeout(240_000);
  const network: { origin: string; path: string; method: string; hasBody: boolean }[] = [];
  context.on("request", request => {
    if (!/^https?:/.test(request.url())) return;
    const url = new URL(request.url());
    network.push({ origin: url.origin, path: url.pathname, method: request.method(), hasBody: !!request.postDataBuffer()?.length });
  });
  await page.goto("/preview/import");
  await page.getByRole("button", { name: "RENPHO report", exact: true }).click();
  const file = page.getByLabel("RENPHO report file", { exact: true });
  await expect(file).toBeEnabled();
  await file.setInputFiles({ name: "fictional-renpho-report.png", mimeType: "image/png", buffer: await fictionalReport(page) });
  await expect(page.getByLabel("RENPHO report ID", { exact: true })).toHaveValue("FICTIONAL-OCR-01", { timeout: 150_000 });
  await expect(page.getByLabel("Report test date", { exact: true })).toHaveValue("2026-09-04");
  await expect(page.getByRole("table", { name: "Readings extracted from your RENPHO report" }).locator("tbody tr")).toHaveCount(16);
  await expect(page.getByLabel("Weight value", { exact: true })).toHaveValue("80.0");
  await expect(page.getByRole("combobox", { name: "Player for this report", exact: true })).toHaveValue("");
  await expect(page.getByRole("button", { name: "Review import", exact: true })).toBeDisabled();

  await page.getByRole("combobox", { name: "Player for this report", exact: true }).selectOption("SYN-001");
  await page.getByLabel("Report test date", { exact: true }).fill("2026-09-03");
  await page.getByLabel("Remember this report ID for the selected player in this browser.", { exact: true }).check();
  await page.getByLabel("Weight value", { exact: true }).fill("not-a-number");
  await page.getByRole("button", { name: "Review import", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Check the number for Weight." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save RENPHO readings", exact: true })).toHaveCount(0);
  await page.getByLabel("Weight value", { exact: true }).fill("80.25");
  await page.getByRole("button", { name: "Review import", exact: true }).click();
  await expect(page.getByText("16 new readings ready", { exact: true })).toBeVisible();
  const confirmation = page.getByLabel("I checked the player, test date, units, and selected values against the original report.", { exact: true });
  await expect(page.getByRole("button", { name: "Save RENPHO readings", exact: true })).toBeDisabled();
  await confirmation.check();
  await expect(page.getByRole("button", { name: "Save RENPHO readings", exact: true })).toBeEnabled();
  await page.getByLabel("Weight value", { exact: true }).fill("80.5");
  await expect(confirmation).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save RENPHO readings", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Review import", exact: true }).click();
  await confirmation.check();

  // A second tab changes the actual IndexedDB revision while this preview is open.
  const second = await context.newPage();
  await second.goto("/preview/import");
  await second.getByLabel("Clear the saved roster, measurements, and import history from this browser.", { exact: true }).check();
  await second.getByRole("button", { name: "Reset browser workspace", exact: true }).click();
  await expect(second.getByText("This browser workspace has been reset to the fictional sample roster.", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "Your workspace changed. Review the import again before saving." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save RENPHO readings", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Review import", exact: true }).click();
  await expect(confirmation).not.toBeChecked();
  await confirmation.check();
  await page.getByRole("button", { name: "Save RENPHO readings", exact: true }).click();
  const profileLink = page.getByRole("link", { name: "Open player profile →", exact: true });
  await expect(profileLink).toHaveAttribute("href", "/preview/athletes/SYN-001");
  await expect(page.getByText("Matched to a saved RENPHO ID. Confirm this is the correct player.", { exact: true })).toBeVisible();
  const profileOpened = context.waitForEvent("page");
  await profileLink.click({ modifiers: ["ControlOrMeta"] });
  const profile = await profileOpened;
  await expect(profile).toHaveURL(/\/preview\/athletes\/SYN-001$/);
  await profile.reload();
  const readings = profile.getByRole("table", { name: /Imported performance readings/ });
  await expect(readings.locator("tbody tr")).toHaveCount(16);
  const weight = readings.locator("tbody tr").filter({ has: profile.getByRole("cell", { name: "Weight", exact: true }) });
  await expect(weight).toContainText("80.5");
  await expect(weight).toContainText("kg");
  await expect(weight).toContainText("2026-09-03");
  await expect(readings).not.toContainText("9999");

  await page.getByRole("button", { name: "Review import", exact: true }).click();
  await expect(page.getByText("0 new readings ready", { exact: true })).toBeVisible();
  await expect(page.getByText("These readings are already imported. Nothing new will be saved.", { exact: true })).toBeVisible();
  await confirmation.check();
  await expect(page.getByRole("button", { name: "Save RENPHO readings", exact: true })).toBeDisabled();
  await page.getByRole("combobox", { name: "Player for this report", exact: true }).selectOption("SYN-002");
  await expect(page.getByRole("alert").filter({ hasText: "This RENPHO ID is already linked to another player." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Review import", exact: true })).toBeDisabled();

  const appOrigin = new URL(page.url()).origin;
  expect(network.filter(request => request.origin !== appOrigin)).toEqual([]);
  expect(network.filter(request => request.hasBody)).toEqual([]);
  expect(network.filter(request => !["GET", "HEAD"].includes(request.method))).toEqual([]);
  expect(network.some(request => request.path === "/report-assets/worker-7.min.js")).toBe(true);
  expect(network.some(request => request.path.includes("/report-assets/") && request.path.includes("eng.traineddata"))).toBe(true);
});

test("RENPHO renders a one-page PDF locally before OCR and rejects two pages before starting OCR", async ({ page, context }) => {
  test.setTimeout(240_000);
  const network: { origin: string; path: string; method: string; hasBody: boolean }[] = [];
  context.on("request", request => {
    if (!/^https?:/.test(request.url())) return;
    const url = new URL(request.url());
    network.push({ origin: url.origin, path: url.pathname, method: request.method(), hasBody: !!request.postDataBuffer()?.length });
  });
  await page.goto("/preview/import");
  await page.getByRole("button", { name: "RENPHO report", exact: true }).click();
  const file = page.getByLabel("RENPHO report file", { exact: true });
  await expect(file).toBeEnabled();
  const jpeg = await fictionalReport(page, "image/jpeg");
  await file.setInputFiles({ name: "fictional-one-page.pdf", mimeType: "application/pdf", buffer: imagePDF(jpeg) });
  await expect(page.getByLabel("RENPHO report ID", { exact: true })).toHaveValue("FICTIONAL-OCR-01", { timeout: 150_000 });
  await expect(page.getByLabel("Report test date", { exact: true })).toHaveValue("2026-09-04");
  await expect(page.getByRole("table", { name: "Readings extracted from your RENPHO report" }).locator("tbody tr")).toHaveCount(16);
  await expect(page.getByLabel("Weight value", { exact: true })).toHaveValue("80.0");
  expect(network.some(request => request.path === "/report-assets/pdf.worker-6.3.289.min.mjs")).toBe(true);
  expect(network.some(request => request.path === "/report-assets/worker-7.min.js")).toBe(true);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await expect(page.getByLabel("Weight value", { exact: true })).toBeVisible();
  }

  const ocrRequestCount = () => network.filter(request => /\/report-assets\/(?:worker-7|tesseract-core|eng\.traineddata)/.test(request.path)).length;
  const beforeRejectedFile = ocrRequestCount();
  await file.setInputFiles({ name: "fictional-two-pages.pdf", mimeType: "application/pdf", buffer: imagePDF(jpeg, 2) });
  await expect(page.getByRole("alert").filter({ hasText: "Choose a single-page report." })).toBeVisible();
  await expect(page.getByRole("table", { name: "Readings extracted from your RENPHO report" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Review import", exact: true })).toHaveCount(0);
  expect(ocrRequestCount()).toBe(beforeRejectedFile);
  const appOrigin = new URL(page.url()).origin;
  expect(network.filter(request => request.origin !== appOrigin)).toEqual([]);
  expect(network.filter(request => request.hasBody)).toEqual([]);
  expect(network.filter(request => !["GET", "HEAD"].includes(request.method))).toEqual([]);
});
