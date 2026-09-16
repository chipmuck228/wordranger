import { AnswerMode, PromptMode } from "../evidence.types";
import type { GameCapability } from "../game-capability";
import { MasteryStage } from "../mastery-stage";
import { VocabularySkill } from "../vocabulary-skill";
import { WeaknessType } from "../weakness.types";

/**
 * Demo fixture only. Not a real game implementation.
 */
export const DEMO_RECOGNITION_CAPABILITY: GameCapability = {
  gameType: "demo-recognition",
  supportedSkills: [
    VocabularySkill.MEANING_RECOGNITION,
    VocabularySkill.LISTENING_RECOGNITION,
  ],
  supportedPromptModes: [
    PromptMode.WORD_TO_MEANING,
    PromptMode.MEANING_TO_WORD,
    PromptMode.AUDIO_TO_WORD,
  ],
  supportedAnswerModes: [AnswerMode.MULTIPLE_CHOICE, AnswerMode.MATCHING],
  minMasteryStage: MasteryStage.UNSEEN,
  maxMasteryStage: MasteryStage.CONNECTED,
  supportsWeaknessTypes: [
    WeaknessType.MEANING,
    WeaknessType.LISTENING,
    WeaknessType.CONFUSION,
    WeaknessType.SLOW_RESPONSE,
  ],
  difficultyRange: { min: 0.1, max: 0.6 },
};

export const DEMO_PRODUCTION_CAPABILITY: GameCapability = {
  gameType: "demo-production",
  supportedSkills: [
    VocabularySkill.ACTIVE_RECALL,
    VocabularySkill.SPELLING_RECALL,
    VocabularySkill.CONTEXT_USE,
  ],
  supportedPromptModes: [
    PromptMode.MEANING_TO_WORD,
    PromptMode.AUDIO_TO_SPELLING,
    PromptMode.MEANING_TO_SPELLING,
    PromptMode.CONTEXT_TO_WORD,
  ],
  supportedAnswerModes: [AnswerMode.TYPING, AnswerMode.SPELLING],
  minMasteryStage: MasteryStage.CONNECTED,
  maxMasteryStage: MasteryStage.MASTERED,
  supportsWeaknessTypes: [
    WeaknessType.SPELLING,
    WeaknessType.ACTIVE_RECALL,
    WeaknessType.HINT_DEPENDENCY,
    WeaknessType.CONTEXT,
  ],
  difficultyRange: { min: 0.3, max: 0.9 },
};
