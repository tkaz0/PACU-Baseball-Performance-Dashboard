/**
 * Browser-built PDF of the Print All bundle (November 2 owner request): each letter page is drawn to an image and
 * added to one PDF that downloads directly. Nothing is uploaded. Roster photos are swapped to the staff-only
 * same-origin copy while drawing (the athletics image service blocks canvas use), then restored.
 */
const PROXY = "/exit-meetings/headshot?src=";
const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => resolve(null)));
const BLANK = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

async function swapToSameOriginPhotos(root: HTMLElement): Promise<() => void> {
  const swapped: [HTMLImageElement, string][] = [];
  for (const img of root.querySelectorAll<HTMLImageElement>("img")) {
    if (!img.src.startsWith("https://goboxers.com/")) continue;
    swapped.push([img, img.src]);
    img.loading = "eager";
    img.src = PROXY + encodeURIComponent(img.src);
  }
  // A photo that does not load within a few seconds is left out; the initials underneath show instead.
  const timeout = () => new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 6000));
  await Promise.all(swapped.map(([img]) => Promise.race([img.decode(), timeout()]).catch(() => { img.style.visibility = "hidden"; })));
  return () => { for (const [img, src] of swapped) { img.src = src; img.style.visibility = ""; } };
}

/**
 * Drawing options for one letter page. includeQueryParams is required: every photo is the same proxy path with a
 * different ?src=, and without it the image library caches the first photo and reuses it for every player.
 */
// Print-center size (November 3 owner request): 1.5x at quality 0.72 is about a third of the old 2x/0.85 file and
// still about 144 dpi, sharp enough for the handouts' smallest 12px text.
export function pageImageOptions(fontEmbedCSS: string) {
  return { width: 816, height: 1056, pixelRatio: 1.5, quality: 0.72, backgroundColor: "#ffffff", fontEmbedCSS, imagePlaceholder: BLANK, includeQueryParams: true,
    style: { zoom: "1", transform: "none", margin: "0", borderRadius: "0", boxShadow: "none" } };
}

/** Page ranges for each file. Splits fall on whole sheets (two pages: front and back), so no handout is cut in half. */
export function pdfParts(pageCount: number, pagesPerFile: number | null): [number, number][] {
  const size = pagesPerFile && pagesPerFile > 0 ? Math.max(2, pagesPerFile - (pagesPerFile % 2)) : pageCount;
  const parts: [number, number][] = [];
  for (let start = 0; start < pageCount; start += size) parts.push([start, Math.min(pageCount, start + size)]);
  return parts;
}

export async function downloadBundlePdf(root: HTMLElement, filename: string, onProgress: (done: number, total: number) => void, pagesPerFile: number | null = null): Promise<number> {
  const pages = [...root.querySelectorAll<HTMLElement>("[data-pdf-page]")];
  if (!pages.length) throw new Error("No pages to save.");
  const [{ toJpeg, getFontEmbedCSS }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
  const restore = await swapToSameOriginPhotos(root);
  try {
    const fontEmbedCSS = await getFontEmbedCSS(root).catch(() => "");
    const parts = pdfParts(pages.length, pagesPerFile);
    for (const [index, [start, end]] of parts.entries()) {
    const pdf = new jsPDF({ unit: "in", format: "letter", orientation: "portrait", compress: true });
    for (let i = start; i < end; i++) {
      // Letter page at 96 px/in, drawn at 2x for crisp print text.
      const options = pageImageOptions(fontEmbedCSS);
      // Owner request: if photos break a page, draw it again without photos (initials only) rather than failing.
      const image = await toJpeg(pages[i], options).catch(async () => {
        const photos = [...pages[i].querySelectorAll<HTMLImageElement>("img")];
        for (const img of photos) img.style.visibility = "hidden";
        return toJpeg(pages[i], { ...options, filter: node => !(node instanceof HTMLImageElement) });
      });
      if (i > start) pdf.addPage("letter", "portrait");
      pdf.addImage(image, "JPEG", 0, 0, 8.5, 11, undefined, "FAST");
      onProgress(i + 1, pages.length);
      await nextFrame();
    }
    pdf.save(parts.length > 1 ? filename.replace(/\.pdf$/, `-part-${index + 1}-of-${parts.length}.pdf`) : filename);
    }
    return pages.length;
  } finally { restore(); }
}
