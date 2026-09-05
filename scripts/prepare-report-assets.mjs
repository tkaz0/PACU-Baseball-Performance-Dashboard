import { mkdir, copyFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

// Serve all OCR/PDF runtime files from this app. Report bytes never go to a CDN.
const require = createRequire(import.meta.url);
const output = new URL("../public/report-assets/", import.meta.url);
await mkdir(output, { recursive: true });
const tessRoot = dirname(require.resolve("tesseract.js/package.json"));
const tessRequire = createRequire(join(tessRoot, "package.json"));
const coreRoot = dirname(tessRequire.resolve("tesseract.js-core/package.json"));
await copyFile(join(tessRoot, "dist/worker.min.js"), new URL("worker-7.min.js", output));
for (const file of await readdir(coreRoot)) {
  if (/^tesseract-core.*\.wasm(?:\.js)?$/.test(file)) await copyFile(join(coreRoot, file), new URL(file, output));
}
const langRoot = dirname(require.resolve("@tesseract.js-data/eng/package.json"));
await copyFile(join(langRoot, "4.0.0_best_int/eng.traineddata.gz"), new URL("eng.traineddata.gz", output));
const pdfRoot = dirname(require.resolve("pdfjs-dist/package.json"));
await copyFile(join(pdfRoot, "build/pdf.worker.min.mjs"), new URL("pdf.worker-6.3.289.min.mjs", output));
for (const subdir of ["standard_fonts", "wasm"]) {
  await mkdir(new URL(subdir + "/", output), { recursive: true });
  for (const file of await readdir(join(pdfRoot, subdir))) await copyFile(join(pdfRoot, subdir, file), new URL(subdir + "/" + file, output));
}
