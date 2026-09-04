import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // APP_URL and the local launcher use this loopback origin during development.
  allowedDevOrigins: ["127.0.0.1"],
  // Auth callback URLs and form arguments can contain private credentials.
  logging: { incomingRequests: false, serverFunctions: false },
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
  async headers() {
    return [{ source: "/(.*)", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ] }];
  },
};
export default nextConfig;
