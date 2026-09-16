import {
  AnswerMode,
  EvidenceErrorType,
  EvidenceOutcome,
  PromptMode,
  type LearningEvidence,
} from "@/domain/learning/evidence.types";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";

export const DEBUG_USER_ID = "00000000-0000-4000-8000-000000000001";

export type DebugPreset =
  | "reset"
  | "recognition"
  | "active-recall"
  | "spelling-failure"
  | "confusion"
  | "mastery-journey"
  | "simulate-fading"
  | "simulate-recovery";

const T0 = "2026-03-01T09:00:00.000Z";

function at(days: number): string {
  const date = new Date(T0);
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  return date.toISOString();
}

function evidence(
  lexemeId: string,
  sessionId: string,
  occurredAt: string,
  overrides: Partial<LearningEvidence>,
): LearningEvidence {
  return {
    id: crypto.randomUUID(),
    userId: DEBUG_USER_ID,
    lexemeId,
    taskId: null,
    sessionId,
    gameId: "debug-lab",
    taskType: "debug-task",
    skill: VocabularySkill.MEANING_RECOGNITION,
    promptMode: PromptMode.WORD_TO_MEANING,
    outcome: EvidenceOutcome.INDEPENDENT_CORRECT,
    responseTimeMs: 1100,
    hintCount: 0,
    difficulty: 0.5,
    answerMode: AnswerMode.MULTIPLE_CHOICE,
    distractorLexemeIds: [],
    selectedLexemeId: lexemeId,
    typedAnswer: null,
    expectedAnswer: null,
    errorType: null,
    occurredAt,
    ...overrides,
  };
}

function meaning(
  lexemeId: string,
  sessionId: string,
  occurredAt: string,
): LearningEvidence {
  return evidence(lexemeId, sessionId, occurredAt, {
    skill: VocabularySkill.MEANING_RECOGNITION,
    taskType: "meaning-choice",
  });
}

function semantic(
  lexemeId: string,
  sessionId: string,
  occurredAt: string,
): LearningEvidence {
  return evidence(lexemeId, sessionId, occurredAt, {
    skill: VocabularySkill.SEMANTIC_CONNECTION,
    promptMode: PromptMode.WORD_TO_RELATION,
    answerMode: AnswerMode.MATCHING,
    taskType: "relation-match",
  });
}

function recall(
  lexemeId: string,
  lemma: string,
  sessionId: string,
  occurredAt: string,
): LearningEvidence {
  return evidence(lexemeId, sessionId, occurredAt, {
    skill: VocabularySkill.ACTIVE_RECALL,
    promptMode: PromptMode.MEANING_TO_WORD,
    answerMode: AnswerMode.TYPING,
    taskType: "recall-typing",
    typedAnswer: lemma,
    expectedAnswer: lemma,
  });
}

function spellingOk(
  lexemeId: string,
  lemma: string,
  sessionId: string,
  occurredAt: string,
): LearningEvidence {
  return evidence(lexemeId, sessionId, occurredAt, {
    skill: VocabularySkill.SPELLING_RECALL,
    promptMode: PromptMode.AUDIO_TO_SPELLING,
    answerMode: AnswerMode.SPELLING,
    taskType: "spelling-dictation",
    typedAnswer: lemma,
    expectedAnswer: lemma,
  });
}

function context(
  lexemeId: string,
  lemma: string,
  sessionId: string,
  occurredAt: string,
  variant: string,
): LearningEvidence {
  return evidence(lexemeId, sessionId, occurredAt, {
    skill: VocabularySkill.CONTEXT_USE,
    promptMode: PromptMode.CONTEXT_TO_WORD,
    answerMode: AnswerMode.TYPING,
    taskType: "context-gap",
    typedAnswer: lemma,
    expectedAnswer: lemma,
    metadata: { contextId: variant },
  });
}

function recognitionPath(lexemeId: string): LearningEvidence[] {
  return [meaning(lexemeId, "session-a", at(0)), meaning(lexemeId, "session-b", at(1))];
}

function connectedPath(lexemeId: string): LearningEvidence[] {
  return [
    ...recognitionPath(lexemeId),
    meaning(lexemeId, "session-a", at(0.01)),
    meaning(lexemeId, "session-b", at(1.01)),
    meaning(lexemeId, "session-b", at(1.02)),
    meaning(lexemeId, "session-b", at(1.03)),
    meaning(lexemeId, "session-b", at(1.04)),
    semantic(lexemeId, "session-a", at(0.02)),
    semantic(lexemeId, "session-b", at(1.05)),
    semantic(lexemeId, "session-b", at(1.06)),
    semantic(lexemeId, "session-b", at(1.07)),
  ];
}

function recalledPath(lexemeId: string, lemma: string): LearningEvidence[] {
  return [
    ...connectedPath(lexemeId),
    recall(lexemeId, lemma, "session-c", at(2)),
    recall(lexemeId, lemma, "session-d", at(3)),
    recall(lexemeId, lemma, "session-d", at(3.01)),
    recall(lexemeId, lemma, "session-d", at(3.02)),
    recall(lexemeId, lemma, "session-d", at(3.03)),
  ];
}

function usablePath(lexemeId: string, lemma: string): LearningEvidence[] {
  return [
    ...recalledPath(lexemeId, lemma),
    context(lexemeId, lemma, "session-e", at(4), "school"),
    context(lexemeId, lemma, "session-e", at(4.01), "home"),
    context(lexemeId, lemma, "session-f", at(4.02), "school"),
    context(lexemeId, lemma, "session-f", at(4.03), "home"),
    context(lexemeId, lemma, "session-f", at(4.04), "park"),
  ];
}

function masteredPath(lexemeId: string, lemma: string): LearningEvidence[] {
  return [
    ...usablePath(lexemeId, lemma),
    meaning(lexemeId, "session-g", at(5)),
    meaning(lexemeId, "session-g", at(5.01)),
    spellingOk(lexemeId, lemma, "session-g", at(5.02)),
    recall(lexemeId, lemma, "session-h", at(7)),
    context(lexemeId, lemma, "session-h", at(7.01), "exam"),
  ];
}

function spellingFailure(
  lexemeId: string,
  lemma: string,
): LearningEvidence {
  return evidence(lexemeId, "session-fail", at(8), {
    skill: VocabularySkill.SPELLING_RECALL,
    outcome: EvidenceOutcome.INCORRECT,
    promptMode: PromptMode.AUDIO_TO_SPELLING,
    answerMode: AnswerMode.SPELLING,
    taskType: "spelling-dictation",
    errorType: EvidenceErrorType.SPELLING_MAJOR,
    typedAnswer: `${lemma}x`,
    expectedAnswer: lemma,
  });
}

export function buildPresetEvidence(
  preset: DebugPreset,
  lexemeId: string,
  lemma: string,
  confusedLexemeId: string,
): LearningEvidence[] {
  switch (preset) {
    case "reset":
      return [];
    case "recognition":
      return recognitionPath(lexemeId);
    case "active-recall":
      return recalledPath(lexemeId, lemma);
    case "spelling-failure":
      return [
        spellingOk(lexemeId, lemma, "session-spell-1", at(0)),
        evidence(lexemeId, "session-spell-1", at(0.01), {
          skill: VocabularySkill.SPELLING_RECALL,
          outcome: EvidenceOutcome.INCORRECT,
          answerMode: AnswerMode.SPELLING,
          promptMode: PromptMode.AUDIO_TO_SPELLING,
          taskType: "spelling-dictation",
          errorType: EvidenceErrorType.SPELLING_MAJOR,
        }),
        evidence(lexemeId, "session-spell-2", at(1), {
          skill: VocabularySkill.SPELLING_RECALL,
          outcome: EvidenceOutcome.INCORRECT,
          answerMode: AnswerMode.SPELLING,
          promptMode: PromptMode.AUDIO_TO_SPELLING,
          taskType: "spelling-dictation",
          errorType: EvidenceErrorType.SPELLING_MAJOR,
        }),
      ];
    case "confusion":
      return [
        evidence(lexemeId, "session-a", at(0), {
          outcome: EvidenceOutcome.INCORRECT,
          selectedLexemeId: confusedLexemeId,
          errorType: EvidenceErrorType.CONFUSED_WITH_WORD,
          distractorLexemeIds: [confusedLexemeId],
          taskType: "meaning-choice",
        }),
        evidence(lexemeId, "session-b", at(1), {
          outcome: EvidenceOutcome.INCORRECT,
          selectedLexemeId: confusedLexemeId,
          errorType: EvidenceErrorType.CONFUSED_WITH_WORD,
          distractorLexemeIds: [confusedLexemeId],
          taskType: "meaning-choice",
        }),
      ];
    case "mastery-journey":
      return masteredPath(lexemeId, lemma);
    case "simulate-fading":
      return [...masteredPath(lexemeId, lemma), spellingFailure(lexemeId, lemma)];
    case "simulate-recovery":
      return [
        ...masteredPath(lexemeId, lemma),
        spellingFailure(lexemeId, lemma),
        spellingOk(lexemeId, lemma, "session-fail", at(8.01)),
        spellingOk(lexemeId, lemma, "session-recover", at(9)),
      ];
  }
}
