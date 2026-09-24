import { EvidenceOutcome } from "@/domain/learning/evidence.types";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { V1_PLACEHOLDER_USER_ID } from "@/server/auth/v1-user";
import { createTestFreePracticeSessionReader } from "@/server/free-practice/identity/test-session-reader";
import { InMemoryFreePracticePlanReadAdapter } from "@/server/free-practice/planning/in-memory-plan-read-adapter";
import { FreePracticeSessionController } from "@/server/free-practice/session/controller";
import { InMemoryFreePracticeSessionStore } from "@/server/free-practice/session/in-memory-store";
import { InMemoryLearningTaskRepository } from "@/server/tasks/in-memory-learning-task-repository";
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

export function createSessionHarness(input: {
  userId?: string;
  lexemes?: Array<Partial<Lexeme> & Pick<Lexeme, "id" | "lemma" | "meaningsZh">>;
  incorrectLexemeIds?: string[];
  tasks?: InMemoryLearningTaskRepository;
  sessions?: InMemoryFreePracticeSessionStore;
}) {
  const env = { ...TEST_IDENTITY_ENV };
  const userId = input.userId ?? USER_A;
  const lexemes = input.lexemes ?? unseenLexemes(20);
  const read = new InMemoryFreePracticePlanReadAdapter();
  if (input.incorrectLexemeIds) {
    read.seedEvidence(
      userId,
      input.incorrectLexemeIds.map((lexemeId, index) =>
        evidence({
          id: `ev-${index + 1}`,
          lexemeId,
          skill: VocabularySkill.MEANING_RECOGNITION,
          outcome: EvidenceOutcome.INCORRECT,
          occurredAt: new Date(
            Date.UTC(2026, 8, 20, 12, index, 0),
          ).toISOString(),
        }),
      ),
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
    readSession: createTestFreePracticeSessionReader({
      env,
      userId,
      isAnonymous: true,
    }),
    env,
    createSessionId: sequentialIds("session"),
    createId: sequentialIds("id"),
    now: () => "2026-09-24T02:00:00.000Z",
  });
  return { controller, sessions, tasks, vocabulary, read, userId, env };
}
