import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  use: {
    baseURL: "http://127.0.0.1:3317",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npx next start --hostname 127.0.0.1 --port 3317",
    url: "http://127.0.0.1:3317",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      RANGER_TRIAL_RUNTIME: "memory",
      GAME_RUNTIME: "memory",
      PLACEMENT_REVIEW_STORE: "file",
      PLACEMENT_REVIEW_WRITE_ENABLED: "1",
      CONTEXT_LAB_ENABLED: "1",
      CONTEXT_LAB_RUNTIME: "memory",
    },
  },
});
