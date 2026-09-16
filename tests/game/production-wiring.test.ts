import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const actions = readFileSync(
  path.join(process.cwd(), "src/app/play/ranger-trial/actions.ts"),
  "utf8",
);
const productionRuntime = readFileSync(
  path.join(process.cwd(), "src/server/runtime/create-supabase-ranger-trial-runtime.ts"),
  "utf8",
);
const selector = readFileSync(
  path.join(process.cwd(), "src/server/runtime/create-ranger-trial-runtime.ts"),
  "utf8",
);

describe("Ranger Trial production wiring", () => {
  it("student-facing actions do not instantiate in-memory learning/task/session stores", () => {
    expect(actions).toContain("createRangerTrialRuntime");
    expect(actions).not.toContain("InMemoryLearningRepository");
    expect(actions).not.toContain("InMemoryLearningTaskRepository");
    expect(actions).not.toContain("InMemoryRangerTrialSessionStore");
    expect(actions).not.toContain("new SeededRandomSource");
  });

  it("Supabase production factory uses durable learning, task, and session adapters", () => {
    expect(productionRuntime).toContain("SupabaseLearningRepository");
    expect(productionRuntime).toContain("SupabaseLearningTaskRepository");
    expect(productionRuntime).toContain("SupabaseLearningStateQueryRepository");
    expect(productionRuntime).toContain("SupabaseRangerTrialSessionStore");
    expect(productionRuntime).not.toContain("InMemoryLearningRepository");
    expect(productionRuntime).not.toContain("InMemoryLearningTaskRepository");
    expect(productionRuntime).not.toContain("InMemoryRangerTrialSessionStore");
  });

  it("does not silently fall back to in-memory when Supabase is unconfigured", () => {
    expect(selector).toContain('RANGER_TRIAL_RUNTIME === "memory"');
    expect(selector).toContain("createSupabaseRangerTrialRuntime");
    expect(productionRuntime).toContain("requires Supabase configuration");
  });
});
