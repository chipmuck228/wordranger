import path from "node:path";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/persistence/dedicated-baseline-history-atomicity.integration.test.ts"],
    restoreMocks: true,
    testTimeout: 20_000,
    hookTimeout: 60_000,
    teardownTimeout: 180_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./tests/shims/server-only.ts"),
    },
  },
});
