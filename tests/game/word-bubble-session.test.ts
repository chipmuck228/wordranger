import { describe, expect, it } from "vitest";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { LearningTaskType } from "@/domain/tasks/task-type";
import { WORD_BUBBLE_GAME_ID } from "@/server/auth/v1-user";
import { WordBubbleSessionController } from "@/server/game-session/word-bubble-session";
import { canWordBubbleRenderTask } from "@/server/game-session/word-bubble-capability";
import type { TaskGenerator } from "@/domain/tasks/task-generator";
import {
  createWordBubbleWorld,
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

describe("Word Bubble session", () => {
  it("B9: start Word Bubble produces a CHOICE task", async () => {
    const world = createWordBubbleWorld();
    const started = await world.controller.start();
    expect(started.task.responseContract.kind).toBe("CHOICE");
    expect(canWordBubbleRenderTask(started.task)).toBe(true);
    const record = await world.sessions.get(started.session.sessionId);
    expect(
      record?.needs.every(
        (need) =>
          need.targetSkill === VocabularySkill.MEANING_RECOGNITION ||
          need.targetSkill === VocabularySkill.SEMANTIC_CONNECTION,
      ),
    ).toBe(true);
  });

  it("B10: submit Bubble choice produces Evidence via submitTaskAction", async () => {
    const world = createWordBubbleWorld();
    const started = await world.controller.start();
    const submitted = await world.controller.submit({
      sessionId: started.session.sessionId,
      taskId: started.task.id,
      intent: choiceIntent(started.task),
      responseTimeMs: 650,
    });
    expect(submitted.feedback.status).toBeTruthy();
    const evidence = world.learning.listEvidenceForUser(world.userId);
    expect(evidence).toHaveLength(1);
    expect(evidence[0].taskId).toBe(started.task.id);
    expect(evidence[0].gameId).toBe(WORD_BUBBLE_GAME_ID);
  });

  it("B11: continue returns another Bubble-compatible task", async () => {
    const world = createWordBubbleWorld();
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
    expect(canWordBubbleRenderTask(continued.task!)).toBe(true);
    expect(continued.task?.id).not.toBe(started.task.id);
  });

  it("B12: refresh/resume restores the same current task", async () => {
    const world = createWordBubbleWorld();
    const started = await world.controller.start();
    const resumed = await world.createController().resume(started.session.sessionId);
    expect(resumed.task?.id).toBe(started.task.id);
    expect(resumed.progress.sessionId).toBe(started.session.sessionId);
  });

  it("B13: CAS double continue produces one next task", async () => {
    const world = createWordBubbleWorld();
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

  it("B14: concurrent submit produces one Evidence", async () => {
    const world = createWordBubbleWorld();
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
    expect(record?.revision).toBeGreaterThanOrEqual(1);
  });

  it("rejects TEXT_INPUT even after need filtering", async () => {
    const world = createWordBubbleWorld();
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
    const controller = new WordBubbleSessionController({
      ...world,
      generator,
    });
    await expect(controller.start()).rejects.toMatchObject({
      code: "GAME_CANNOT_RENDER_TASK",
    });
    expect(canWordBubbleRenderTask(unrenderable)).toBe(false);
    expect(canWordBubbleRenderTask(meaningChoiceTask())).toBe(true);
    expect(
      canWordBubbleRenderTask(
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
