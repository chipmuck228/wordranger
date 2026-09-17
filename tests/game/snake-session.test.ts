import { describe, expect, it } from "vitest";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { LearningTaskType } from "@/domain/tasks/task-type";
import { SNAKE_GAME_ID, SNAKE_GAME_TYPE } from "@/server/auth/v1-user";
import { SnakeSessionController } from "@/server/game-session/snake-session";
import { canSnakeRenderTask } from "@/server/game-session/snake-capability";
import { InMemoryGameSessionStore } from "@/server/game-session/in-memory-game-session-store";
import type { TaskGenerator } from "@/domain/tasks/task-generator";
import {
  createSnakeWorld,
  makePublicTask,
  meaningChoiceTask,
  spellingTask,
} from "./helpers";
import { AnswerMode, PromptMode } from "@/domain/learning/evidence.types";

function choiceIntent(task: {
  responseContract: { kind: string; options?: Array<{ id: string }> };
}) {
  if (task.responseContract.kind !== "CHOICE" || !task.responseContract.options) {
    throw new Error("expected CHOICE");
  }
  return {
    kind: "CHOICE" as const,
    optionId: task.responseContract.options[0].id,
  };
}

function fulfilledTasks(
  results: PromiseSettledResult<{ task?: { id: string } }>[],
) {
  return results
    .filter(
      (result): result is PromiseFulfilledResult<{ task?: { id: string } }> =>
        result.status === "fulfilled" && Boolean(result.value.task),
    )
    .map((result) => result.value.task!.id);
}

describe("Snake session", () => {
  it("S18: start Snake returns a playable CHOICE task", async () => {
    const world = createSnakeWorld();
    const started = await world.controller.start();
    expect(started.task.responseContract.kind).toBe("CHOICE");
    expect(canSnakeRenderTask(started.task)).toBe(true);
    const record = await world.sessions.get(started.session.sessionId);
    expect(
      record?.needs.every(
        (need) =>
          need.targetSkill === VocabularySkill.MEANING_RECOGNITION ||
          need.targetSkill === VocabularySkill.SEMANTIC_CONNECTION,
      ),
    ).toBe(true);
  });

  it("S19: submit Snake collision writes Evidence via submitTaskAction", async () => {
    const world = createSnakeWorld();
    const started = await world.controller.start();
    const submitted = await world.controller.submit({
      sessionId: started.session.sessionId,
      taskId: started.task.id,
      intent: choiceIntent(started.task),
      responseTimeMs: 4200,
    });
    expect(submitted.feedback.status).toBeTruthy();
    const evidence = world.learning.listEvidenceForUser(world.userId);
    expect(evidence).toHaveLength(1);
    expect(evidence[0].taskId).toBe(started.task.id);
  });

  it("S20: Evidence gameId is SNAKE", async () => {
    const world = createSnakeWorld();
    const started = await world.controller.start();
    await world.controller.submit({
      sessionId: started.session.sessionId,
      taskId: started.task.id,
      intent: choiceIntent(started.task),
      responseTimeMs: 400,
    });
    expect(world.learning.listEvidenceForUser(world.userId)[0].gameId).toBe(
      SNAKE_GAME_ID,
    );
  });

  it("S21: continue returns the next Snake-compatible task", async () => {
    const world = createSnakeWorld();
    const started = await world.controller.start();
    await world.controller.submit({
      sessionId: started.session.sessionId,
      taskId: started.task.id,
      intent: choiceIntent(started.task),
      responseTimeMs: 400,
    });
    const continued = await world.controller.continue(started.session.sessionId);
    expect(continued.completed).toBe(false);
    expect(continued.task).toBeTruthy();
    expect(continued.task?.responseContract.kind).toBe("CHOICE");
    expect(canSnakeRenderTask(continued.task!)).toBe(true);
    expect(continued.task?.id).not.toBe(started.task.id);
  });

  it("S22: resume restores the same current task", async () => {
    const world = createSnakeWorld();
    const started = await world.controller.start();
    const resumed = await world.createController().resume(started.session.sessionId);
    expect(resumed.task?.id).toBe(started.task.id);
    expect(resumed.progress.sessionId).toBe(started.session.sessionId);
  });

  it("S23: game_type SNAKE is persisted", async () => {
    const shared = new Map();
    const sessions = new InMemoryGameSessionStore(SNAKE_GAME_TYPE, shared);
    const world = createSnakeWorld("snake-type-user", { sessions });
    const started = await world.controller.start();
    expect(shared.get(started.session.sessionId)?.gameType).toBe(SNAKE_GAME_TYPE);
  });

  it("S24: double continue produces one next task", async () => {
    const world = createSnakeWorld();
    const started = await world.controller.start();
    await world.controller.submit({
      sessionId: started.session.sessionId,
      taskId: started.task.id,
      intent: choiceIntent(started.task),
      responseTimeMs: 400,
    });
    const tasksBefore = world.tasks.listTaskIds();
    const results = await Promise.allSettled([
      world.controller.continue(started.session.sessionId),
      world.createController().continue(started.session.sessionId),
    ]);
    const record = await world.sessions.get(started.session.sessionId);
    expect(record?.currentNeedIndex).toBe(1);
    expect(record?.currentTaskId).toBeTruthy();
    const returned = fulfilledTasks(results);
    expect(new Set(returned).size).toBeLessThanOrEqual(1);
    const generatedAfterContinue = world.tasks
      .listTaskIds()
      .filter((id) => !tasksBefore.includes(id));
    expect(generatedAfterContinue).toHaveLength(1);
    expect(generatedAfterContinue[0]).toBe(record?.currentTaskId);
  });

  it("S25: concurrent submit produces one Evidence", async () => {
    const world = createSnakeWorld();
    const started = await world.controller.start();
    const payload = {
      sessionId: started.session.sessionId,
      taskId: started.task.id,
      intent: choiceIntent(started.task),
      responseTimeMs: 400,
    };
    await Promise.allSettled([
      world.controller.submit(payload),
      world.createController().submit(payload),
    ]);
    expect(world.learning.listEvidenceForUser(world.userId)).toHaveLength(1);
    const record = await world.sessions.get(started.session.sessionId);
    expect(record?.stats.attempted).toBe(1);
    expect(record?.lastCompletedTaskId).toBe(started.task.id);
    expect(record?.phase).toBe("awaiting_continue");
  });

  it("S26: resume generation race produces one current task", async () => {
    const world = createSnakeWorld();
    const started = await world.controller.start();
    const existing = await world.sessions.get(started.session.sessionId);
    expect(existing).toBeTruthy();
    await world.sessions.save({
      ...existing!,
      currentTaskId: null,
    });
    const tasksBefore = world.tasks.listTaskIds();
    const results = await Promise.allSettled([
      world.controller.resume(started.session.sessionId),
      world.createController().resume(started.session.sessionId),
    ]);
    const record = await world.sessions.get(started.session.sessionId);
    expect(record?.phase).toBe("awaiting_action");
    expect(record?.currentTaskId).toBeTruthy();
    const returned = fulfilledTasks(results);
    expect(new Set(returned).size).toBeLessThanOrEqual(1);
    const generated = world.tasks
      .listTaskIds()
      .filter((id) => !tasksBefore.includes(id));
    expect(generated).toHaveLength(1);
    expect(generated[0]).toBe(record?.currentTaskId);
  });

  it("movement ticks do not create Evidence until a CHOICE is submitted", async () => {
    const world = createSnakeWorld();
    const started = await world.controller.start();
    expect(world.learning.listEvidenceForUser(world.userId)).toHaveLength(0);
    await world.controller.submit({
      sessionId: started.session.sessionId,
      taskId: started.task.id,
      intent: choiceIntent(started.task),
      responseTimeMs: 5000,
    });
    expect(world.learning.listEvidenceForUser(world.userId)).toHaveLength(1);
  });

  it("rejects TEXT_INPUT even after need filtering", async () => {
    const world = createSnakeWorld();
    const unrenderable = spellingTask();
    const generator: TaskGenerator = {
      async generate() {
        return {
          status: "GENERATED",
          value: {
            publicTask: unrenderable,
            answerKey: {
              taskId: unrenderable.id,
              targetLexemeId: unrenderable.lexemeId,
              correctOptionIds: [],
              optionLexemeIds: {},
              exactAcceptedTexts: ["quiet"],
              semanticAcceptedTexts: ["quiet"],
            },
            generationTrace: {
              generatorVersion: "v1",
              archetype: LearningTaskType.SPELLING_RECALL_TYPING,
              targetLexemeId: unrenderable.lexemeId,
              candidateLexemeIds: [],
              selectedDistractorLexemeIds: [],
              relationIds: [],
              blockedCandidates: [],
              policyVersion: "v1",
            },
          },
        };
      },
    };
    const controller = new SnakeSessionController({
      ...world,
      generator,
    });
    await expect(controller.start()).rejects.toMatchObject({
      code: "GAME_CANNOT_RENDER_TASK",
    });
    expect(canSnakeRenderTask(unrenderable)).toBe(false);
    expect(canSnakeRenderTask(meaningChoiceTask())).toBe(true);
    expect(
      canSnakeRenderTask(
        makePublicTask({
          taskType: LearningTaskType.MEANING_CHOICE,
          targetSkill: VocabularySkill.MEANING_RECOGNITION,
          promptMode: PromptMode.WORD_TO_MEANING,
          answerMode: AnswerMode.MULTIPLE_CHOICE,
          prompt: { kind: "LEXEME_TEXT", text: "quiet" },
          responseContract: {
            kind: "TEXT_INPUT",
            maxLength: 40,
          },
        }),
      ),
    ).toBe(false);
  });
});
