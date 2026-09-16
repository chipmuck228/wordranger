import type { EvidenceErrorType, EvidenceOutcome } from "@/domain/learning/evidence.types";
import type { VocabularySkill } from "@/domain/learning/vocabulary-skill";

export interface TaskEvaluation {
  taskId: string;
  lexemeId: string;
  skill: VocabularySkill;
  outcome: EvidenceOutcome;
  errorType: EvidenceErrorType | null;
  selectedLexemeId: string | null;
  typedAnswer: string | null;
  expectedAnswer: string | null;
  responseTimeMs: number | null;
  hintCount: number;
  occurredAt: string;
  normalizedTypedAnswer: string | null;
  isCorrect: boolean;
}
