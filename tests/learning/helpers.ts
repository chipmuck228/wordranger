import {
  AnswerMode,
  EvidenceErrorType,
  EvidenceOutcome,
  PromptMode,
  type LearningEvidence,
} from "@/domain/learning/evidence.types";
import { processEvidence } from "@/domain/learning/engine/process-evidence";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { InMemoryLearningRepository } from "@/server/learning/in-memory-learning-repository";
import type { StudentLexemeModel } from "@/domain/learning/student-lexeme-model";
import type { TransitionResult } from "@/domain/learning/transition.types";

export const TEST_USER_ID = "11111111-1111-1111-1111-111111111111";
export const TEST_LEXEME_ID = "22222222-2222-2222-2222-222222222222";
export const CONFUSED_LEXEME_ID = "33333333-3333-3333-3333-333333333333";

export function sequentialIdFactory(prefix = "id"): () => string {
  let count = 0;
  return () => `${prefix}-${++count}`;
}

export interface EvidenceOverrides {
  id?: string;
  sessionId?: string;
  occurredAt?: string;
  skill?: VocabularySkill;
  outcome?: EvidenceOutcome;
  promptMode?: PromptMode;
  answerMode?: AnswerMode;
  difficulty?: number;
  hintCount?: number;
  responseTimeMs?: number | null;
  taskType?: string;
  gameId?: string;
  selectedLexemeId?: string | null;
  typedAnswer?: string | null;
  expectedAnswer?: string | null;
  errorType?: EvidenceErrorType | null;
  distractorLexemeIds?: string[];
  metadata?: Record<string, unknown>;
  lexemeId?: string;
  taskId?: string | null;
}

export function makeEvidence(
  id: string,
  sessionId: string,
  occurredAt: string,
  overrides: EvidenceOverrides = {},
): LearningEvidence {
  const skill = overrides.skill ?? VocabularySkill.MEANING_RECOGNITION;
  return {
    id,
    userId: TEST_USER_ID,
    lexemeId: overrides.lexemeId ?? TEST_LEXEME_ID,
    taskId: overrides.taskId === undefined ? null : overrides.taskId,
    sessionId,
    gameId: overrides.gameId ?? "demo-lab",
    taskType: overrides.taskType ?? `task-${skill.toLowerCase()}`,
    skill,
    promptMode: overrides.promptMode ?? PromptMode.WORD_TO_MEANING,
    outcome: overrides.outcome ?? EvidenceOutcome.INDEPENDENT_CORRECT,
    responseTimeMs: overrides.responseTimeMs ?? 1200,
    hintCount: overrides.hintCount ?? 0,
    difficulty: overrides.difficulty ?? 0.5,
    answerMode: overrides.answerMode ?? AnswerMode.MULTIPLE_CHOICE,
    distractorLexemeIds: overrides.distractorLexemeIds ?? [],
    selectedLexemeId:
      overrides.selectedLexemeId === undefined
        ? TEST_LEXEME_ID
        : overrides.selectedLexemeId,
    typedAnswer: overrides.typedAnswer ?? null,
    expectedAnswer: overrides.expectedAnswer ?? null,
    errorType: overrides.errorType ?? null,
    occurredAt,
    metadata: overrides.metadata,
  };
}

export async function feed(
  repository: InMemoryLearningRepository,
  evidence: LearningEvidence,
  createId = sequentialIdFactory("model"),
): Promise<{ model: StudentLexemeModel; transition: TransitionResult }> {
  const result = await processEvidence({
    evidence,
    repository,
    now: evidence.occurredAt,
    createId,
  });
  return { model: result.model, transition: result.transition };
}

export async function feedAll(
  repository: InMemoryLearningRepository,
  items: LearningEvidence[],
  createId = sequentialIdFactory("model"),
): Promise<{ model: StudentLexemeModel; transition: TransitionResult }> {
  let last: { model: StudentLexemeModel; transition: TransitionResult } | null =
    null;
  for (const evidence of items) {
    last = await feed(repository, evidence, createId);
  }
  if (!last) {
    throw new Error("feedAll requires at least one evidence item");
  }
  return last;
}

export function daysAfter(baseIso: string, days: number): string {
  const date = new Date(baseIso);
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  return date.toISOString();
}

export function times(
  count: number,
  build: (index: number) => LearningEvidence,
): LearningEvidence[] {
  return Array.from({ length: count }, (_, index) => build(index));
}
