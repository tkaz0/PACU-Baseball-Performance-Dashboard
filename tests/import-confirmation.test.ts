import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { buildImportConfirmation } from "@/lib/import-confirmation";
import { ImportConfirmation } from "@/components/import-confirmation";
import { getPreviewRoster } from "@/lib/preview-roster";
const roster = getPreviewRoster();
const row = { athlete_code: roster[0].athlete_code, measured_at: "2026-09-13", metric: "Weight" };
it("groups a confirmed batch by player and date with safe exact profile links", () => {
  const receipt = buildImportConfirmation([row, { ...row, metric: "Muscle Mass" }, { ...row, measured_at: "2026-09-12" }, { ...row, athlete_code: roster[1].athlete_code }], roster, { created: 3, unchanged: 1 });
  expect(receipt.players).toHaveLength(3); expect(receipt.players[0]).toMatchObject({ href: `/athletes/${roster[0].id}`, metrics: ["Weight", "Muscle Mass"] });
  expect(receipt.created).toBe(3); expect(receipt.unchanged).toBe(1);
});
it("separates known RENPHO duplicates from omitted metrics and preserves zero-created receipts", () => {
  const skipped = [{ label: "Visceral Fat", reason: "Could not be read clearly." }, { label: "Bone Mass", reason: "Not selected." }];
  const receipt = buildImportConfirmation([row], roster, { created: 0, unchanged: 1 }, skipped, 2);
  expect(receipt.unchanged).toBe(3); expect(receipt.skipped).toHaveLength(2);
  const html = renderToStaticMarkup(createElement(ImportConfirmation, { receipt }));
  expect(html).toContain("Readings Already Saved"); expect(html).toContain("0 new readings"); expect(html).toContain("Left Out of This Import"); expect(html).toContain("Visceral Fat"); expect(html).toContain("Check Team Coverage");
});
it("retains only display metadata and rejects an unknown roster match", () => {
  const input = { ...row, value: 180, source_file: "private.png", file_hash: "private-hash", id: "private-observation" };
  const receipt = buildImportConfirmation([input], roster, { created: 1, unchanged: 0 });
  expect(JSON.stringify(receipt)).not.toMatch(/private|value|file_hash/);
  expect(() => buildImportConfirmation([{ ...row, athlete_code: "MISSING" }], roster, { created: 1, unchanged: 0 })).toThrow("roster");
});
