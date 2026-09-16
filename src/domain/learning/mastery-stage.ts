export enum MasteryStage {
  UNSEEN = "UNSEEN",
  EXPOSED = "EXPOSED",
  RECOGNIZED = "RECOGNIZED",
  CONNECTED = "CONNECTED",
  RECALLED = "RECALLED",
  USABLE = "USABLE",
  MASTERED = "MASTERED",
}

export const MASTERY_STAGE_ORDER: readonly MasteryStage[] = [
  MasteryStage.UNSEEN,
  MasteryStage.EXPOSED,
  MasteryStage.RECOGNIZED,
  MasteryStage.CONNECTED,
  MasteryStage.RECALLED,
  MasteryStage.USABLE,
  MasteryStage.MASTERED,
] as const;

export function masteryStageIndex(stage: MasteryStage): number {
  return MASTERY_STAGE_ORDER.indexOf(stage);
}

export function isAtLeastStage(
  stage: MasteryStage,
  minimum: MasteryStage,
): boolean {
  return masteryStageIndex(stage) >= masteryStageIndex(minimum);
}
