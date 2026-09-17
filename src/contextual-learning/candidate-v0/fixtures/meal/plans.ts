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
  strengthenLadder,
} from "../shared";
import { mealPrefixForFrame } from "./contexts";
import { MEAL_SENSE } from "./knowledge";
import { MEAL_SKELETON_ID } from "./skeleton";

function spoonTarget() {
  return {
    id: "target-spoon",
    sense: MEAL_SENSE.spoon,
    focus: "CONTEXT_INTERPRETATION" as const,
    requiredRoleIds: ["EATING_TOOL"],
    requiredRelationIds: ["SUITABLE_FOR"],
  };
}

function mealSteps(prefix: string, mode: "BUILD" | "STRENGTHEN"): ExperienceStepSpec[] {
  const spoon = `${prefix}-spoon`;
  const fork = `${prefix}-fork`;
  const strengthenPolicy = {
    initialSupportBlockIds: [],
    ladder: strengthenLadder({
      functionCue: "meal-support-function",
      contrast: "meal-support-contrast",
      partial: "meal-support-partial",
      answer: "meal-support-answer",
    }),
  };

  const identify: ExperienceStepSpec = {
    id: `${prefix}-${mode.toLowerCase()}-identify`,
    purpose: "GROUND",
    targetIds: ["target-spoon"],
    semanticAction: "IDENTIFY",
    promptIntent: {
      instructionKey: "Which object makes the active meal goal possible?",
      semanticQuestion: pred("makes_goal_possible", [entityArg(spoon)]),
    },
    expectedResponse: {
      kind: "ENTITY_REF",
      allowedEntityIds: [spoon, fork],
    },
    supportPolicy: mode === "BUILD" ? MINIMAL_SUPPORT : strengthenPolicy,
    requiredCapabilities: [`frozen-choice:IDENTIFY`],
    transition: nextOrEnd(false),
  };

  const distinguish: ExperienceStepSpec = {
    id: `${prefix}-${mode.toLowerCase()}-distinguish`,
    purpose: "DISCRIMINATE",
    targetIds: ["target-spoon"],
    semanticAction: "DISTINGUISH",
    promptIntent: {
      instructionKey:
        "Which tool is suitable for soup rather than for piercing food?",
      semanticQuestion: pred("suitable_for_soup", [entityArg(spoon)]),
    },
    expectedResponse: {
      kind: "ENTITY_REF",
      allowedEntityIds: [spoon, fork],
    },
    supportPolicy: mode === "BUILD" ? MINIMAL_SUPPORT : strengthenPolicy,
    requiredCapabilities: [`frozen-choice:DISTINGUISH`],
    transition: nextOrEnd(false),
  };

  const recall: ExperienceStepSpec = {
    id: `${prefix}-${mode.toLowerCase()}-recall`,
    purpose: "RECALL",
    targetIds: ["target-spoon"],
    semanticAction: "TYPE",
    promptIntent: {
      instructionKey: "Produce the English word for the required tool.",
      semanticQuestion: pred("name_required_tool", [entityArg(spoon)]),
      mustNotRevealTargetForm: true,
    },
    expectedResponse: { kind: "LEXICAL_FORM", sense: MEAL_SENSE.spoon },
    supportPolicy: MINIMAL_SUPPORT,
    requiredCapabilities: [`frozen-text-input:TYPE`],
    transition: nextOrEnd(true),
  };

  return [identify, distinguish, recall];
}

export function createMealBuildPlan(frame: ContextFrame): LearningExperiencePlan {
  const prefix = mealPrefixForFrame(frame.id);
  const steps = mealSteps(prefix, "BUILD");
  return {
    id: `meal-build-${frame.id}`,
    schemaVersion: "candidate-v0",
    mode: "BUILD",
    sourceLearningNeedRef: "need-meal-spoon",
    targets: [spoonTarget()],
    skeletonId: MEAL_SKELETON_ID,
    contextFrameId: frame.id,
    activeGoalId: "EATER_CAN_EAT_FOOD",
    steps,
    completionPolicy: completeAll(steps),
    provenance: FIXTURE_PROVENANCE,
  };
}

export function createMealStrengthenPlan(
  frame: ContextFrame,
): LearningExperiencePlan {
  const prefix = mealPrefixForFrame(frame.id);
  const steps = mealSteps(prefix, "STRENGTHEN");
  return {
    id: `meal-strengthen-${frame.id}`,
    schemaVersion: "candidate-v0",
    mode: "STRENGTHEN",
    sourceLearningNeedRef: "need-meal-spoon",
    targets: [{ ...spoonTarget(), focus: "DISCRIMINATION" }],
    skeletonId: MEAL_SKELETON_ID,
    contextFrameId: frame.id,
    activeGoalId: "EATER_CAN_EAT_FOOD",
    steps,
    completionPolicy: completeAll(steps),
    provenance: FIXTURE_PROVENANCE,
  };
}
