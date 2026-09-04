import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
if (existsSync(".env.test.local")) process.loadEnvFile(".env.test.local");
const baseURL = process.env.TEST_APP_URL || "http://127.0.0.1:3000";
if (!["localhost","127.0.0.1"].includes(new URL(baseURL).hostname)) throw new Error("Browser tests must target a local app.");
export default defineConfig({
  testDir: "tests/browser", fullyParallel: false, workers: 1,
  use: { baseURL, headless: true, trace: "off", screenshot: "off", video: "off",
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) },
  reporter: "list",
});
