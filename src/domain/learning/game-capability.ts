import type { AnswerMode, PromptMode } from "./evidence.types";
import type { MasteryStage } from "./mastery-stage";
import type { VocabularySkill } from "./vocabulary-skill";
import type { WeaknessType } from "./weakness.types";

/**
 * Games declare what they can train. The Learning Engine never hard-codes a
 * concrete game. Scheduler (future) matches LearningNeed against this protocol.
 */
export interface GameCapability {
  gameType: string;
  supportedSkills: VocabularySkill[];
  supportedPromptModes: PromptMode[];
  supportedAnswerModes: AnswerMode[];
  minMasteryStage: MasteryStage;
  maxMasteryStage?: MasteryStage;
  supportsWeaknessTypes: WeaknessType[];
  difficultyRange: {
    min: number;
    max: number;
  };
}
