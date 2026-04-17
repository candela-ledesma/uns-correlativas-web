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
      DATABASE_URL:
        process.env.DATABASE_URL_E2E ??
        process.env.DATABASE_URL ??
        "postgresql://postgres:postgres@localhost:5432/uns_correlativas_e2e?schema=public",
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