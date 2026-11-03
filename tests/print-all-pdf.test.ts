import { expect, it } from "vitest";
import { pageImageOptions } from "@/lib/print-all-pdf";

it("keeps each photo's ?src= in the image cache key so every player gets their own photo", () => {
  expect(pageImageOptions("")).toMatchObject({ includeQueryParams: true, width: 816, height: 1056 });
});
