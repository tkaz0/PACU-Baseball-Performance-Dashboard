import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { HitterContactMap } from "@/components/hitter-contact-map";
import type { SavedContact } from "@/lib/full-swing-contacts-server";

const sample: SavedContact[] = [
  {fileHash:"a".repeat(64),sourceRow:2,pitchNumber:1,sourceFile:"fictional-intrasquad.csv",playedOn:"2026-09-11",category:"intrasquad",exitVelocity:94.321,launchAngle:-12.5,direction:12,distance:230},
  {fileHash:"b".repeat(64),sourceRow:3,pitchNumber:2,sourceFile:"fictional-practice.csv",playedOn:"2026-09-12",category:"practice",exitVelocity:88.4,launchAngle:24,direction:null,distance:null},
];
it("renders paired game points separately from practice and exposes exact readings", () => {
  const game = renderToStaticMarkup(createElement(HitterContactMap,{contacts:sample,context:"in_game"}));
  const practice = renderToStaticMarkup(createElement(HitterContactMap,{contacts:sample,context:"practice"}));
  expect(game).toContain("94.3 mph");
  expect(game).toContain("-12.5°");
  expect(game).not.toContain("fictional-practice.csv");
  expect(practice).toContain("88.4 mph");
  expect(practice).not.toContain("fictional-intrasquad.csv");
});
