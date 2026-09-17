import { AnswerMode, PromptMode } from "@/domain/learning/evidence.types";
import type { GameCapability } from "@/domain/learning/game-capability";
import { MasteryStage } from "@/domain/learning/mastery-stage";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { WeaknessType } from "@/domain/learning/weakness.types";
import { canCapabilityRenderTask } from "@/domain/tasks/can-capability-render-task";
import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import { SNAKE_GAME_ID, SNAKE_GAME_TYPE } from "@/server/auth/v1-user";
import type { LearningGameDefinition } from "./game-definition";

/**
 * What Snake can display. CHOICE only: prompt + option objects.
 * Not Scheduler policy.
 */
export const SNAKE_CAPABILITY: GameCapability = {
  gameType: SNAKE_GAME_TYPE,
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

export function canSnakeRenderTask(task: PublicLearningTask): boolean {
  return (
    canCapabilityRenderTask(SNAKE_CAPABILITY, task) &&
    task.responseContract.kind === "CHOICE"
  );
}

export const SNAKE_GAME_DEFINITION: LearningGameDefinition = {
  gameType: SNAKE_GAME_TYPE,
  gameId: SNAKE_GAME_ID,
  capability: SNAKE_CAPABILITY,
  canRenderTask: canSnakeRenderTask,
  requestedNeedCount: 8,
};
