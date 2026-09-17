import { AnswerMode, PromptMode } from "@/domain/learning/evidence.types";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import {
  LearningTaskType,
  TASK_GENERATOR_VERSION,
  TASK_PROTOCOL_VERSION,
} from "@/domain/tasks/task-type";
import { createInMemoryRangerTrialRuntime } from "@/server/runtime/create-in-memory-ranger-trial-runtime";
import type { InMemoryRangerTrialRuntime } from "@/server/runtime/create-in-memory-ranger-trial-runtime";
import { createInMemoryWordBubbleRuntime } from "@/server/runtime/create-in-memory-word-bubble-runtime";
import { createInMemoryMatchingRuntime } from "@/server/runtime/create-in-memory-matching-runtime";
import { createInMemorySnakeRuntime } from "@/server/runtime/create-in-memory-snake-runtime";
import type { InMemoryGameSessionStore } from "@/server/game-session/in-memory-game-session-store";
import { LexemeRelationType } from "@/domain/vocabulary/lexeme-relation";
import { sequentialIdFactory } from "../learning/helpers";

export const RANGER_NOW = "2026-09-16T12:00:00.000Z";
export const RANGER_USER = "ranger-test-user";

export function createRangerTrialWorld(userId = RANGER_USER) {
  const runtime = createInMemoryRangerTrialRuntime({
    userId,
    now: () => RANGER_NOW,
    createSessionId: sequentialIdFactory("sess"),
    createId: sequentialIdFactory("rid"),
    createEvidenceId: sequentialIdFactory("ev"),
    requestedNeedCount: 8,
  });
  const controller = runtime.createController();
  return {
    vocabulary: runtime.vocabulary,
    learning: runtime.learning,
    query: runtime.learningStateQuery,
    tasks: runtime.tasks,
    sessions: runtime.rangerTrialSessions,
    controller,
    userId,
    createController: () => runtime.createController(),
    runtime,
  };
}

export type RangerTrialWorld = ReturnType<typeof createRangerTrialWorld>;
export type SharedRangerTrialRuntime = InMemoryRangerTrialRuntime;

export function createSnakeWorld(
  userId = "snake-test-user",
  options?: { sessions?: InMemoryGameSessionStore },
) {
  const runtime = createInMemorySnakeRuntime({
    userId,
    now: () => RANGER_NOW,
    createSessionId: sequentialIdFactory("ssess"),
    createId: sequentialIdFactory("sid"),
    createEvidenceId: sequentialIdFactory("sev"),
    requestedNeedCount: 8,
    sessions: options?.sessions,
  });
  return {
    vocabulary: runtime.vocabulary,
    learning: runtime.learning,
    query: runtime.learningStateQuery,
    tasks: runtime.tasks,
    sessions: runtime.sessions,
    controller: runtime.createController(),
    userId,
    createController: () => runtime.createController(),
    runtime,
  };
}

export function createMatchingWorld(
  userId = "matching-test-user",
  options?: { sessions?: InMemoryGameSessionStore },
) {
  const runtime = createInMemoryMatchingRuntime({
    userId,
    now: () => RANGER_NOW,
    createSessionId: sequentialIdFactory("msess"),
    createId: sequentialIdFactory("mid"),
    createEvidenceId: sequentialIdFactory("mev"),
    requestedNeedCount: 8,
    sessions: options?.sessions,
  });
  return {
    vocabulary: runtime.vocabulary,
    learning: runtime.learning,
    query: runtime.learningStateQuery,
    tasks: runtime.tasks,
    sessions: runtime.sessions,
    controller: runtime.createController(),
    userId,
    createController: () => runtime.createController(),
    runtime,
  };
}

export function createWordBubbleWorld(userId = "bubble-test-user") {
  const runtime = createInMemoryWordBubbleRuntime({
    userId,
    now: () => RANGER_NOW,
    createSessionId: sequentialIdFactory("bsess"),
    createId: sequentialIdFactory("bid"),
    createEvidenceId: sequentialIdFactory("bev"),
    requestedNeedCount: 8,
  });
  return {
    vocabulary: runtime.vocabulary,
    learning: runtime.learning,
    query: runtime.learningStateQuery,
    tasks: runtime.tasks,
    sessions: runtime.sessions,
    controller: runtime.createController(),
    userId,
    createController: () => runtime.createController(),
    runtime,
  };
}

export function collectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectKeys(item, keys);
    }
    return keys;
  }
  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      keys.add(key);
      collectKeys(nested, keys);
    }
  }
  return keys;
}

export const ANSWER_KEY_FIELDS = [
  "answerKey",
  "correctOptionIds",
  "optionLexemeIds",
  "expectedAnswer",
  "semanticAcceptedTexts",
  "exactAcceptedTexts",
  "isCorrect",
] as const;

export function makePublicTask(
  overrides: Partial<PublicLearningTask> &
    Pick<
      PublicLearningTask,
      | "taskType"
      | "targetSkill"
      | "promptMode"
      | "answerMode"
      | "prompt"
      | "responseContract"
    >,
): PublicLearningTask {
  return {
    id: "public-task-1",
    protocolVersion: TASK_PROTOCOL_VERSION,
    generatorVersion: TASK_GENERATOR_VERSION,
    learningNeedId: "need-1",
    lexemeId: "lex-1",
    difficulty: 0.45,
    hints: [],
    createdAt: RANGER_NOW,
    ...overrides,
  };
}

export function meaningChoiceTask(): PublicLearningTask {
  return makePublicTask({
    taskType: LearningTaskType.MEANING_CHOICE,
    targetSkill: VocabularySkill.MEANING_RECOGNITION,
    promptMode: PromptMode.WORD_TO_MEANING,
    answerMode: AnswerMode.MULTIPLE_CHOICE,
    prompt: { kind: "LEXEME_TEXT", text: "quiet" },
    responseContract: {
      kind: "CHOICE",
      options: [
        { id: "opt-a", content: { kind: "TEXT", text: "安静" } },
        { id: "opt-b", content: { kind: "TEXT", text: "完全" } },
        { id: "opt-c", content: { kind: "TEXT", text: "迅速" } },
      ],
    },
  });
}

export function relationChoiceTask(): PublicLearningTask {
  return makePublicTask({
    id: "public-task-relation",
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
        { id: "opt-c", content: { kind: "TEXT", text: "silent" } },
      ],
    },
  });
}

export function confusableChoiceTask(): PublicLearningTask {
  return makePublicTask({
    id: "public-task-confusable",
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
        { id: "opt-c", content: { kind: "TEXT", text: "quit" } },
      ],
    },
  });
}

export function spellingTask(): PublicLearningTask {
  return makePublicTask({
    taskType: LearningTaskType.SPELLING_RECALL_TYPING,
    targetSkill: VocabularySkill.SPELLING_RECALL,
    promptMode: PromptMode.MEANING_TO_SPELLING,
    answerMode: AnswerMode.SPELLING,
    prompt: { kind: "MEANING_TEXT", text: "安静" },
    responseContract: {
      kind: "TEXT_INPUT",
      placeholder: "输入英文单词",
      maxLength: 40,
    },
  });
}
