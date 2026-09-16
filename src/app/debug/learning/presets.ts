import {
  AnswerMode,
  EvidenceErrorType,
  EvidenceOutcome,
  PromptMode,
  type LearningEvidence,
} from "@/domain/learning/evidence.types";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";

export const DEBUG_USER_ID = "00000000-0000-4000-8000-000000000001";
export const DEBUG_WORD_ID = "00000000-0000-4000-8000-000000000010";
export const DEBUG_CONFUSED_WORD_ID = "00000000-0000-4000-8000-000000000011";

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
  sessionId: string,
  occurredAt: string,
  overrides: Partial<LearningEvidence>,
): LearningEvidence {
  return {
    id: crypto.randomUUID(),
    userId: DEBUG_USER_ID,
    wordId: DEBUG_WORD_ID,
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
    distractorWordIds: [],
    selectedWordId: DEBUG_WORD_ID,
    typedAnswer: null,
    expectedAnswer: null,
    errorType: null,
    occurredAt,
    ...overrides,
  };
}

function meaning(sessionId: string, occurredAt: string): LearningEvidence {
  return evidence(sessionId, occurredAt, {
    skill: VocabularySkill.MEANING_RECOGNITION,
    taskType: "meaning-choice",
  });
}

function semantic(sessionId: string, occurredAt: string): LearningEvidence {
  return evidence(sessionId, occurredAt, {
    skill: VocabularySkill.SEMANTIC_CONNECTION,
    promptMode: PromptMode.WORD_TO_RELATION,
    answerMode: AnswerMode.MATCHING,
    taskType: "relation-match",
  });
}

function recall(sessionId: string, occurredAt: string): LearningEvidence {
  return evidence(sessionId, occurredAt, {
    skill: VocabularySkill.ACTIVE_RECALL,
    promptMode: PromptMode.MEANING_TO_WORD,
    answerMode: AnswerMode.TYPING,
    taskType: "recall-typing",
    typedAnswer: "quiet",
    expectedAnswer: "quiet",
  });
}

function spellingOk(sessionId: string, occurredAt: string): LearningEvidence {
  return evidence(sessionId, occurredAt, {
    skill: VocabularySkill.SPELLING_RECALL,
    promptMode: PromptMode.AUDIO_TO_SPELLING,
    answerMode: AnswerMode.SPELLING,
    taskType: "spelling-dictation",
    typedAnswer: "quiet",
    expectedAnswer: "quiet",
  });
}

function context(
  sessionId: string,
  occurredAt: string,
  variant: string,
): LearningEvidence {
  return evidence(sessionId, occurredAt, {
    skill: VocabularySkill.CONTEXT_USE,
    promptMode: PromptMode.CONTEXT_TO_WORD,
    answerMode: AnswerMode.TYPING,
    taskType: "context-gap",
    typedAnswer: "quiet",
    expectedAnswer: "quiet",
    metadata: { contextId: variant },
  });
}

function recognitionPath(): LearningEvidence[] {
  return [meaning("session-a", at(0)), meaning("session-b", at(1))];
}

function connectedPath(): LearningEvidence[] {
  return [
    ...recognitionPath(),
    meaning("session-a", at(0.01)),
    meaning("session-b", at(1.01)),
    meaning("session-b", at(1.02)),
    meaning("session-b", at(1.03)),
    meaning("session-b", at(1.04)),
    semantic("session-a", at(0.02)),
    semantic("session-b", at(1.05)),
    semantic("session-b", at(1.06)),
    semantic("session-b", at(1.07)),
  ];
}

function recalledPath(): LearningEvidence[] {
  return [
    ...connectedPath(),
    recall("session-c", at(2)),
    recall("session-d", at(3)),
    recall("session-d", at(3.01)),
    recall("session-d", at(3.02)),
    recall("session-d", at(3.03)),
  ];
}

function usablePath(): LearningEvidence[] {
  return [
    ...recalledPath(),
    context("session-e", at(4), "school"),
    context("session-e", at(4.01), "home"),
    context("session-f", at(4.02), "school"),
    context("session-f", at(4.03), "home"),
    context("session-f", at(4.04), "park"),
  ];
}

function masteredPath(): LearningEvidence[] {
  return [
    ...usablePath(),
    meaning("session-g", at(5)),
    meaning("session-g", at(5.01)),
    spellingOk("session-g", at(5.02)),
    recall("session-h", at(7)),
    context("session-h", at(7.01), "exam"),
  ];
}

function spellingFailure(): LearningEvidence {
  return evidence("session-fail", at(8), {
    skill: VocabularySkill.SPELLING_RECALL,
    outcome: EvidenceOutcome.INCORRECT,
    promptMode: PromptMode.AUDIO_TO_SPELLING,
    answerMode: AnswerMode.SPELLING,
    taskType: "spelling-dictation",
    errorType: EvidenceErrorType.SPELLING_MAJOR,
    typedAnswer: "quete",
    expectedAnswer: "quiet",
  });
}

export function buildPresetEvidence(preset: DebugPreset): LearningEvidence[] {
  switch (preset) {
    case "reset":
      return [];
    case "recognition":
      return recognitionPath();
    case "active-recall":
      return recalledPath();
    case "spelling-failure":
      return [
        spellingOk("session-spell-1", at(0)),
        evidence("session-spell-1", at(0.01), {
          skill: VocabularySkill.SPELLING_RECALL,
          outcome: EvidenceOutcome.INCORRECT,
          answerMode: AnswerMode.SPELLING,
          promptMode: PromptMode.AUDIO_TO_SPELLING,
          taskType: "spelling-dictation",
          errorType: EvidenceErrorType.SPELLING_MAJOR,
        }),
        evidence("session-spell-2", at(1), {
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
        evidence("session-a", at(0), {
          outcome: EvidenceOutcome.INCORRECT,
          selectedWordId: DEBUG_CONFUSED_WORD_ID,
          errorType: EvidenceErrorType.CONFUSED_WITH_WORD,
          distractorWordIds: [DEBUG_CONFUSED_WORD_ID],
          taskType: "meaning-choice",
        }),
        evidence("session-b", at(1), {
          outcome: EvidenceOutcome.INCORRECT,
          selectedWordId: DEBUG_CONFUSED_WORD_ID,
          errorType: EvidenceErrorType.CONFUSED_WITH_WORD,
          distractorWordIds: [DEBUG_CONFUSED_WORD_ID],
          taskType: "meaning-choice",
        }),
      ];
    case "mastery-journey":
      return masteredPath();
    case "simulate-fading":
      return [...masteredPath(), spellingFailure()];
    case "simulate-recovery":
      return [
        ...masteredPath(),
        spellingFailure(),
        spellingOk("session-fail", at(8.01)),
        spellingOk("session-recover", at(9)),
      ];
  }
}
