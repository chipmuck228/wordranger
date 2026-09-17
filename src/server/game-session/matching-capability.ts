import { AnswerMode, PromptMode } from "@/domain/learning/evidence.types";
import type { GameCapability } from "@/domain/learning/game-capability";
import { MasteryStage } from "@/domain/learning/mastery-stage";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { WeaknessType } from "@/domain/learning/weakness.types";
import { canCapabilityRenderTask } from "@/domain/tasks/can-capability-render-task";
import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import { MATCHING_GAME_ID, MATCHING_GAME_TYPE } from "@/server/auth/v1-user";
import type { LearningGameDefinition } from "./game-definition";

/**
 * What Matching can display. CHOICE only: one target + candidates.
 * Not Scheduler policy.
 */
export const MATCHING_CAPABILITY: GameCapability = {
  gameType: MATCHING_GAME_TYPE,
  supportedSkills: [
    VocabularySkill.MEANING_RECOGNITION,
    VocabularySkill.SEMANTIC_CONNECTION,
  ],
  supportedPromptModes: [
    PromptMode.WORD_TO_MEANING,
    PromptMode.WORD_TO_RELATION,
  ],
  supportedAnswerModes: [AnswerMode.MULTIPLE_CHOICE],
  minMasteryStage: MasteryStage.UNSEEN,
  maxMasteryStage: MasteryStage.MASTERED,
  supportsWeaknessTypes: [
    WeaknessType.MEANING,
    WeaknessType.SEMANTIC_RELATION,
    WeaknessType.CONFUSION,
  ],
  difficultyRange: {
    min: 0,
    max: 1,
  },
};

export function canMatchingRenderTask(task: PublicLearningTask): boolean {
  return (
    canCapabilityRenderTask(MATCHING_CAPABILITY, task) &&
    task.responseContract.kind === "CHOICE"
  );
}

export const MATCHING_GAME_DEFINITION: LearningGameDefinition = {
  gameType: MATCHING_GAME_TYPE,
  gameId: MATCHING_GAME_ID,
  capability: MATCHING_CAPABILITY,
  canRenderTask: canMatchingRenderTask,
  requestedNeedCount: 8,
};
