import { describe, expect, it } from "vitest";
import { lexemeIdFromCanonicalKey } from "@/lib/canonical-id";
import {
  bindGeneratedTaskToVocabulary,
  contextLabBoundLexemeId,
} from "@/server/context-lab/bind-generated-task-to-vocabulary";
import { toGeneratedLearningTask } from "@/server/context-lab/to-generated-learning-task";
import { LearningTaskType, TASK_GENERATOR_VERSION, TASK_PROTOCOL_VERSION } from "@/domain/tasks/task-type";
import { AnswerMode, PromptMode } from "@/domain/learning/evidence.types";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";

describe("bindGeneratedTaskToVocabulary", () => {
  it("rewrites the Meal spoon fixture onto the bundled vocabulary UUID", () => {
    const boundId = contextLabBoundLexemeId("lex-spoon");
    expect(boundId).toBe(lexemeIdFromCanonicalKey("lex-1311-1"));
    const generated = toGeneratedLearningTask({
      publicTask: {
        id: "00000000-0000-5000-8000-000000000099",
        protocolVersion: TASK_PROTOCOL_VERSION,
        generatorVersion: TASK_GENERATOR_VERSION,
        learningNeedId: "need",
        lexemeId: "lex-spoon",
        targetSkill: VocabularySkill.ACTIVE_RECALL,
        taskType: LearningTaskType.ACTIVE_RECALL_TYPING,
        promptMode: PromptMode.MEANING_TO_WORD,
        answerMode: AnswerMode.TYPING,
        difficulty: 0.5,
        prompt: { kind: "MEANING_TEXT", text: "勺子" },
        responseContract: { kind: "TEXT_INPUT", placeholder: "Type", maxLength: 64 },
        hints: [],
        createdAt: "2026-09-20T00:00:00.000Z",
      },
      answerKey: {
        taskId: "00000000-0000-5000-8000-000000000099",
        targetLexemeId: "lex-spoon",
        correctOptionIds: [],
        optionLexemeIds: {},
        exactAcceptedTexts: ["spoon"],
        semanticAcceptedTexts: [],
      },
    });
    const bound = bindGeneratedTaskToVocabulary(generated);
    expect(bound.ok).toBe(true);
    if (!bound.ok) {
      throw new Error("expected bind");
    }
    expect(bound.task.publicTask.lexemeId).toBe(boundId);
    expect(bound.task.answerKey.targetLexemeId).toBe(boundId);
    expect(bound.task.generationTrace.targetLexemeId).toBe(boundId);
  });

  it("rejects an unknown fixture lexeme instead of writing it to learning_tasks", () => {
    const generated = toGeneratedLearningTask({
      publicTask: {
        id: "00000000-0000-5000-8000-000000000098",
        protocolVersion: TASK_PROTOCOL_VERSION,
        generatorVersion: TASK_GENERATOR_VERSION,
        learningNeedId: "need",
        lexemeId: "lex-fork",
        targetSkill: VocabularySkill.ACTIVE_RECALL,
        taskType: LearningTaskType.ACTIVE_RECALL_TYPING,
        promptMode: PromptMode.MEANING_TO_WORD,
        answerMode: AnswerMode.TYPING,
        difficulty: 0.5,
        prompt: { kind: "MEANING_TEXT", text: "叉子" },
        responseContract: { kind: "TEXT_INPUT", placeholder: "Type", maxLength: 64 },
        hints: [],
        createdAt: "2026-09-20T00:00:00.000Z",
      },
      answerKey: {
        taskId: "00000000-0000-5000-8000-000000000098",
        targetLexemeId: "lex-fork",
        correctOptionIds: [],
        optionLexemeIds: {},
        exactAcceptedTexts: ["fork"],
        semanticAcceptedTexts: [],
      },
    });
    expect(bindGeneratedTaskToVocabulary(generated)).toEqual({
      ok: false,
      reason: "UNBOUND_LEXEME",
    });
  });
});
