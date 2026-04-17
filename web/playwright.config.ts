/// <reference types="node" />

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run db:prepare && npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL ?? "file:./prisma/playwright.db",
      AUTH_SECRET: process.env.AUTH_SECRET ?? "playwright-dev-secret",
      AUTH_ENABLE_DEV_LOGIN: "true",
      NEXT_PUBLIC_ENABLE_DEV_LOGIN: "true",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});