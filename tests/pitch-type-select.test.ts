import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { PitchTypeSelect } from "@/components/pitch-assignment-review";

const render = (value: string) => renderToStaticMarkup(createElement(PitchTypeSelect, { value, label: "Fictional pitch type", onChange: () => {} }));

it("offers specific types with compact display labels without changing saved values", () => {
  const html = render("Four-Seam Fastball");
  expect(html).toContain('<option value="Four-Seam Fastball" selected="">4-Seam Fastball</option>');
  expect(html).toContain('<option value="Two-Seam Fastball">2-Seam Fastball</option>');
  expect(html).not.toContain('<option value="Fastball"');
  expect(html).toContain('<option value="">Unassigned</option>');
});

it("keeps a loaded legacy selection visible for deliberate review without allowing it as a new choice", () => {
  const html = render("Fastball");
  expect(html).toContain('<option value="Fastball" disabled="" selected="">Choose Pitch Type</option>');
  expect(html).not.toContain('>Fastball</option>');
  expect(html).toContain('<option value="Four-Seam Fastball">4-Seam Fastball</option>');
});
