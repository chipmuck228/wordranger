import { defineConfig, devices } from "@playwright/test";
import { ordinaryE2EWorkspaceEnv } from "./e2e/ordinary-contextual-workspace";
import { REAL_RELEASE_SERVER_ENV } from "./e2e/real-release-env";

const REAL_RELEASE_E2E = process.env.CONTEXT_LAB_REAL_RELEASE_E2E === "1";
const REAL_RELEASE_FORBIDDEN_HOST =
  process.env.VERCEL_ENV === "production" || process.env.VERCEL_ENV === "preview";
const ordinaryWorkspaceEnv = REAL_RELEASE_E2E ? {} : ordinaryE2EWorkspaceEnv();

function homepageHostEnv(
  overrides: Record<string, string | undefined>,
): Record<string, string> {
  const merged: Record<string, string | undefined> = {
    ...process.env,
    RANGER_TRIAL_RUNTIME: "memory",
    GAME_RUNTIME: "memory",
    DEBUG_TOOLS_ENABLED: "0",
    CONTEXTUAL_CONTENT_REVIEW_ENABLED: "0",
    CONTEXTUAL_CONTENT_REVIEW_WRITE_ENABLED: "0",
    CONTEXTUAL_CONTENT_PROMOTION_ENABLED: "0",
    CONTEXTUAL_CONTENT_PROMOTION_WRITE_ENABLED: "0",
    CONTEXTUAL_CONTENT_RELEASE_ENABLED: "0",
    CONTEXTUAL_CONTENT_RELEASE_WRITE_ENABLED: "0",
    CONTEXT_LAB_E2E: "0",
    CONTEXT_LAB_E2E_PROBE_ENABLED: "0",
    FREE_PRACTICE_ENABLED: "0",
    FREE_PRACTICE_RUNTIME: "",
    WORD_RANGER_FREE_PRACTICE_TEST_IDENTITY: "",
    WORD_RANGER_FREE_PRACTICE_E2E: "",
    WORD_RANGER_FREE_PRACTICE_E2E_PROBE: "",
    ...ordinaryWorkspaceEnv,
    ...overrides,
  };
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(merged)) {
    if (value !== undefined) {
      env[key] = value;
    }
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      env[key] = "";
    }
  }
  return env;
}

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
        ...ordinaryWorkspaceEnv,
        FREE_PRACTICE_ENABLED: "",
        FREE_PRACTICE_RUNTIME: "",
        WORD_RANGER_FREE_PRACTICE_TEST_IDENTITY: "",
        WORD_RANGER_FREE_PRACTICE_E2E: "",
        WORD_RANGER_FREE_PRACTICE_E2E_PROBE: "",
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
        ...ordinaryWorkspaceEnv,
        FREE_PRACTICE_ENABLED: "",
        FREE_PRACTICE_RUNTIME: "",
        WORD_RANGER_FREE_PRACTICE_TEST_IDENTITY: "",
        WORD_RANGER_FREE_PRACTICE_E2E: "",
        WORD_RANGER_FREE_PRACTICE_E2E_PROBE: "",
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
        CONTEXTUAL_PROMOTION_RUNTIME: "file",
        CONTEXTUAL_CONTENT_RELEASE_ENABLED: "1",
        CONTEXTUAL_CONTENT_RELEASE_WRITE_ENABLED: "1",
        CONTEXTUAL_RELEASE_RUNTIME: "memory",
        CONTEXT_LAB_CONTENT_SOURCE: "active-release",
        ...ordinaryWorkspaceEnv,
        FREE_PRACTICE_ENABLED: "",
        FREE_PRACTICE_RUNTIME: "",
        WORD_RANGER_FREE_PRACTICE_TEST_IDENTITY: "",
        WORD_RANGER_FREE_PRACTICE_E2E: "",
        WORD_RANGER_FREE_PRACTICE_E2E_PROBE: "",
      },
    },
    {
      command: "npx next start --hostname 127.0.0.1 --port 3320",
      url: "http://127.0.0.1:3320",
      reuseExistingServer: false,
      timeout: 120_000,
      env: homepageHostEnv({
        CONTEXT_LAB_ENABLED: "0",
        CONTEXT_LAB_RUNTIME: undefined,
        CONTEXT_LAB_CONTENT_SOURCE: undefined,
      }),
    },
    {
      command: "npx next start --hostname 127.0.0.1 --port 3322",
      url: "http://127.0.0.1:3322",
      reuseExistingServer: false,
      timeout: 120_000,
      env: homepageHostEnv({
        CONTEXT_LAB_ENABLED: "1",
        CONTEXT_LAB_CONTENT_SOURCE: "static",
        CONTEXT_LAB_RUNTIME: undefined,
      }),
    },
    {
      command: "npx next start --hostname 127.0.0.1 --port 3323",
      url: "http://127.0.0.1:3323",
      reuseExistingServer: false,
      timeout: 120_000,
      env: homepageHostEnv({
        FREE_PRACTICE_ENABLED: "1",
        FREE_PRACTICE_RUNTIME: "memory",
        WORD_RANGER_FREE_PRACTICE_TEST_IDENTITY: "1",
        WORD_RANGER_FREE_PRACTICE_E2E: "1",
        WORD_RANGER_FREE_PRACTICE_E2E_PROBE: "1",
        CONTEXT_LAB_ENABLED: "0",
        CONTEXT_LAB_RUNTIME: undefined,
        CONTEXT_LAB_CONTENT_SOURCE: undefined,
        VERCEL: undefined,
        VERCEL_ENV: undefined,
      }),
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
          CONTEXTUAL_CONTENT_RELEASE_WRITE_ENABLED:
            REAL_RELEASE_SERVER_ENV.CONTEXTUAL_CONTENT_RELEASE_WRITE_ENABLED,
          CONTEXTUAL_CONTENT_REVIEW_ENABLED:
            REAL_RELEASE_SERVER_ENV.CONTEXTUAL_CONTENT_REVIEW_ENABLED,
          CONTEXTUAL_CONTENT_REVIEW_WRITE_ENABLED:
            REAL_RELEASE_SERVER_ENV.CONTEXTUAL_CONTENT_REVIEW_WRITE_ENABLED,
          CONTEXTUAL_CONTENT_PROMOTION_ENABLED:
            REAL_RELEASE_SERVER_ENV.CONTEXTUAL_CONTENT_PROMOTION_ENABLED,
          CONTEXTUAL_CONTENT_PROMOTION_WRITE_ENABLED:
            REAL_RELEASE_SERVER_ENV.CONTEXTUAL_CONTENT_PROMOTION_WRITE_ENABLED,
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
  globalTeardown: REAL_RELEASE_E2E
    ? undefined
    : "./e2e/global-teardown-contextual-workspace.ts",
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
