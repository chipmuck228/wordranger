import type { PromptMode } from "./evidence.types";
import type { VocabularySkill } from "./vocabulary-skill";

export type LearningNeedReason =
  | "NEW_WORD"
  | "WEAKNESS"
  | "REVIEW_DUE"
  | "STAGE_PROGRESS"
  | "FADING"
  | "USER_MARKED";

/**
 * Protocol for the future Scheduler. V1 only defines the shape.
 */
export interface LearningNeed {
  wordId: string;
  targetSkill: VocabularySkill;
  priority: number;
  reason: LearningNeedReason;
  preferredPromptModes: PromptMode[];
  avoidRecentTaskTypes: string[];
}
