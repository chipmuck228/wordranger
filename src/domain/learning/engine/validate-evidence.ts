import { z } from "zod";
import {
  AnswerMode,
  EvidenceErrorType,
  EvidenceOutcome,
  PromptMode,
  type LearningEvidence,
} from "../evidence.types";
import { LearningDomainError } from "./math";
import { VocabularySkill } from "../vocabulary-skill";

const evidenceSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  lexemeId: z.string().min(1),
  sessionId: z.string().min(1),
  gameId: z.string().min(1),
  taskType: z.string().min(1),
  skill: z.enum(VocabularySkill),
  promptMode: z.enum(PromptMode),
  outcome: z.enum(EvidenceOutcome),
  responseTimeMs: z.number().nonnegative().nullable(),
  hintCount: z.number().int().nonnegative(),
  difficulty: z.number().min(0).max(1),
  answerMode: z.enum(AnswerMode),
  distractorLexemeIds: z.array(z.string()),
  selectedLexemeId: z.string().min(1).nullable(),
  typedAnswer: z.string().nullable(),
  expectedAnswer: z.string().nullable(),
  errorType: z.enum(EvidenceErrorType).nullable(),
  occurredAt: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export function validateLearningEvidence(
  evidence: LearningEvidence,
): LearningEvidence {
  const parsed = evidenceSchema.safeParse(evidence);
  if (!parsed.success) {
    throw new LearningDomainError(
      "INVALID_EVIDENCE",
      parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "evidence"}: ${issue.message}`)
        .join("; "),
    );
  }

  const occurredAtMs = Date.parse(parsed.data.occurredAt);
  if (Number.isNaN(occurredAtMs)) {
    throw new LearningDomainError(
      "INVALID_EVIDENCE",
      "occurredAt must be a valid ISO datetime",
    );
  }

  if (
    parsed.data.outcome === EvidenceOutcome.INDEPENDENT_CORRECT &&
    parsed.data.hintCount > 0
  ) {
    throw new LearningDomainError(
      "INVALID_EVIDENCE",
      "INDEPENDENT_CORRECT cannot be recorded with hintCount > 0",
    );
  }

  if (
    parsed.data.outcome === EvidenceOutcome.ASSISTED_CORRECT &&
    parsed.data.hintCount === 0
  ) {
    throw new LearningDomainError(
      "INVALID_EVIDENCE",
      "ASSISTED_CORRECT requires hintCount > 0",
    );
  }

  return parsed.data;
}
