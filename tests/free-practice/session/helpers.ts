import { EvidenceOutcome } from "@/domain/learning/evidence.types";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { V1_PLACEHOLDER_USER_ID } from "@/server/auth/v1-user";
import { createTestFreePracticeSessionReader } from "@/server/free-practice/identity/test-session-reader";
import { InMemoryFreePracticePlanReadAdapter } from "@/server/free-practice/planning/in-memory-plan-read-adapter";
import { compareTerminalEvidenceDesc } from "@/server/free-practice/planning/recently-incorrect";
import type {
  FreePracticeLearnerSnapshot,
  FreePracticePlanReadPort,
  FreePracticeTerminalEvidence,
} from "@/server/free-practice/planning/types";
import { FreePracticeSessionController } from "@/server/free-practice/session/controller";
import { InMemoryFreePracticeSessionStore } from "@/server/free-practice/session/in-memory-store";
import type { FreePracticeSessionState } from "@/server/free-practice/session/types";
import { InMemoryLearningRepository } from "@/server/learning/in-memory-learning-repository";
import { InMemoryLearningTaskRepository } from "@/server/tasks/in-memory-learning-task-repository";
import type { LearningTaskRepository } from "@/domain/tasks/learning-task-repository";
import type { StudentActionIntent } from "@/server/game-session/learning-game-session.types";
import type { TaskGenerator } from "@/domain/tasks/task-generator";
import { InMemoryVocabularyRepository } from "@/server/vocabulary/in-memory-vocabulary-repository";
import { tinyDataset } from "../../tasks/helpers";
import {
  evidence,
  makeTestLexeme,
  sequentialIds,
  USER_A,
  USER_B,
} from "../planning/helpers";
import type { Lexeme } from "@/domain/vocabulary/lexeme";

export { USER_A, USER_B, V1_PLACEHOLDER_USER_ID };

export const TEST_IDENTITY_ENV = {
  WORD_RANGER_FREE_PRACTICE_TEST_IDENTITY: "1",
  NODE_ENV: "test",
};

export function unseenLexemes(count: number) {
  return Array.from({ length: count }, (_, index) =>
    makeTestLexeme({
      id: `lex-${String(index + 1).padStart(3, "0")}`,
      sourceIndex: index + 1,
      meaningsZh: [`意思${index + 1}`],
      lemma: `word${index + 1}`,
    }),
  );
}

export class LearningBackedFreePracticePlanReadAdapter
  implements FreePracticePlanReadPort
{
  constructor(
    private readonly learning: InMemoryLearningRepository,
    private readonly extraEvidence: FreePracticeTerminalEvidence[] = [],
  ) {}

  async listStudentLexemeSnapshots(
    userId: string,
  ): Promise<FreePracticeLearnerSnapshot[]> {
    return this.learning.listStudentLexemeModels(userId).map((model) => ({
      lexemeId: model.lexemeId,
      masteryStage: model.masteryStage,
    }));
  }

  async listRecentTerminalEvidence(
    userId: string,
    limit: number,
  ): Promise<FreePracticeTerminalEvidence[]> {
    const fromLearning = this.learning.listEvidenceForUser(userId).map(
      (item) => ({
        id: item.id,
        lexemeId: item.lexemeId,
        skill: item.skill,
        outcome: item.outcome,
        occurredAt: item.occurredAt,
      }),
    );
    return [...fromLearning, ...this.extraEvidence]
      .sort(compareTerminalEvidenceDesc)
      .slice(0, limit);
  }
}

export function sampleAwaitingActionState(
  overrides: Partial<FreePracticeSessionState> = {},
): FreePracticeSessionState {
  return {
    schemaVersion: "fp-session-v2",
    source: "UNSEEN",
    requestedCount: 5,
    plannedCount: 2,
    items: [
      {
        id: "item-a",
        lexemeId: "lex-001",
        targetSkill: VocabularySkill.MEANING_RECOGNITION,
        source: "UNSEEN",
      },
      {
        id: "item-b",
        lexemeId: "lex-002",
        targetSkill: VocabularySkill.MEANING_RECOGNITION,
        source: "UNSEEN",
      },
    ],
    currentIndex: 0,
    assignedItemId: null,
    currentTaskId: null,
    phase: "AWAITING_ACTION",
    attempted: 0,
    correct: 0,
    lastCompletedTaskId: null,
    feedback: null,
    createdAt: "2026-09-24T02:00:00.000Z",
    completedAt: null,
    ...overrides,
  };
}

export async function choiceIntentForTask(
  tasks: LearningTaskRepository,
  taskId: string,
  correct: boolean,
): Promise<StudentActionIntent> {
  const assigned = await tasks.getTaskForEvaluation(taskId);
  if (!assigned || assigned.task.publicTask.responseContract.kind !== "CHOICE") {
    throw new Error(`No CHOICE task ${taskId}`);
  }
  const correctId = assigned.task.answerKey.correctOptionIds[0];
  if (correct) {
    if (!correctId) {
      throw new Error(`No correct option for ${taskId}`);
    }
    return { kind: "CHOICE", optionId: correctId };
  }
  const wrong = assigned.task.publicTask.responseContract.options.find(
    (option) => option.id !== correctId,
  );
  if (!wrong) {
    throw new Error(`No incorrect option for ${taskId}`);
  }
  return { kind: "CHOICE", optionId: wrong.id };
}

export function createSessionHarness(input: {
  userId?: string;
  lexemes?: Array<Partial<Lexeme> & Pick<Lexeme, "id" | "lemma" | "meaningsZh">>;
  incorrectLexemeIds?: string[];
  tasks?: InMemoryLearningTaskRepository;
  sessions?: InMemoryFreePracticeSessionStore;
  learning?: InMemoryLearningRepository;
  generator?: TaskGenerator;
  livePlanRead?: boolean;
  productionIds?: boolean;
}) {
  const env = { ...TEST_IDENTITY_ENV };
  const userId = input.userId ?? USER_A;
  const lexemes = input.lexemes ?? unseenLexemes(20);
  const learning = input.learning ?? new InMemoryLearningRepository();
  const seededEvidence =
    input.incorrectLexemeIds?.map((lexemeId, index) =>
      evidence({
        id: `ev-${index + 1}`,
        lexemeId,
        skill: VocabularySkill.MEANING_RECOGNITION,
        outcome: EvidenceOutcome.INCORRECT,
        occurredAt: new Date(
          Date.UTC(2026, 8, 20, 12, index, 0),
        ).toISOString(),
      }),
    ) ?? [];
  const read = input.livePlanRead
    ? new LearningBackedFreePracticePlanReadAdapter(learning, seededEvidence)
    : new InMemoryFreePracticePlanReadAdapter();
  if (!input.livePlanRead && seededEvidence.length > 0) {
    (read as InMemoryFreePracticePlanReadAdapter).seedEvidence(
      userId,
      seededEvidence,
    );
  }
  const sessions = input.sessions ?? new InMemoryFreePracticeSessionStore();
  const tasks = input.tasks ?? new InMemoryLearningTaskRepository();
  const vocabulary = new InMemoryVocabularyRepository(tinyDataset({ lexemes }));
  const controller = new FreePracticeSessionController({
    vocabulary,
    read,
    tasks,
    sessions,
    learning,
    readSession: createTestFreePracticeSessionReader({
      env,
      userId,
      isAnonymous: true,
    }),
    env,
    createSessionId: input.productionIds
      ? undefined
      : sequentialIds("session"),
    createId: input.productionIds ? undefined : sequentialIds("id"),
    createEvidenceId: input.productionIds
      ? undefined
      : sequentialIds("evidence"),
    now: () => "2026-09-24T02:00:00.000Z",
    generator: input.generator,
  });
  return {
    controller,
    sessions,
    tasks,
    vocabulary,
    read,
    learning,
    userId,
    env,
  };
}
