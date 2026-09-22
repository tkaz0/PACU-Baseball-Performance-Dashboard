import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { HitterContactMap } from "@/components/hitter-contact-map";
import { HitterSprayMap } from "@/components/hitter-spray-map";
import type { SavedContact } from "@/lib/full-swing-contacts-server";

const sample: SavedContact[] = [
  {fileHash:"a".repeat(64),sourceRow:2,pitchNumber:1,sourceFile:"fictional-intrasquad.csv",playedOn:"2026-09-11",category:"intrasquad",exitVelocity:94.321,launchAngle:-12.5,direction:12,distance:230},
  {fileHash:"b".repeat(64),sourceRow:3,pitchNumber:2,sourceFile:"fictional-practice.csv",playedOn:"2026-09-12",category:"practice",exitVelocity:88.4,launchAngle:24,direction:null,distance:null},
];
it("renders paired game points separately from practice and exposes exact readings", () => {
  const game = renderToStaticMarkup(createElement(HitterContactMap,{contacts:sample,context:"in_game",bats:"R"}));
  const practice = renderToStaticMarkup(createElement(HitterContactMap,{contacts:sample,context:"practice"}));
  expect(game).toContain("94.3 mph");
  expect(game).toContain("-12.5°");
  expect(game).toContain("90+ mph");
  expect(game).toContain("Both Thresholds");
  expect(game).toContain('aria-label="About Hitter Contact Map"');
  expect(game).toContain('aria-label="About EV / Launch chart"');
  expect(game).not.toContain("fictional-practice.csv");
  expect(practice).toContain("88.4 mph");
  expect(practice).not.toContain("fictional-intrasquad.csv");
});

it("renders recorded spray shares using the hitter's batting side and 150-foot boundary", () => {
  const markup = renderToStaticMarkup(createElement(HitterSprayMap,{contacts:[sample[0]],bats:"R"}));
  expect(markup).toContain("Spray distribution");
  expect(markup).toContain("Outfield");
  expect(markup).toContain("150+ ft");
  expect(markup).toContain("Opposite");
  expect(markup).toContain("100.0%");
  expect(markup).toContain("not confirmed hits");
});
