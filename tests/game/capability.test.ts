import { describe, expect, it } from "vitest";
import { AnswerMode, PromptMode } from "@/domain/learning/evidence.types";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { LearningTaskType } from "@/domain/tasks/task-type";
import { canGameRenderTask } from "@/server/game-session/can-game-render-task";
import { RANGER_TRIAL_CAPABILITY } from "@/server/game-session/ranger-trial-capability";
import { RangerTrialSessionController } from "@/server/game-session/ranger-trial-session";
import type { TaskGenerator } from "@/domain/tasks/task-generator";
import { makePublicTask, meaningChoiceTask, spellingTask, createRangerTrialWorld } from "./helpers";
import { LexemeRelationType } from "@/domain/vocabulary/lexeme-relation";

function relationTask() {
  return makePublicTask({
    taskType: LearningTaskType.RELATION_CHOICE,
    targetSkill: VocabularySkill.SEMANTIC_CONNECTION,
    promptMode: PromptMode.WORD_TO_RELATION,
    answerMode: AnswerMode.MULTIPLE_CHOICE,
    prompt: {
      kind: "RELATION",
      sourceText: "quiet",
      relationType: LexemeRelationType.ANTONYM,
    },
    responseContract: {
      kind: "CHOICE",
      options: [
        { id: "opt-a", content: { kind: "TEXT", text: "loud" } },
        { id: "opt-b", content: { kind: "TEXT", text: "quite" } },
      ],
    },
  });
}

function confusableTask() {
  return makePublicTask({
    taskType: LearningTaskType.CONFUSABLE_CHOICE,
    targetSkill: VocabularySkill.MEANING_RECOGNITION,
    promptMode: PromptMode.WORD_TO_MEANING,
    answerMode: AnswerMode.MULTIPLE_CHOICE,
    prompt: { kind: "LEXEME_TEXT", text: "quiet" },
    responseContract: {
      kind: "CHOICE",
      options: [
        { id: "opt-a", content: { kind: "TEXT", text: "quite" } },
        { id: "opt-b", content: { kind: "TEXT", text: "quiet" } },
      ],
    },
  });
}

function recallTask() {
  return makePublicTask({
    taskType: LearningTaskType.ACTIVE_RECALL_TYPING,
    targetSkill: VocabularySkill.ACTIVE_RECALL,
    promptMode: PromptMode.MEANING_TO_WORD,
    answerMode: AnswerMode.TYPING,
    prompt: { kind: "MEANING_TEXT", text: "安静" },
    responseContract: { kind: "TEXT_INPUT", maxLength: 40 },
  });
}

describe("G1 Ranger Trial capability", () => {
  it("accepts all V1 executable task contracts", () => {
    const tasks = [
      meaningChoiceTask(),
      relationTask(),
      confusableTask(),
      recallTask(),
      spellingTask(),
    ];
    for (const task of tasks) {
      expect(
        canGameRenderTask(RANGER_TRIAL_CAPABILITY, task),
        task.taskType,
      ).toBe(true);
    }
  });
});

describe("G11 unsupported tasks", () => {
  it("rejects listening/audio/matching contracts instead of guessing", () => {
    const unsupported = makePublicTask({
      taskType: LearningTaskType.MEANING_CHOICE,
      targetSkill: VocabularySkill.LISTENING_RECOGNITION,
      promptMode: PromptMode.AUDIO_TO_WORD,
      answerMode: AnswerMode.MATCHING,
      prompt: { kind: "LEXEME_TEXT", text: "quiet" },
      responseContract: {
        kind: "CHOICE",
        options: [{ id: "opt-a", content: { kind: "TEXT", text: "安静" } }],
      },
    });
    expect(canGameRenderTask(RANGER_TRIAL_CAPABILITY, unsupported)).toBe(false);
  });

  it("returns GAME_CANNOT_RENDER_TASK when a generated task is unrenderable", async () => {
    const world = createRangerTrialWorld();
    const unrenderable = makePublicTask({
      id: "bad-task",
      taskType: LearningTaskType.MEANING_CHOICE,
      targetSkill: VocabularySkill.LISTENING_RECOGNITION,
      promptMode: PromptMode.AUDIO_TO_WORD,
      answerMode: AnswerMode.MATCHING,
      prompt: { kind: "LEXEME_TEXT", text: "nope" },
      responseContract: {
        kind: "CHOICE",
        options: [{ id: "opt-a", content: { kind: "TEXT", text: "x" } }],
      },
    });
    const generator: TaskGenerator = {
      async generate() {
        return {
          status: "GENERATED",
          value: {
            publicTask: unrenderable,
            answerKey: {
              taskId: unrenderable.id,
              targetLexemeId: unrenderable.lexemeId,
              correctOptionIds: ["opt-a"],
              optionLexemeIds: {},
              exactAcceptedTexts: [],
              semanticAcceptedTexts: [],
            },
            generationTrace: {
              generatorVersion: "v1",
              archetype: LearningTaskType.MEANING_CHOICE,
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
    const controller = new RangerTrialSessionController({
      ...world,
      generator,
    });
    await expect(controller.start()).rejects.toMatchObject({
      code: "GAME_CANNOT_RENDER_TASK",
    });
  });
});
