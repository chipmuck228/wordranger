import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  supabaseProgressRunRequested,
  supabaseProgressWritesAllowed,
} from "./load-local-env";

const originalRun = process.env.RUN_SUPABASE_PROGRESS;
const originalAllow = process.env.ALLOW_SUPABASE_PROGRESS_WRITES;

afterEach(() => {
  if (originalRun === undefined) {
    delete process.env.RUN_SUPABASE_PROGRESS;
  } else {
    process.env.RUN_SUPABASE_PROGRESS = originalRun;
  }
  if (originalAllow === undefined) {
    delete process.env.ALLOW_SUPABASE_PROGRESS_WRITES;
  } else {
    process.env.ALLOW_SUPABASE_PROGRESS_WRITES = originalAllow;
  }
});

describe("Supabase progress-test write gate", () => {
  it("does not allow writes unless both opt-in flags are exactly 1", () => {
    delete process.env.RUN_SUPABASE_PROGRESS;
    delete process.env.ALLOW_SUPABASE_PROGRESS_WRITES;
    expect(supabaseProgressRunRequested()).toBe(false);
    expect(supabaseProgressWritesAllowed()).toBe(false);

    process.env.RUN_SUPABASE_PROGRESS = "1";
    expect(supabaseProgressRunRequested()).toBe(true);
    expect(supabaseProgressWritesAllowed()).toBe(false);

    process.env.ALLOW_SUPABASE_PROGRESS_WRITES = "true";
    expect(supabaseProgressWritesAllowed()).toBe(false);

    process.env.ALLOW_SUPABASE_PROGRESS_WRITES = "1";
    expect(supabaseProgressWritesAllowed()).toBe(true);
  });

  it("keeps npm test free of live Supabase writes and requires an extra flag for test:progress", () => {
    const pkg = JSON.parse(
      readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    expect(pkg.scripts.test).toBe("vitest run");
    expect(pkg.scripts.test).not.toContain("RUN_SUPABASE_PROGRESS");
    expect(pkg.scripts.test).not.toContain("ALLOW_SUPABASE_PROGRESS_WRITES");
    expect(pkg.scripts["test:progress"]).toContain("RUN_SUPABASE_PROGRESS=1");
    expect(pkg.scripts["test:progress"]).not.toContain(
      "ALLOW_SUPABASE_PROGRESS_WRITES",
    );
  });

  it("refuses live mutations without ALLOW_SUPABASE_PROGRESS_WRITES and cleans only the generated user", () => {
    const liveTest = readFileSync(
      path.join(
        process.cwd(),
        "tests/persistence/daily-training-supabase-progress.test.ts",
      ),
      "utf8",
    );
    expect(liveTest).toContain("describe.skipIf(!requireLive)");
    expect(liveTest).toContain(
      "describe.skipIf(!requireLive || !allowWrites)",
    );
    expect(liveTest).toContain("supabaseProgressWritesAllowed");
    expect(liveTest).toContain("if (!allowWrites)");
    expect(liveTest).toContain("Refusing Supabase progress-test writes");
    expect(liveTest).toContain("crypto.randomUUID()");
    expect(liveTest).toContain("cleanupProgressTestUser(");
    expect(liveTest).toContain("userId");
    expect(liveTest).not.toContain(
      "cleanupProgressTestUser(client, V1_PLACEHOLDER_USER_ID)",
    );
    expect(liveTest).not.toMatch(
      /from\("learning_evidence"\)[\s\S]{0,80}\.delete\(/,
    );
  });
});
