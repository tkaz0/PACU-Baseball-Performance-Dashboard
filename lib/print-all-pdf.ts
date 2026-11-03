/**
 * Browser-built PDF of the Print All bundle (November 2 owner request): each letter page is drawn to an image and
 * added to one PDF that downloads directly. Nothing is uploaded. Roster photos are swapped to the staff-only
 * same-origin copy while drawing (the athletics image service blocks canvas use), then restored.
 */
const PROXY = "/exit-meetings/headshot?src=";
const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => resolve(null)));

async function swapToSameOriginPhotos(root: HTMLElement): Promise<() => void> {
  const swapped: [HTMLImageElement, string][] = [];
  for (const img of root.querySelectorAll<HTMLImageElement>("img")) {
    if (!img.src.startsWith("https://goboxers.com/")) continue;
    swapped.push([img, img.src]);
    img.loading = "eager";
    img.src = PROXY + encodeURIComponent(img.src);
  }
  await Promise.all(swapped.map(([img]) => img.decode().catch(() => { img.style.visibility = "hidden"; })));
  return () => { for (const [img, src] of swapped) { img.src = src; img.style.visibility = ""; } };
}

export async function downloadBundlePdf(root: HTMLElement, filename: string, onProgress: (done: number, total: number) => void): Promise<number> {
  const pages = [...root.querySelectorAll<HTMLElement>("[data-pdf-page]")];
  if (!pages.length) throw new Error("No pages to save.");
  const [{ toJpeg, getFontEmbedCSS }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
  const restore = await swapToSameOriginPhotos(root);
  try {
    const fontEmbedCSS = await getFontEmbedCSS(root).catch(() => "");
    const pdf = new jsPDF({ unit: "in", format: "letter", orientation: "portrait", compress: true });
    for (let i = 0; i < pages.length; i++) {
      // Letter page at 96 px/in, drawn at 2x for crisp print text.
      const image = await toJpeg(pages[i], { width: 816, height: 1056, pixelRatio: 2, quality: 0.85, backgroundColor: "#ffffff", fontEmbedCSS,
        style: { zoom: "1", transform: "none", margin: "0", borderRadius: "0", boxShadow: "none" } });
      if (i > 0) pdf.addPage("letter", "portrait");
      pdf.addImage(image, "JPEG", 0, 0, 8.5, 11, undefined, "FAST");
      onProgress(i + 1, pages.length);
      await nextFrame();
    }
    pdf.save(filename);
    return pages.length;
  } finally { restore(); }
}
