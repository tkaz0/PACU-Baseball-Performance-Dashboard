import { expect, it } from "vitest";
import { pageImageOptions, pdfParts } from "@/lib/print-all-pdf";

it("keeps each photo's ?src= in the image cache key so every player gets their own photo", () => {
  expect(pageImageOptions("")).toMatchObject({ includeQueryParams: true, width: 816, height: 1056 });
});

it("draws pages at print-center size and splits files only on whole front/back sheets", () => {
  expect(pageImageOptions("")).toMatchObject({ pixelRatio: 1.5, quality: 0.72 });
  expect(pdfParts(122, 20)).toEqual([[0, 20], [20, 40], [40, 60], [60, 80], [80, 100], [100, 120], [120, 122]]);
  expect(pdfParts(122, null)).toEqual([[0, 122]]);
  expect(pdfParts(10, 7)).toEqual([[0, 6], [6, 10]]);
});
