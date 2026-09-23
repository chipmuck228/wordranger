/**
 * Contextual BUILD Candidate V0.
 * Status: Candidate / Experimental / Not a Standard.
 */

import type { MealLexicalStrengthenProfile } from "../strengthen/types";
import type { MealStrengthenStepToken } from "../strengthen/meal-lexical-profiles";

export const MEAL_BUILD_ORCHESTRATION_VERSION = "build-queue-v1" as const;

export interface MealBuildSceneBinding {
  stepToken: MealStrengthenStepToken;
  relatedEntityId?: string;
  relationPredicate?: string;
  contrastEntityId: string;
  groundingInstruction: string;
  connectInstruction: string;
  teachInstruction: string;
  contrastInstruction: string;
  fadeInstruction: string;
  recallInstructionKey: string;
}

export interface MealLexicalBuildProfile
  extends MealLexicalStrengthenProfile, Omit<MealBuildSceneBinding, "stepToken"> {
  stepToken: MealStrengthenStepToken;
}
