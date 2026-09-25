import { afterEach, describe, expect, it, vi } from "vitest";
import { GameSessionError } from "@/server/game-session/ranger-trial-errors";
import { MatchingSessionController } from "@/server/game-session/matching-session";
import { RangerTrialSessionController } from "@/server/game-session/ranger-trial-session";
import { SnakeSessionController } from "@/server/game-session/snake-session";
import { WordBubbleSessionController } from "@/server/game-session/word-bubble-session";
import type { LearningStateQueryRepository } from "@/server/scheduler/learning-state-query-repository";
import type { LearningTaskRepository } from "@/domain/tasks/learning-task-repository";
import type { GameSessionStore } from "@/server/game-session/learning-game-session.types";
import { sequentialIdFactory } from "../learning/helpers";
import {
  createMatchingWorld,
  createRangerTrialWorld,
  createSnakeWorld,
  createWordBubbleWorld,
  RANGER_NOW,
} from "./helpers";

function hang<T>(): Promise<T> {
  return new Promise(() => undefined);
}

function hangingQuery(): LearningStateQueryRepository {
  return {
    listStudentLexemeModels: () => hang(),
    getRecentLearningActivity: () => hang(),
  };
}

function withTimeoutBudget(ms = "80"): void {
  vi.stubEnv("WORD_RANGER_PERSISTENCE_TIMEOUT_MS", ms);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("R1 hanging scheduler reads", () => {
  it.each([
    ["Matching", () => createMatchingWorld(), MatchingSessionController],
    ["Ranger Trial", () => createRangerTrialWorld(), RangerTrialSessionController],
    ["Word Bubble", () => createWordBubbleWorld(), WordBubbleSessionController],
    ["Snake", () => createSnakeWorld(), SnakeSessionController],
  ] as const)(
    "%s start fails with NETWORK_ERROR when scheduler queries never resolve",
    async (_label, createWorld, Controller) => {
      withTimeoutBudget("80");
      const world = createWorld();
      const controller = new Controller({
        userId: world.userId,
        vocabulary: world.vocabulary,
        query: hangingQuery(),
        tasks: world.tasks,
        learning: world.learning,
        sessions: world.sessions,
        now: () => RANGER_NOW,
        createId: sequentialIdFactory("r1"),
        createSessionId: sequentialIdFactory("r1s"),
        createEvidenceId: sequentialIdFactory("r1e"),
      });
      const startedAt = Date.now();
      await expect(controller.start()).rejects.toMatchObject({
        code: "NETWORK_ERROR",
      } satisfies Partial<GameSessionError>);
      expect(Date.now() - startedAt).toBeLessThan(1500);
    },
  );
});

describe("R2 hanging game session create", () => {
  it("Matching start fails with NETWORK_ERROR when session create never resolves", async () => {
    withTimeoutBudget("2500");
    const world = createMatchingWorld();
    const sessions: GameSessionStore = {
      create: () => hang(),
      save: (record) => world.sessions.save(record),
      get: (sessionId) => world.sessions.get(sessionId),
    };
    const controller = new MatchingSessionController({
      userId: world.userId,
      vocabulary: world.vocabulary,
      query: world.query,
      tasks: world.tasks,
      learning: world.learning,
      sessions,
      now: () => RANGER_NOW,
      createId: sequentialIdFactory("r2"),
      createSessionId: sequentialIdFactory("r2s"),
      createEvidenceId: sequentialIdFactory("r2e"),
    });
    const startedAt = Date.now();
    await expect(controller.start()).rejects.toMatchObject({
      code: "NETWORK_ERROR",
    });
    expect(Date.now() - startedAt).toBeLessThan(10_000);
  });
});

describe("R3 hanging task persistence", () => {
  it("Matching start fails with NETWORK_ERROR when task save never resolves", async () => {
    withTimeoutBudget("2500");
    const world = createMatchingWorld();
    const tasks: LearningTaskRepository = {
      saveGeneratedTask: () => hang(),
      getTaskForEvaluation: (lookup) => world.tasks.getTaskForEvaluation(lookup),
    };
    const controller = new MatchingSessionController({
      userId: world.userId,
      vocabulary: world.vocabulary,
      query: world.query,
      tasks,
      learning: world.learning,
      sessions: world.sessions,
      now: () => RANGER_NOW,
      createId: sequentialIdFactory("r3"),
      createSessionId: sequentialIdFactory("r3s"),
      createEvidenceId: sequentialIdFactory("r3e"),
    });
    const startedAt = Date.now();
    await expect(controller.start()).rejects.toMatchObject({
      code: "NETWORK_ERROR",
    });
    expect(Date.now() - startedAt).toBeLessThan(10_000);
  });
});
