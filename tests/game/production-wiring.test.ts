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
const bubbleActions = readFileSync(
  path.join(process.cwd(), "src/app/play/word-bubble/actions.ts"),
  "utf8",
);
const bubbleProduction = readFileSync(
  path.join(
    process.cwd(),
    "src/server/runtime/create-supabase-word-bubble-runtime.ts",
  ),
  "utf8",
);
const bubbleSelector = readFileSync(
  path.join(process.cwd(), "src/server/runtime/create-word-bubble-runtime.ts"),
  "utf8",
);
const matchingActions = readFileSync(
  path.join(process.cwd(), "src/app/play/matching/actions.ts"),
  "utf8",
);
const matchingProduction = readFileSync(
  path.join(
    process.cwd(),
    "src/server/runtime/create-supabase-matching-runtime.ts",
  ),
  "utf8",
);
const matchingSelector = readFileSync(
  path.join(process.cwd(), "src/server/runtime/create-matching-runtime.ts"),
  "utf8",
);
const snakeActions = readFileSync(
  path.join(process.cwd(), "src/app/play/snake/actions.ts"),
  "utf8",
);
const snakeProduction = readFileSync(
  path.join(process.cwd(), "src/server/runtime/create-supabase-snake-runtime.ts"),
  "utf8",
);
const snakeSelector = readFileSync(
  path.join(process.cwd(), "src/server/runtime/create-snake-runtime.ts"),
  "utf8",
);
const trainingActions = readFileSync(
  path.join(process.cwd(), "src/app/train/actions.ts"),
  "utf8",
);
const trainingProduction = readFileSync(
  path.join(
    process.cwd(),
    "src/server/runtime/create-supabase-daily-training-runtime.ts",
  ),
  "utf8",
);
const trainingSelector = readFileSync(
  path.join(process.cwd(), "src/server/runtime/create-daily-training-runtime.ts"),
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
    expect(selector).toContain("isMemoryGameRuntime");
    expect(selector).toContain("createSupabaseRangerTrialRuntime");
    expect(productionRuntime).toContain("requires Supabase configuration");
  });
});

describe("Word Bubble production wiring", () => {
  it("student-facing actions use the generic runtime selector", () => {
    expect(bubbleActions).toContain("createWordBubbleRuntime");
    expect(bubbleActions).not.toContain("InMemoryLearningRepository");
    expect(bubbleActions).not.toContain("InMemoryLearningTaskRepository");
    expect(bubbleActions).not.toContain("InMemoryGameSessionStore");
    expect(bubbleActions).not.toContain("new SeededRandomSource");
  });

  it("Supabase factory reuses durable learning/task adapters and a typed session store", () => {
    expect(bubbleProduction).toContain("SupabaseLearningRepository");
    expect(bubbleProduction).toContain("SupabaseLearningTaskRepository");
    expect(bubbleProduction).toContain("SupabaseLearningStateQueryRepository");
    expect(bubbleProduction).toContain("SupabaseGameSessionStore");
    expect(bubbleProduction).toContain("WORD_BUBBLE");
    expect(bubbleProduction).not.toContain("InMemoryLearningRepository");
    expect(bubbleSelector).toContain("isMemoryGameRuntime");
    expect(bubbleSelector).toContain("createSupabaseWordBubbleRuntime");
  });
});

describe("Matching production wiring", () => {
  it("student-facing actions use the generic runtime selector", () => {
    expect(matchingActions).toContain("createMatchingRuntime");
    expect(matchingActions).not.toContain("InMemoryLearningRepository");
    expect(matchingActions).not.toContain("InMemoryLearningTaskRepository");
    expect(matchingActions).not.toContain("InMemoryGameSessionStore");
    expect(matchingActions).not.toContain("new SeededRandomSource");
  });

  it("Supabase factory reuses durable learning/task adapters and a typed session store", () => {
    expect(matchingProduction).toContain("SupabaseLearningRepository");
    expect(matchingProduction).toContain("SupabaseLearningTaskRepository");
    expect(matchingProduction).toContain("SupabaseLearningStateQueryRepository");
    expect(matchingProduction).toContain("SupabaseGameSessionStore");
    expect(matchingProduction).toContain("MATCHING");
    expect(matchingProduction).not.toContain("InMemoryLearningRepository");
    expect(matchingSelector).toContain("isMemoryGameRuntime");
    expect(matchingSelector).toContain("createSupabaseMatchingRuntime");
  });
});

describe("Snake production wiring", () => {
  it("student-facing actions use the generic runtime selector", () => {
    expect(snakeActions).toContain("createSnakeRuntime");
    expect(snakeActions).not.toContain("InMemoryLearningRepository");
    expect(snakeActions).not.toContain("InMemoryLearningTaskRepository");
    expect(snakeActions).not.toContain("InMemoryGameSessionStore");
    expect(snakeActions).not.toContain("new SeededRandomSource");
  });

  it("Supabase factory reuses durable learning/task adapters and a typed session store", () => {
    expect(snakeProduction).toContain("SupabaseLearningRepository");
    expect(snakeProduction).toContain("SupabaseLearningTaskRepository");
    expect(snakeProduction).toContain("SupabaseLearningStateQueryRepository");
    expect(snakeProduction).toContain("SupabaseGameSessionStore");
    expect(snakeProduction).toContain("SNAKE");
    expect(snakeProduction).not.toContain("InMemoryLearningRepository");
    expect(snakeSelector).toContain("isMemoryGameRuntime");
    expect(snakeSelector).toContain("createSupabaseSnakeRuntime");
  });
});

describe("Daily Training production wiring", () => {
  it("student-facing actions use the Daily Training runtime selector", () => {
    expect(trainingActions).toContain("createDailyTrainingRuntime");
    expect(trainingActions).not.toContain("InMemoryLearningRepository");
    expect(trainingActions).not.toContain("InMemoryLearningTaskRepository");
    expect(trainingActions).not.toContain("InMemoryDailyTrainingSessionStore");
    expect(trainingActions).not.toContain("new SeededRandomSource");
  });

  it("Supabase factory reuses durable adapters and game_sessions orchestration", () => {
    expect(trainingProduction).toContain("SupabaseLearningRepository");
    expect(trainingProduction).toContain("SupabaseLearningTaskRepository");
    expect(trainingProduction).toContain("SupabaseLearningStateQueryRepository");
    expect(trainingProduction).toContain("SupabaseDailyTrainingSessionStore");
    expect(trainingProduction).toContain("DAILY_TRAINING");
    expect(trainingProduction).not.toContain("InMemoryLearningRepository");
    expect(trainingSelector).toContain("isMemoryGameRuntime");
    expect(trainingSelector).toContain("createSupabaseDailyTrainingRuntime");
  });
});

describe("Shared game runtime reliability wiring", () => {
  it("Supabase server client uses the shared timed fetch adapter", () => {
    const supabaseServer = readFileSync(
      path.join(process.cwd(), "src/lib/supabase/server.ts"),
      "utf8",
    );
    expect(supabaseServer).toContain("createTimedFetch");
  });

  it("memory fixture helper keeps RANGER_TRIAL_RUNTIME and accepts GAME_RUNTIME", () => {
    const helper = readFileSync(
      path.join(process.cwd(), "src/lib/runtime/game-runtime-mode.ts"),
      "utf8",
    );
    expect(helper).toContain("GAME_RUNTIME");
    expect(helper).toContain("RANGER_TRIAL_RUNTIME");
  });
});
