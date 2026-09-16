import type { MasteryStage } from "./mastery-stage";
import type { RetentionState } from "./retention-state";
import type { SkillState } from "./student-lexeme-model";
import type { VocabularySkill } from "./vocabulary-skill";
import type { Weakness } from "./weakness.types";

export interface TransitionReason {
  code: string;
  message: string;
  evidenceIds?: string[];
  metadata?: Record<string, unknown>;
}

export interface TransitionResult {
  previousStage: MasteryStage;
  nextStage: MasteryStage;
  previousRetentionState: RetentionState;
  nextRetentionState: RetentionState;
  updatedSkills: Partial<Record<VocabularySkill, SkillState>>;
  addedWeaknesses: Weakness[];
  resolvedWeaknessIds: string[];
  nextReviewAt: string | null;
  reasons: TransitionReason[];
}
