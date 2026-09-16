import type { VocabularySkill } from "./vocabulary-skill";

export enum EvidenceOutcome {
  INDEPENDENT_CORRECT = "INDEPENDENT_CORRECT",
  ASSISTED_CORRECT = "ASSISTED_CORRECT",
  INCORRECT = "INCORRECT",
  SKIPPED = "SKIPPED",
  TIMEOUT = "TIMEOUT",
}

export enum PromptMode {
  WORD_TO_MEANING = "WORD_TO_MEANING",
  MEANING_TO_WORD = "MEANING_TO_WORD",
  AUDIO_TO_WORD = "AUDIO_TO_WORD",
  WORD_TO_AUDIO = "WORD_TO_AUDIO",
  WORD_TO_RELATION = "WORD_TO_RELATION",
  WORD_TO_CATEGORY = "WORD_TO_CATEGORY",
  CONTEXT_TO_WORD = "CONTEXT_TO_WORD",
  AUDIO_TO_SPELLING = "AUDIO_TO_SPELLING",
  MEANING_TO_SPELLING = "MEANING_TO_SPELLING",
}

export enum AnswerMode {
  MULTIPLE_CHOICE = "MULTIPLE_CHOICE",
  MATCHING = "MATCHING",
  DRAG_DROP = "DRAG_DROP",
  TYPING = "TYPING",
  SPELLING = "SPELLING",
  TAP_TARGET = "TAP_TARGET",
}

export enum EvidenceErrorType {
  WRONG_MEANING = "WRONG_MEANING",
  SPELLING_MINOR = "SPELLING_MINOR",
  SPELLING_MAJOR = "SPELLING_MAJOR",
  CONFUSED_WITH_WORD = "CONFUSED_WITH_WORD",
  LISTENING_MISIDENTIFICATION = "LISTENING_MISIDENTIFICATION",
  WRONG_SEMANTIC_RELATION = "WRONG_SEMANTIC_RELATION",
  CONTEXT_MISUNDERSTANDING = "CONTEXT_MISUNDERSTANDING",
  TIMEOUT = "TIMEOUT",
  UNKNOWN = "UNKNOWN",
}

/**
 * Immutable learning fact. Domain code must not expose APIs that mutate an
 * existing evidence result into a different outcome.
 *
 * INDEPENDENT_CORRECT = correct with no hint/scaffold.
 * ASSISTED_CORRECT = correct only after hint/scaffold.
 */
export interface LearningEvidence {
  id: string;
  userId: string;
  lexemeId: string;
  sessionId: string;
  gameId: string;
  taskType: string;
  skill: VocabularySkill;
  promptMode: PromptMode;
  outcome: EvidenceOutcome;
  responseTimeMs: number | null;
  hintCount: number;
  /**
   * 0 ~ 1
   */
  difficulty: number;
  answerMode: AnswerMode;
  distractorLexemeIds: string[];
  selectedLexemeId: string | null;
  typedAnswer: string | null;
  expectedAnswer: string | null;
  errorType: EvidenceErrorType | null;
  /**
   * ISO datetime
   */
  occurredAt: string;
  metadata?: Record<string, unknown>;
}

export interface RecentPerformanceItem {
  evidenceId: string;
  occurredAt: string;
  outcome: EvidenceOutcome;
  responseTimeMs: number | null;
  hintCount: number;
  difficulty: number;
}
