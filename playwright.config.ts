import { defineConfig, devices } from "@playwright/test";

const REAL_RELEASE_E2E = process.env.CONTEXT_LAB_REAL_RELEASE_E2E === "1";
const REAL_RELEASE_FORBIDDEN_HOST =
  process.env.VERCEL_ENV === "production" || process.env.VERCEL_ENV === "preview";

if (REAL_RELEASE_E2E && REAL_RELEASE_FORBIDDEN_HOST) {
  throw new Error(
    "CONTEXT_LAB_REAL_RELEASE_E2E is forbidden on production/preview hosts",
  );
}

const ordinaryWebServers = [
    {
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
        CONTEXT_LAB_E2E: "1",
        CONTEXT_LAB_E2E_PROBE_ENABLED: "1",
        DEBUG_TOOLS_ENABLED: "0",
        CONTEXTUAL_CONTENT_REVIEW_ENABLED: "0",
        CONTEXTUAL_CONTENT_REVIEW_WRITE_ENABLED: "0",
        CONTEXTUAL_CONTENT_PROMOTION_ENABLED: "0",
        CONTEXTUAL_CONTENT_PROMOTION_WRITE_ENABLED: "0",
        CONTEXTUAL_PROMOTION_RUNTIME: "memory",
        CONTEXTUAL_CONTENT_RELEASE_ENABLED: "0",
        CONTEXTUAL_CONTENT_RELEASE_WRITE_ENABLED: "0",
        CONTEXT_LAB_CONTENT_SOURCE: "static",
      },
    },
    {
      command: "npx next start --hostname 127.0.0.1 --port 3318",
      url: "http://127.0.0.1:3318",
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
        CONTEXT_LAB_E2E: "1",
        CONTEXT_LAB_E2E_PROBE_ENABLED: "1",
        DEBUG_TOOLS_ENABLED: "1",
        CONTEXTUAL_CONTENT_REVIEW_ENABLED: "1",
        CONTEXTUAL_CONTENT_REVIEW_WRITE_ENABLED: "0",
        CONTEXTUAL_CONTENT_PROMOTION_ENABLED: "1",
        CONTEXTUAL_CONTENT_PROMOTION_WRITE_ENABLED: "0",
        CONTEXTUAL_PROMOTION_RUNTIME: "memory",
        CONTEXTUAL_CONTENT_RELEASE_ENABLED: "1",
        CONTEXTUAL_CONTENT_RELEASE_WRITE_ENABLED: "0",
        CONTEXTUAL_RELEASE_RUNTIME: "memory",
        CONTEXT_LAB_CONTENT_SOURCE: "static",
      },
    },
    {
      command: "npx next start --hostname 127.0.0.1 --port 3319",
      url: "http://127.0.0.1:3319",
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
        CONTEXT_LAB_E2E: "1",
        CONTEXT_LAB_E2E_PROBE_ENABLED: "1",
        DEBUG_TOOLS_ENABLED: "1",
        CONTEXTUAL_CONTENT_REVIEW_ENABLED: "1",
        CONTEXTUAL_CONTENT_REVIEW_WRITE_ENABLED: "1",
        CONTEXTUAL_CONTENT_PROMOTION_ENABLED: "1",
        CONTEXTUAL_CONTENT_PROMOTION_WRITE_ENABLED: "1",
        CONTEXTUAL_PROMOTION_RUNTIME: "memory",
        CONTEXTUAL_CONTENT_RELEASE_ENABLED: "1",
        CONTEXTUAL_CONTENT_RELEASE_WRITE_ENABLED: "1",
        CONTEXTUAL_RELEASE_RUNTIME: "memory",
        CONTEXT_LAB_CONTENT_SOURCE: "active-release",
      },
    },
  ];

const realReleaseWebServers = REAL_RELEASE_E2E
  ? [
      {
        command: "npx next start --hostname 127.0.0.1 --port 3321",
        url: "http://127.0.0.1:3321",
        reuseExistingServer: false,
        timeout: 120_000,
        env: {
          ...process.env,
          RANGER_TRIAL_RUNTIME: "memory",
          GAME_RUNTIME: "memory",
          PLACEMENT_REVIEW_STORE: "file",
          PLACEMENT_REVIEW_WRITE_ENABLED: "0",
          CONTEXT_LAB_ENABLED: "1",
          // Existing run-repository policy is memory|supabase. File is the
          // release-content runtime, not the Context Lab run store.
          CONTEXT_LAB_RUNTIME: "memory",
          CONTEXT_LAB_CONTENT_SOURCE: "active-release",
          CONTEXTUAL_RELEASE_RUNTIME: "file",
          CONTEXTUAL_CONTENT_RELEASE_ENABLED: "1",
          CONTEXTUAL_CONTENT_RELEASE_WRITE_ENABLED: "0",
          CONTEXTUAL_CONTENT_REVIEW_ENABLED: "0",
          CONTEXTUAL_CONTENT_REVIEW_WRITE_ENABLED: "0",
          CONTEXTUAL_CONTENT_PROMOTION_ENABLED: "0",
          CONTEXTUAL_CONTENT_PROMOTION_WRITE_ENABLED: "0",
          CONTEXT_LAB_E2E: "1",
          CONTEXT_LAB_E2E_PROBE_ENABLED: "1",
          DEBUG_TOOLS_ENABLED: "0",
        },
      },
    ]
  : [];

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  use: {
    baseURL: "http://127.0.0.1:3317",
    trace: "on-first-retry",
  },
  projects: REAL_RELEASE_E2E
    ? [
        {
          name: "chromium-real-release",
          testMatch: /context-lab-real-release/,
          use: {
            ...devices["Desktop Chrome"],
            baseURL: "http://127.0.0.1:3321",
          },
        },
      ]
    : [
        {
          name: "chromium",
          use: { ...devices["Desktop Chrome"] },
          testIgnore: /context-lab-real-release/,
        },
      ],
  webServer: REAL_RELEASE_E2E ? realReleaseWebServers : ordinaryWebServers,
});
