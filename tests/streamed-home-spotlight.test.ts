import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { StreamedHomeSpotlight } from "@/components/streamed-home-spotlight";
import { gameWeeks } from "@/lib/game-weeks";

it.each([false, true])("shows a recoverable status for a failed weekly read (staff=%s)", async staff => {
  // The Home reader deliberately settles failed requests to null.
  const html = renderToStaticMarkup(await StreamedHomeSpotlight({ weeks: Promise.resolve(null), photos: Promise.resolve(new Map()), staff }));
  expect(html).toContain('role="status"');
  expect(html).toContain("BWS and weekly leaders are temporarily unavailable. Refresh to try again.");
  expect(html).not.toContain("No leaders");
});

it("keeps a successful empty source quiet instead of reporting a failure", async () => {
  const html = renderToStaticMarkup(await StreamedHomeSpotlight({ weeks: Promise.resolve({ players: [], weeks: gameWeeks([]), champions: null }), photos: Promise.resolve(new Map()), staff: true }));
  expect(html).toBe("");
});
