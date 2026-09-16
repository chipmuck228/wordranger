import { AnswerMode, PromptMode } from "@/domain/learning/evidence.types";
import type { GameCapability } from "@/domain/learning/game-capability";
import { MasteryStage } from "@/domain/learning/mastery-stage";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { WeaknessType } from "@/domain/learning/weakness.types";

import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import { RANGER_TRIAL_GAME_ID, RANGER_TRIAL_GAME_TYPE } from "@/server/auth/v1-user";
import { canGameRenderTask } from "./can-game-render-task";
import type { LearningGameDefinition } from "./game-definition";

export const RANGER_TRIAL_CAPABILITY: GameCapability = {
  gameType: RANGER_TRIAL_GAME_TYPE,
  supportedSkills: [
    VocabularySkill.MEANING_RECOGNITION,
    VocabularySkill.SEMANTIC_CONNECTION,
    VocabularySkill.ACTIVE_RECALL,
    VocabularySkill.SPELLING_RECALL,
  ],
  supportedPromptModes: [
    PromptMode.WORD_TO_MEANING,
    PromptMode.MEANING_TO_WORD,
    PromptMode.WORD_TO_RELATION,
    PromptMode.MEANING_TO_SPELLING,
  ],
  supportedAnswerModes: [
    AnswerMode.MULTIPLE_CHOICE,
    AnswerMode.TYPING,
    AnswerMode.SPELLING,
  ],
  minMasteryStage: MasteryStage.UNSEEN,
  maxMasteryStage: MasteryStage.MASTERED,
  supportsWeaknessTypes: [
    WeaknessType.MEANING,
    WeaknessType.SPELLING,
    WeaknessType.ACTIVE_RECALL,
    WeaknessType.SEMANTIC_RELATION,
    WeaknessType.CONFUSION,
  ],
  difficultyRange: {
    min: 0,
    max: 1,
  },
};

export const RANGER_TRIAL_GAME_DEFINITION: LearningGameDefinition = {
  gameType: RANGER_TRIAL_GAME_TYPE,
  gameId: RANGER_TRIAL_GAME_ID,
  capability: RANGER_TRIAL_CAPABILITY,
  canRenderTask: (task: PublicLearningTask) =>
    canGameRenderTask(RANGER_TRIAL_CAPABILITY, task),
  requestedNeedCount: 8,
};
