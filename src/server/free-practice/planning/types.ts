import "server-only";

import type { MasteryStage } from "@/domain/learning/mastery-stage";
import type { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import type { EvidenceOutcome } from "@/domain/learning/evidence.types";
import type { Lexeme } from "@/domain/vocabulary/lexeme";
import type { LexemeRelation } from "@/domain/vocabulary/lexeme-relation";

export type FreePracticeSource = "UNSEEN" | "RECENTLY_INCORRECT";

export type FreePracticeRequestedCount = 5 | 10;

export interface FreePracticeRequest {
  source: FreePracticeSource;
  requestedCount: FreePracticeRequestedCount;
}

export interface FreePracticeItem {
  id: string;
  lexemeId: string;
  targetSkill: VocabularySkill;
  source: FreePracticeSource;
}

export type FreePracticePlanResult =
  | {
      status: "READY";
      source: FreePracticeSource;
      requestedCount: number;
      plannedCount: number;
      items: FreePracticeItem[];
    }
  | {
      status: "PARTIAL";
      source: FreePracticeSource;
      requestedCount: number;
      plannedCount: number;
      items: FreePracticeItem[];
      reason: "INSUFFICIENT_ELIGIBLE_WORDS";
    }
  | {
      status: "EMPTY";
      source: FreePracticeSource;
      requestedCount: number;
      plannedCount: 0;
      items: [];
      reason: "NO_ELIGIBLE_WORDS";
    }
  | {
      status: "REJECTED";
      reason: "INVALID_REQUESTED_COUNT" | "INVALID_SOURCE" | "INVALID_USER";
    };

export interface FreePracticeLearnerSnapshot {
  lexemeId: string;
  masteryStage: MasteryStage;
}

export interface FreePracticeTerminalEvidence {
  id: string;
  lexemeId: string;
  skill: VocabularySkill;
  outcome: EvidenceOutcome;
  occurredAt: string;
}

export interface FreePracticeVocabularyRead {
  listLexemes(): Promise<Lexeme[]>;
  listRelations(): Promise<LexemeRelation[]>;
}

export interface FreePracticePlanReadPort {
  listStudentLexemeSnapshots(
    userId: string,
  ): Promise<FreePracticeLearnerSnapshot[]>;
  listRecentTerminalEvidence(
    userId: string,
    limit: number,
  ): Promise<FreePracticeTerminalEvidence[]>;
}
