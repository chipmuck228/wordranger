import type { GameCapability } from "@/domain/learning/game-capability";
import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import { MATCHING_GAME_DEFINITION } from "@/server/game-session/matching-capability";
import { RANGER_TRIAL_GAME_DEFINITION } from "@/server/game-session/ranger-trial-capability";
import { SNAKE_GAME_DEFINITION } from "@/server/game-session/snake-capability";
import { WORD_BUBBLE_GAME_DEFINITION } from "@/server/game-session/word-bubble-capability";
import type { LearningGameDefinition } from "@/server/game-session/game-definition";

export type TrainingPresentationKind =
  | "DIRECT"
  | "SPATIAL"
  | "COMPOSITE"
  | "REAL_TIME";

export interface TrainingRendererDefinition extends LearningGameDefinition {
  presentationKind: TrainingPresentationKind;
  label: string;
  instruction: string;
}

function withPresentation(
  definition: LearningGameDefinition,
  presentationKind: TrainingPresentationKind,
  label: string,
  instruction: string,
): TrainingRendererDefinition {
  return {
    ...definition,
    presentationKind,
    label,
    instruction,
  };
}

export const TRAINING_RENDERERS: TrainingRendererDefinition[] = [
  withPresentation(
    WORD_BUBBLE_GAME_DEFINITION,
    "SPATIAL",
    "单词泡泡",
    "点中正确的泡泡。",
  ),
  withPresentation(
    MATCHING_GAME_DEFINITION,
    "COMPOSITE",
    "连连看",
    "先点左边，再找到右边最合适的一项。",
  ),
  withPresentation(
    SNAKE_GAME_DEFINITION,
    "REAL_TIME",
    "贪食蛇",
    "控制小蛇，吃到正确答案。",
  ),
  withPresentation(
    RANGER_TRIAL_GAME_DEFINITION,
    "DIRECT",
    "单词闯关",
    "选出或输入答案。",
  ),
];

export function rendererByGameType(
  gameType: string,
): TrainingRendererDefinition | undefined {
  return TRAINING_RENDERERS.find((item) => item.gameType === gameType);
}

export function rendererLabel(gameType: string): string {
  return rendererByGameType(gameType)?.label ?? "";
}

export function rendererInstruction(gameType: string): string {
  return rendererByGameType(gameType)?.instruction ?? "";
}

export type { GameCapability, PublicLearningTask };
