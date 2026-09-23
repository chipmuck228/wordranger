import { expect } from "vitest";
import { EvidenceOutcome } from "@/domain/learning/evidence.types";
import { MasteryStage } from "@/domain/learning/mastery-stage";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { InMemoryVocabularyRepository } from "@/server/vocabulary/in-memory-vocabulary-repository";
import { InMemoryFreePracticePlanReadAdapter } from "@/server/free-practice/planning/in-memory-plan-read-adapter";
import { planFreePractice } from "@/server/free-practice/planning/plan-free-practice";
import type {
  FreePracticeLearnerSnapshot,
  FreePracticePlanResult,
  FreePracticeRequest,
  FreePracticeTerminalEvidence,
} from "@/server/free-practice/planning/types";
import { tinyDataset } from "../../tasks/helpers";
import type { Lexeme } from "@/domain/vocabulary/lexeme";
import type { LexemeRelation } from "@/domain/vocabulary/lexeme-relation";

export const USER_A = "user-a";
export const USER_B = "user-b";

export function sequentialIds(prefix = "item"): () => string {
  let n = 0;
  return () => `${prefix}-${++n}`;
}

export function makeTestLexeme(
  overrides: Partial<Lexeme> & Pick<Lexeme, "id">,
): Partial<Lexeme> & Pick<Lexeme, "id" | "lemma" | "meaningsZh"> {
  return {
    lemma: overrides.lemma ?? overrides.id,
    meaningsZh: overrides.meaningsZh ?? ["意思"],
    ...overrides,
  };
}

export function snapshot(
  lexemeId: string,
  masteryStage: MasteryStage,
): FreePracticeLearnerSnapshot {
  return { lexemeId, masteryStage };
}

export function evidence(
  overrides: Partial<FreePracticeTerminalEvidence> &
    Pick<FreePracticeTerminalEvidence, "id" | "lexemeId">,
): FreePracticeTerminalEvidence {
  return {
    skill: VocabularySkill.MEANING_RECOGNITION,
    outcome: EvidenceOutcome.INCORRECT,
    occurredAt: "2026-09-20T12:00:00.000Z",
    ...overrides,
  };
}

export async function planWith(input: {
  userId?: string;
  request: FreePracticeRequest;
  lexemes: Array<Partial<Lexeme> & Pick<Lexeme, "id" | "lemma" | "meaningsZh">>;
  relations?: LexemeRelation[];
  snapshots?: FreePracticeLearnerSnapshot[];
  evidence?: FreePracticeTerminalEvidence[];
  read?: InMemoryFreePracticePlanReadAdapter;
  createId?: () => string;
}): Promise<{
  result: FreePracticePlanResult;
  read: InMemoryFreePracticePlanReadAdapter;
}> {
  const read = input.read ?? new InMemoryFreePracticePlanReadAdapter();
  const userId = input.userId ?? USER_A;
  if (input.snapshots) {
    read.seedSnapshots(userId, input.snapshots);
  }
  if (input.evidence) {
    read.seedEvidence(userId, input.evidence);
  }
  const result = await planFreePractice({
    userId,
    request: input.request,
    vocabulary: new InMemoryVocabularyRepository(
      tinyDataset({
        lexemes: input.lexemes,
        relations: input.relations,
      }),
    ),
    read,
    createId: input.createId ?? sequentialIds(),
  });
  return { result, read };
}

export function assertPlanPayload(result: FreePracticePlanResult): void {
  const json = JSON.stringify(result);
  expect(json).not.toMatch(/answerKey|AnswerKey/);
  expect(json).not.toMatch(/LearningNeed|weaknessFocus|scheduler|traceId/);
  expect(json).not.toMatch(/masteryScore|weaknesses|policyVersion/);
  if (result.status === "REJECTED") {
    return;
  }
  expect(result.plannedCount).toBe(result.items.length);
  for (const item of result.items) {
    expect(Object.keys(item).sort()).toEqual([
      "id",
      "lexemeId",
      "source",
      "targetSkill",
    ]);
    expect(item.source).toBe(result.source);
  }
}
