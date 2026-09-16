import type { PromptMode } from "./evidence.types";
import type { VocabularySkill } from "./vocabulary-skill";
import type { WeaknessType } from "./weakness.types";

export type LearningNeedReason =
  | "NEW_WORD"
  | "WEAKNESS"
  | "REVIEW_DUE"
  | "STAGE_PROGRESS"
  | "FADING"
  | "USER_MARKED";

export interface LearningNeedWeaknessFocus {
  weaknessId: string;
  type: WeaknessType;
  relatedLexemeId?: string;
}

/**
 * Why this lexeme/skill should be practiced now. Does not contain a task.
 */
export interface LearningNeed {
  id: string;
  lexemeId: string;
  targetSkill: VocabularySkill;
  priority: number;
  reason: LearningNeedReason;
  weaknessFocus?: LearningNeedWeaknessFocus;
  preferredPromptModes: PromptMode[];
  avoidRecentTaskTypes: string[];
}
