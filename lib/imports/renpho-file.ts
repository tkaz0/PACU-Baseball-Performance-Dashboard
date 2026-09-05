import type { PDFDocumentLoadingTask, PDFWorker, RenderTask } from "pdfjs-dist";
import type { Worker as OcrWorker } from "tesseract.js";
import { parseRenphoRegions, type RenphoParsedReport, type RenphoRegions } from "./renpho";

export type RenphoReportFile = { fileName: string; fileHash: string; parsed: RenphoParsedReport; previewUrl: string };

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_PIXELS = 25_000_000;
const RENDER_WIDTH = 1900;
const MAX_OCR_WORDS = 20000;
const MAX_OCR_CHARACTERS = 100000;
const OCR_RELOAD_MESSAGE = "The local text reader could not initialize. Reload this page before trying another report.";
// Tesseract exposes no termination handle until initialization finishes. If its
// initialization fails, a page reload is required before another worker is started.
let ocrReloadRequired = false;
const ROW_EDGES = [.1584, .1824, .2065, .2305, .2545, .2785, .301, .324] as const;
type Region = readonly [left: number, top: number, right: number, bottom: number];
type OcrWord = { text: string; x: number; y: number; height: number; bounds: { x0: number; x1: number; y0: number; y1: number } };

class ReportReadError extends Error {}
const aborted = () => new DOMException("Report reading was canceled.", "AbortError");
function checkAbort(signal?: AbortSignal) { if (signal?.aborted) throw aborted(); }

function cancellable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) { void promise.catch(() => {}); return Promise.reject(aborted()); }
  return new Promise((resolve, reject) => {
    const cancel = () => reject(aborted());
    signal.addEventListener("abort", cancel, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", cancel));
  });
}

async function boundedCleanup(promise: Promise<unknown>): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([promise.catch(() => {}), new Promise<void>(resolve => { timer = setTimeout(resolve, 1000); })]);
  } finally { if (timer) clearTimeout(timer); }
}

function checkDimensions(width: number, height: number, requirePortrait: boolean) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || width * height > MAX_PIXELS) {
    throw new ReportReadError("Use a report image no larger than 25 megapixels.");
  }
  if (requirePortrait && (width / height < .6 || width / height > .85)) {
    throw new ReportReadError("Choose the full, upright portrait report page with its original margins. Cropped or landscape images are not supported.");
  }
}

/** Check raster dimensions before decoding a potentially highly compressed image. */
function imageDimensions(bytes: Uint8Array, kind: "png" | "jpeg"): [number, number] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (kind === "png") {
    if (bytes.length < 33 || view.getUint32(8) !== 13 || view.getUint32(12) !== 0x49484452) throw new ReportReadError("The PNG image is invalid. Export a fresh full-page image.");
    return [view.getUint32(16), view.getUint32(20)];
  }
  let position = 2;
  while (position < bytes.length) {
    if (bytes[position++] !== 0xff) break;
    while (position < bytes.length && bytes[position] === 0xff) position++;
    const marker = bytes[position++];
    if (marker === 0xd9 || marker === 0xda || marker === undefined) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (position + 2 > bytes.length) break;
    const length = view.getUint16(position);
    if (length < 2 || position + length > bytes.length) break;
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      if (length < 8) break;
      return [view.getUint16(position + 5), view.getUint16(position + 3)];
    }
    position += length;
  }
  throw new ReportReadError("The JPEG image is invalid. Export a fresh full-page image.");
}

function regionText(words: OcrWord[], region: Region, width: number, height: number): string {
  const selected = words.filter(word => word.x >= region[0] * width && word.x < region[2] * width && word.y >= region[1] * height && word.y < region[3] * height)
    .sort((a, b) => a.y - b.y || a.x - b.x);
  if (!selected.length) return "";
  const heights = selected.map(word => word.height).sort((a, b) => a - b);
  const tolerance = Math.max(3, heights[Math.floor(heights.length / 2)] * .6);
  const lines: { y: number; words: OcrWord[] }[] = [];
  for (const word of selected) {
    const line = lines.at(-1);
    if (line && Math.abs(line.y - word.y) <= tolerance) {
      line.y = (line.y * line.words.length + word.y) / (line.words.length + 1);
      line.words.push(word);
    } else lines.push({ y: word.y, words: [word] });
  }
  return lines.map(line => line.words.sort((a, b) => a.x - b.x).map(word => word.text).join(" ")).join("\n");
}

function extractRegions(words: OcrWord[], canvas: HTMLCanvasElement): RenphoRegions {
  const text = (region: Region) => regionText(words, region, canvas.width, canvas.height);
  return {
    title: text([.275, .025, .99, .063]).replace(/\n/g, " "),
    header: text([.035, .081, .98, .104]),
    compositionHeader: text([.187, .133, .333, .158]),
    compositionRows: ROW_EDGES.slice(0, -1).map((top, index) => ({
      label: text([.038, top, .187, ROW_EDGES[index + 1]]),
      measurement: text([.187, top, .333, ROW_EDGES[index + 1]]),
      line: index + 1,
    })),
    assessment: text([.645, .353, .97, .477]),
    indicators: text([.645, .811, .97, .955]),
  };
}

/** Isolate a genuinely printed raised glyph; do not insert an expected exponent. */
function superscriptGlyph(source: HTMLCanvasElement | ImageBitmap, word: OcrWord, page: HTMLCanvasElement): HTMLCanvasElement | null {
  const scaleX = source.width / page.width, scaleY = source.height / page.height;
  const left = Math.max(0, Math.floor((word.bounds.x0 - 2) * scaleX));
  const top = Math.max(0, Math.floor((word.bounds.y0 - 10) * scaleY));
  const width = Math.min(source.width - left, Math.ceil((word.bounds.x1 - word.bounds.x0 + 4) * scaleX));
  const height = Math.min(source.height - top, Math.ceil((word.bounds.y1 - word.bounds.y0 + 14) * scaleY));
  if (width <= 0 || height <= 0 || width > 512 || height > 512) return null;
  const crop = document.createElement("canvas");
  crop.width = width; crop.height = height;
  try {
    const context = crop.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.fillStyle = "white"; context.fillRect(0, 0, width, height);
    context.drawImage(source, left, top, width, height, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height).data;
    const ink = new Uint8Array(width * height), seen = new Uint8Array(width * height);
    for (let i = 0; i < ink.length; i++) ink[i] = pixels[i * 4] * .2126 + pixels[i * 4 + 1] * .7152 + pixels[i * 4 + 2] * .0722 <= 180 ? 1 : 0;
    const components: { x: number; y: number; width: number; height: number; positions: number[] }[] = [];
    for (let start = 0; start < ink.length; start++) {
      if (!ink[start] || seen[start]) continue;
      seen[start] = 1;
      const pending = [start], positions: number[] = [];
      let x0 = width, y0 = height, x1 = 0, y1 = 0;
      while (pending.length) {
        const current = pending.pop()!;
        const x = current % width, y = Math.floor(current / width);
        positions.push(current);
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const next = ny * width + nx;
          if (ink[next] && !seen[next]) { seen[next] = 1; pending.push(next); }
        }
      }
      if (positions.length >= 3) components.push({ x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1, positions });
      if (components.length > 16) return null;
    }
    if (components.length < 3) return null;
    const tallest = Math.max(...components.map(component => component.height));
    const bottoms = components.map(component => component.y + component.height).sort((a, b) => a - b);
    const baseline = bottoms[Math.floor(bottoms.length / 2)];
    const raised = components.filter(component => component.x > width * .5 && component.height < tallest * .6 && component.y + component.height < baseline - tallest * .2);
    if (raised.length !== 1) return null;
    const glyph = raised[0], mask = document.createElement("canvas");
    mask.width = glyph.width; mask.height = glyph.height;
    const maskContext = mask.getContext("2d");
    if (!maskContext) return null;
    try {
      maskContext.fillStyle = "white"; maskContext.fillRect(0, 0, mask.width, mask.height);
      maskContext.fillStyle = "black";
      for (const position of glyph.positions) maskContext.fillRect(position % width - glyph.x, Math.floor(position / width) - glyph.y, 1, 1);
      const enlarged = document.createElement("canvas");
      enlarged.width = Math.ceil(glyph.width / glyph.height * 100) + 40; enlarged.height = 140;
      const enlargedContext = enlarged.getContext("2d");
      if (!enlargedContext) return null;
      enlargedContext.fillStyle = "white"; enlargedContext.fillRect(0, 0, enlarged.width, enlarged.height);
      enlargedContext.imageSmoothingEnabled = false;
      enlargedContext.drawImage(mask, 20, 20, enlarged.width - 40, 100);
      return enlarged;
    } finally { mask.width = 0; mask.height = 0; }
  } finally { crop.width = 0; crop.height = 0; }
}

/**
 * Report bytes stay in memory. Only versioned OCR/PDF assets are requested from this origin.
 * The caller owns the returned blob URL and must revoke it when its preview is dismissed.
 */
export async function readRenphoReport(file: File, onProgress?: (message: string) => void, signal?: AbortSignal): Promise<RenphoReportFile> {
  if (typeof window === "undefined" || typeof document === "undefined") throw new ReportReadError("Open the report importer in a browser.");
  checkAbort(signal);
  if (ocrReloadRequired) throw new ReportReadError(OCR_RELOAD_MESSAGE);
  if (!file.size || file.size > MAX_BYTES) throw new ReportReadError("Choose one PNG, JPEG, or single-page PDF no larger than 10 MiB.");
  if (!file.name.trim() || file.name.length > 255 || /[\u0000-\u001f\u007f]/.test(file.name)) throw new ReportReadError("Choose a report with a valid filename.");

  let worker: OcrWorker | undefined;
  let pendingWorker: Promise<OcrWorker> | undefined;
  const controller = new AbortController();
  const cancel = () => {
    if (pendingWorker && !worker) ocrReloadRequired = true;
    controller.abort();
  };
  signal?.addEventListener("abort", cancel, { once: true });
  const activeSignal = controller.signal;
  let initializationFailed = false;
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    if (pendingWorker && !worker) { initializationFailed = true; ocrReloadRequired = true; }
    controller.abort();
  }, 180000);
  let loadingTask: PDFDocumentLoadingTask | undefined;
  let pdfWorker: PDFWorker | undefined;
  let pdfPort: Worker | undefined;
  let pdfReaderFailed = false;
  let rendering: RenderTask | undefined;
  let bitmap: ImageBitmap | undefined;
  let previewUrl: string | undefined;
  let completed = false;
  const canvas = document.createElement("canvas");
  const progress = (message: string) => { if (!activeSignal.aborted) onProgress?.(message); };

  try {
    progress("Opening the report in this browser…");
    const buffer = await cancellable(file.arrayBuffer(), activeSignal);
    const bytes = new Uint8Array(buffer);
    const isPng = bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
    const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const isPdf = bytes.length >= 5 && String.fromCharCode(...bytes.subarray(0, 5)) === "%PDF-";
    if (!isPng && !isJpeg && !isPdf) throw new ReportReadError("Choose a PNG, JPEG, or PDF report. Other image and document formats are not supported.");
    const digest = await cancellable(crypto.subtle.digest("SHA-256", buffer), activeSignal);
    const fileHash = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("");
    const assets = new URL("/report-assets/", window.location.origin).href;

    if (isPdf) {
      progress("Rendering the PDF page locally…");
      const pdf = await cancellable(import("pdfjs-dist"), activeSignal);
      pdf.GlobalWorkerOptions.workerSrc = `${assets}pdf.worker-6.3.289.min.mjs`;
      // Own the native port from creation, including before PDF initialization can
      // finish, so a stalled worker can always be terminated without private APIs.
      pdfPort = new Worker(pdf.GlobalWorkerOptions.workerSrc, { type: "module" });
      pdfPort.addEventListener("error", event => { event.preventDefault(); pdfReaderFailed = true; controller.abort(); }, { once: true });
      pdfWorker = pdf.PDFWorker.create({ port: pdfPort, verbosity: 0 });
      loadingTask = pdf.getDocument({
        data: bytes, worker: pdfWorker, verbosity: 0, stopAtErrors: true, enableXfa: false,
        disableAutoFetch: true, disableRange: true, disableStream: true,
        maxImageSize: MAX_PIXELS, canvasMaxAreaInBytes: MAX_PIXELS * 4,
        standardFontDataUrl: `${assets}standard_fonts/`, wasmUrl: `${assets}wasm/`,
        useWorkerFetch: true, useSystemFonts: false,
      });
      const document = await cancellable(loadingTask.promise, activeSignal);
      if (document.numPages !== 1) throw new ReportReadError("Choose a single-page report. Export each report page as a separate PDF or image.");
      const page = await cancellable(document.getPage(1), activeSignal);
      const original = page.getViewport({ scale: 1 });
      checkDimensions(original.width, original.height, true);
      const viewport = page.getViewport({ scale: RENDER_WIDTH / original.width });
      canvas.width = RENDER_WIDTH;
      canvas.height = Math.round(viewport.height);
      rendering = page.render({ canvas, viewport, annotationMode: pdf.AnnotationMode.DISABLE, background: "rgb(255,255,255)" });
      await cancellable(rendering.promise, activeSignal);
    } else {
      const dimensions = imageDimensions(bytes, isPng ? "png" : "jpeg");
      checkDimensions(...dimensions, false);
      const decoding = createImageBitmap(new Blob([buffer], { type: isPng ? "image/png" : "image/jpeg" }));
      // A browser image decode cannot be stopped, so release a late result after cancellation.
      void decoding.then(image => { if (activeSignal.aborted) image.close(); }, () => {});
      bitmap = await cancellable(decoding, activeSignal);
      checkDimensions(bitmap.width, bitmap.height, true);
      canvas.width = RENDER_WIDTH;
      canvas.height = Math.round(RENDER_WIDTH * bitmap.height / bitmap.width);
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new ReportReadError("This browser could not prepare the report image.");
      context.fillStyle = "white";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      // Retain the bounded native raster until finally so tiny printed unit glyphs
      // can be read without first losing their pixels in the page downsample.
    }

    checkAbort(activeSignal);
    progress("Loading the local text reader…");
    const tesseract = await cancellable(import("tesseract.js"), activeSignal);
    pendingWorker = tesseract.createWorker("eng", tesseract.OEM.LSTM_ONLY, {
      workerPath: `${assets}worker-7.min.js`, corePath: assets, langPath: assets,
      workerBlobURL: false, gzip: true, cacheMethod: "none",
      errorHandler: () => {
        if (!worker) { initializationFailed = true; ocrReloadRequired = true; controller.abort(); }
      },
      logger: status => {
        if (status.status === "recognizing text") progress(`Reading report text locally… ${Math.max(0, Math.min(100, Math.round(status.progress * 100)))}%`);
      },
    });
    // createWorker exposes its handle only after initialization. Cancel late initializers too.
    void pendingWorker.then(initialized => { if (activeSignal.aborted) void initialized.terminate().catch(() => {}); }, () => {});
    worker = await cancellable(pendingWorker, activeSignal);
    await cancellable(worker.setParameters({ tessedit_pageseg_mode: tesseract.PSM.SPARSE_TEXT, preserve_interword_spaces: "1", user_defined_dpi: "200" }), activeSignal);
    const result = await cancellable(worker.recognize(canvas, { rotateAuto: false }, { text: true, blocks: true }), activeSignal);
    const words: OcrWord[] = [];
    let characters = 0;
    for (const block of result.data.blocks ?? []) for (const paragraph of block.paragraphs) for (const line of paragraph.lines) for (const word of line.words) {
      const text = word.text.trim();
      const { x0, x1, y0, y1 } = word.bbox;
      if (!text || ![x0, x1, y0, y1].every(Number.isFinite) || x1 <= x0 || y1 <= y0) continue;
      characters += text.length;
      if (words.length >= MAX_OCR_WORDS || characters > MAX_OCR_CHARACTERS) throw new ReportReadError("The page contains too much text. Choose one full report page.");
      words.push({ text, x: (x0 + x1) / 2, y: (y0 + y1) / 2, height: y1 - y0, bounds: { x0, x1, y0, y1 } });
    }
    if (!words.length) throw new ReportReadError("No readable text was found. Use a clear, full-page report image or PDF.");
    checkAbort(activeSignal);
    const regions = extractRegions(words, canvas);
    // Colored small type can disappear in a full-page sparse-text pass. A second
    // isolated read must still produce the exact explicit header the parser accepts.
    if (!/^Measurement\s*\(\s*(?:lb|lbs|kg)\s*\)$/i.test(regions.compositionHeader.trim())) {
      progress("Reading the printed measurement-unit header…");
      const header = document.createElement("canvas");
      const left = Math.floor(.18 * canvas.width), top = Math.floor(.13 * canvas.height);
      const width = Math.ceil(.16 * canvas.width), height = Math.ceil(.032 * canvas.height);
      header.width = 900; header.height = Math.round(900 * height / width);
      try {
        const context = header.getContext("2d");
        if (!context) throw new ReportReadError("This browser could not read the report unit header.");
        context.fillStyle = "white"; context.fillRect(0, 0, header.width, header.height);
        context.imageSmoothingEnabled = true; context.imageSmoothingQuality = "high";
        context.drawImage(canvas, left, top, width, height, 0, 0, header.width, header.height);
        await cancellable(worker.setParameters({ tessedit_pageseg_mode: tesseract.PSM.SINGLE_LINE }), activeSignal);
        const reading = await cancellable(worker.recognize(header, { rotateAuto: false }, { text: true, blocks: false }), activeSignal);
        if (reading.data.text.length <= 200) regions.compositionHeader = reading.data.text.trim();
      } finally { header.width = 0; header.height = 0; }
    }
    let parsed = parseRenphoRegions(regions);
    // A superscript is read from its own pixels, never supplied from the metric name.
    // The strict parser remains the fallback when the glyph is absent or ambiguous.
    if (parsed.recognizedLayout && /^SMI\s+[+-]?(?:\d+(?:\.\d*)?|\.\d+)\s+kg\/m\s*$/im.test(regions.indicators)) {
      const unitWords = words.filter(word => word.text === "kg/m" && word.x >= .645 * canvas.width && word.x < .97 * canvas.width && word.y >= .811 * canvas.height && word.y < .955 * canvas.height);
      if (unitWords.length === 1) {
        const glyph = superscriptGlyph(bitmap ?? canvas, unitWords[0], canvas);
        if (glyph) {
          try {
            progress("Reading the printed unit superscript…");
            await cancellable(worker.setParameters({ tessedit_pageseg_mode: tesseract.PSM.SINGLE_WORD, tessedit_char_whitelist: "0123456789" }), activeSignal);
            const exponent = await cancellable(worker.recognize(glyph, { rotateAuto: false }, { text: true, blocks: false }), activeSignal);
            if (exponent.data.text.trim() === "2") {
              unitWords[0].text = "kg/m²";
              regions.indicators = regionText(words, [.645, .811, .97, .955], canvas.width, canvas.height);
              parsed = parseRenphoRegions(regions);
              parsed.issues.push({ severity: "review", code: "ocr_superscript", message: "The SMI unit superscript was read separately from its printed glyph. Compare kg/m² with the original report before saving." });
            }
          } finally { glyph.width = 0; glyph.height = 0; }
        }
      }
    }
    checkAbort(activeSignal);
    progress("Preparing values for your review…");
    const preview = await cancellable(new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new ReportReadError("The report preview could not be created.")), "image/png")), activeSignal);
    checkAbort(activeSignal);
    previewUrl = URL.createObjectURL(preview);
    completed = true;
    return { fileName: file.name, fileHash, parsed, previewUrl };
  } catch (error) {
    // Native worker-script failures may reject createWorker without invoking its
    // errorHandler. Caller cancellation is separate from an initialization failure.
    if (pendingWorker && !worker && !activeSignal.aborted) { initializationFailed = true; ocrReloadRequired = true; }
    if (initializationFailed) throw new ReportReadError(OCR_RELOAD_MESSAGE);
    if (pdfReaderFailed) throw new ReportReadError("The local PDF reader could not start. Try a fresh PDF, PNG, or JPEG report.");
    if (timedOut) throw new ReportReadError("Reading the report took too long. Try a clear full-page image or a smaller PDF.");
    if (activeSignal.aborted) throw aborted();
    if (error instanceof ReportReadError) throw error;
    throw new ReportReadError("This report could not be read. Use a clear, unlocked, single-page PNG, JPEG, or PDF and try again.");
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", cancel);
    if (!completed && pendingWorker && !worker) ocrReloadRequired = true;
    if (!completed) controller.abort();
    rendering?.cancel();
    bitmap?.close();
    if (worker) await worker.terminate().catch(() => {});
    const pdfTask = loadingTask;
    if (pdfTask) await boundedCleanup(Promise.resolve().then(() => pdfTask.destroy()));
    try { pdfWorker?.destroy(); } catch { /* The owned native port is terminated regardless. */ }
    finally { pdfPort?.terminate(); }
    if (!completed && previewUrl) URL.revokeObjectURL(previewUrl);
    canvas.width = 0; canvas.height = 0;
  }
}
