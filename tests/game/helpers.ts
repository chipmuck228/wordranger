import { AnswerMode, PromptMode } from "@/domain/learning/evidence.types";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import {
  LearningTaskType,
  TASK_GENERATOR_VERSION,
  TASK_PROTOCOL_VERSION,
} from "@/domain/tasks/task-type";
import { SeededRandomSource } from "@/domain/tasks/random-source";
import { RangerTrialSessionController } from "@/server/game-session/ranger-trial-session";
import { InMemoryRangerTrialSessionStore } from "@/server/game-session/in-memory-ranger-trial-session-store";
import { InMemoryLearningRepository } from "@/server/learning/in-memory-learning-repository";
import { InMemoryLearningStateQueryRepository } from "@/server/scheduler/in-memory-learning-state-query-repository";
import { InMemoryLearningTaskRepository } from "@/server/tasks/in-memory-learning-task-repository";
import { loadVocabularyDataset } from "@/server/vocabulary/load-vocabulary-dataset";
import { InMemoryVocabularyRepository } from "@/server/vocabulary/in-memory-vocabulary-repository";
import { sequentialIdFactory } from "../learning/helpers";

export const RANGER_NOW = "2026-09-16T12:00:00.000Z";
export const RANGER_USER = "ranger-test-user";

const dataset = loadVocabularyDataset();

export function createRangerTrialWorld(userId = RANGER_USER) {
  const vocabulary = new InMemoryVocabularyRepository(dataset);
  const learning = new InMemoryLearningRepository();
  const query = new InMemoryLearningStateQueryRepository(learning);
  const tasks = new InMemoryLearningTaskRepository();
  const sessions = new InMemoryRangerTrialSessionStore();
  const controller = new RangerTrialSessionController({
    userId,
    vocabulary,
    query,
    tasks,
    learning,
    sessions,
    now: () => RANGER_NOW,
    createSessionId: sequentialIdFactory("sess"),
    createId: sequentialIdFactory("rid"),
    createEvidenceId: sequentialIdFactory("ev"),
    random: new SeededRandomSource("ranger-test"),
    requestedNeedCount: 8,
  });
  return { vocabulary, learning, query, tasks, sessions, controller, userId };
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
    Pick<PublicLearningTask, "taskType" | "targetSkill" | "promptMode" | "answerMode" | "prompt" | "responseContract">,
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
