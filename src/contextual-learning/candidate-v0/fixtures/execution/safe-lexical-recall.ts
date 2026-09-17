/**
 * Candidate V0 / Experimental / Not a Standard.
 *
 * Sequencing-only fixture. It does not prove a full BUILD experience.
 * It only provides a single step that the current semantic whitelist can compile.
 */

import type {
  ContextFrame,
  ExperienceStepSpec,
  LearningExperiencePlan,
} from "../../domain/types";
import {
  FIXTURE_PROVENANCE,
  MINIMAL_SUPPORT,
  completeAll,
  entityArg,
  nextOrEnd,
  pred,
} from "../shared";
import { mealPrefixForFrame } from "../meal/contexts";
import { MEAL_SENSE } from "../meal/knowledge";
import { MEAL_SKELETON_ID } from "../meal/skeleton";

/**
 * One TYPE / LEXICAL_FORM / MEANING_TO_FORM / RECALL step.
 * Use only to verify ExperienceRun sequencing, not Meal completeness.
 */
export function createSafeLexicalRecallPlan(
  frame: ContextFrame,
): LearningExperiencePlan {
  const prefix = mealPrefixForFrame(frame.id);
  const recall: ExperienceStepSpec = {
    id: `${prefix}-safe-recall`,
    purpose: "RECALL",
    targetIds: ["target-spoon-form"],
    semanticAction: "TYPE",
    promptIntent: {
      instructionKey: "Produce the English word for the required tool.",
      semanticQuestion: pred("name_required_tool", [
        entityArg(`${prefix}-spoon`),
      ]),
      mustNotRevealTargetForm: true,
    },
    expectedResponse: { kind: "LEXICAL_FORM", sense: MEAL_SENSE.spoon },
    supportPolicy: MINIMAL_SUPPORT,
    requiredCapabilities: ["frozen-text-input:TYPE"],
    transition: nextOrEnd(true),
  };

  return {
    id: `safe-lexical-recall-${frame.id}`,
    schemaVersion: "candidate-v0",
    mode: "RETRIEVE",
    sourceLearningNeedRef: "need-meal-spoon",
    targets: [
      {
        id: "target-spoon-form",
        sense: MEAL_SENSE.spoon,
        focus: "MEANING_TO_FORM",
      },
    ],
    skeletonId: MEAL_SKELETON_ID,
    contextFrameId: frame.id,
    activeGoalId: "EATER_CAN_EAT_FOOD",
    steps: [recall],
    completionPolicy: completeAll([recall]),
    provenance: FIXTURE_PROVENANCE,
  };
}
