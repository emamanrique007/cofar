import { defineConfig } from "@playwright/test";

process.loadEnvFile("apps/next/.env.local");
export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  use: { baseURL: "http://localhost:3005", trace: "retain-on-failure" },
  webServer: {
    command: "pnpm compile && pnpm --filter @cofar/next dev",
    url: "http://localhost:3005",
    reuseExistingServer: false,
    timeout: 120000
  }
});
