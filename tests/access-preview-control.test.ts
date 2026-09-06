import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/app/(workspace)/view-as/actions", () => ({ startAccessPreview: () => {}, exitAccessPreview: () => {} }));
import { AccessPreviewControl } from "@/components/access-preview-control";

describe("View as control accessible names", () => {
  it("forwards explicit Coach/Player button labels through SubmitButton and labels the player select", () => {
    const html = renderToStaticMarkup(createElement(AccessPreviewControl, { preview: null,
      athletes: [{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", label: "Fictional Player" }] }));
    expect(html).toMatch(/<button[^>]*aria-label="View as Coach"[^>]*>View as Coach<\/button>/);
    expect(html).toMatch(/<button[^>]*aria-label="View as Player"[^>]*>View as Player<\/button>/);
    expect(html).toMatch(/<select[^>]*aria-label="Player profile"/);
    expect(html).toContain('name="athlete_id"');
  });
  it("keeps the exit action explicitly named while a Coach view is active", () => {
    const html = renderToStaticMarkup(createElement(AccessPreviewControl, { athletes: [], preview: {
      version: 1, actorId: "11111111-1111-4111-8111-111111111111", role: "coach", athleteId: null, expiresAt: 1_800_000_000_000,
    } }));
    expect(html).toMatch(/<button[^>]*aria-label="Exit preview"[^>]*>Exit preview<\/button>/);
  });
});
