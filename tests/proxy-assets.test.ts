import { expect, it } from "vitest";
import { unstable_doesMiddlewareMatch as unstable_doesProxyMatch } from "next/experimental/testing/server";
import { config } from "@/proxy";

it("skips session work only for public assets and keeps protected pages and APIs covered", () => {
  for (const url of ["/brand/pacific-athletics-p.png", "/brand/pacific-university.svg", "/report-assets/eng.traineddata.gz", "/icon.svg", "/_next/static/chunk.js"]) {
    expect(unstable_doesProxyMatch({ config, nextConfig: {}, url })).toBe(false);
  }
  for (const url of ["/", "/overview", "/analytics/matrix", "/exit-meetings/download", "/api/athletes/fictional", "/athletes/fictional.svg", "/imports/brand/data", "/admin/icon.svg", "/icon.svg/private"]) {
    expect(unstable_doesProxyMatch({ config, nextConfig: {}, url })).toBe(true);
  }
});
