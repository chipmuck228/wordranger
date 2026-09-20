import type {
  ContextFrame,
  ExperienceStepSpec,
  GuidedExperienceStepSpec,
  LearningExperiencePlan,
} from "../../domain/types";
import {
  FIXTURE_PROVENANCE,
  MINIMAL_SUPPORT,
  assessable,
  completeAll,
  entityArg,
  explicitChoice,
  nextOrEnd,
  pred,
  strengthenLadder,
} from "../shared";
import { mealPrefixForFrame } from "./contexts";
import { MEAL_SENSE } from "./knowledge";
import { MEAL_SKELETON_ID } from "./skeleton";

function spoonInterpretationTarget() {
  return {
    id: "target-spoon",
    sense: MEAL_SENSE.spoon,
    focus: "CONTEXT_INTERPRETATION" as const,
    requiredRoleIds: ["EATING_TOOL"],
    requiredRelationIds: ["SUITABLE_FOR"],
  };
}

function spoonFormTarget() {
  return {
    id: "target-spoon-form",
    sense: MEAL_SENSE.spoon,
    focus: "MEANING_TO_FORM" as const,
  };
}

function mealRecallStep(
  prefix: string,
  mode: "BUILD" | "STRENGTHEN",
): ExperienceStepSpec {
  return assessable({
    id: `${prefix}-${mode.toLowerCase()}-recall`,
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
    requiredCapabilities: [`frozen-text-input:TYPE`],
    transition: nextOrEnd(true),
  });
}

function mealGuidedBuildSteps(prefix: string): ExperienceStepSpec[] {
  const present: GuidedExperienceStepSpec = {
    id: `${prefix}-build-present`,
    purpose: "GROUND",
    targetIds: ["target-spoon"],
    semanticAction: "OBSERVE",
    executionIntent: {
      kind: "GUIDED",
      guidedActivityKind: "PRESENT_CONTEXT",
      completionMode: "ACKNOWLEDGE_ONLY",
      rationale:
        "Show soup, bowl, and tools before any judgment so the learner can see the scene.",
    },
    presentation: {
      instruction: "Look at the soup, bowl, and eating tools on the table.",
      presentedEntityIds: [
        `${prefix}-soup`,
        `${prefix}-bowl`,
        `${prefix}-spoon`,
        `${prefix}-fork`,
      ],
    },
    transition: nextOrEnd(false),
  };

  const observe: GuidedExperienceStepSpec = {
    id: `${prefix}-build-observe-relation`,
    purpose: "CONNECT",
    targetIds: ["target-spoon"],
    semanticAction: "OBSERVE",
    executionIntent: {
      kind: "GUIDED",
      guidedActivityKind: "OBSERVE_RELATION",
      completionMode: "ACKNOWLEDGE_ONLY",
      rationale:
        "Present that the spoon is suitable for soup. Acknowledgement is not a correctness judgment.",
    },
    presentation: {
      instruction:
        "Notice that the spoon is the tool suitable for taking the soup.",
      presentedEntityIds: [`${prefix}-spoon`, `${prefix}-soup`],
      presentedFactPredicates: ["suitable_for"],
    },
    transition: nextOrEnd(false),
  };

  const contrast: GuidedExperienceStepSpec = {
    id: `${prefix}-build-show-contrast`,
    purpose: "DISCRIMINATE",
    targetIds: ["target-spoon"],
    semanticAction: "OBSERVE",
    executionIntent: {
      kind: "GUIDED",
      guidedActivityKind: "SHOW_CONTRAST",
      completionMode: "ACKNOWLEDGE_ONLY",
      rationale:
        "Show spoon vs fork as a contrast, without asking which option is correct.",
    },
    presentation: {
      instruction:
        "Compare the spoon and the fork. One is for liquid food; the other is not.",
      presentedEntityIds: [`${prefix}-spoon`, `${prefix}-fork`],
    },
    transition: nextOrEnd(false),
  };

  return [present, observe, contrast, mealRecallStep(prefix, "BUILD")];
}

function mealAssessableStrengthenSteps(prefix: string): ExperienceStepSpec[] {
  const strengthenPolicy = {
    initialSupportBlockIds: [],
    ladder: strengthenLadder({
      functionCue: "meal-support-function",
      contrast: "meal-support-contrast",
      partial: "meal-support-partial",
      answer: "meal-support-answer",
    }),
  };

  const spoon = `${prefix}-spoon`;
  const fork = `${prefix}-fork`;

  return [
    assessable({
      id: `${prefix}-strengthen-identify`,
      purpose: "GROUND",
      targetIds: ["target-spoon"],
      semanticAction: "IDENTIFY",
      promptIntent: {
        instructionKey: "Which object makes the active meal goal possible?",
        semanticQuestion: pred("makes_goal_possible", [entityArg(spoon)]),
      },
      expectedResponse: {
        kind: "ENTITY_REF",
        ...explicitChoice(
          [
            {
              id: `${prefix}-opt-spoon`,
              value: spoon,
              displayText: "spoon",
              lexemeRef: MEAL_SENSE.spoon,
            },
            {
              id: `${prefix}-opt-fork`,
              value: fork,
              displayText: "fork",
              lexemeRef: MEAL_SENSE.fork,
            },
          ],
          [`${prefix}-opt-spoon`],
        ),
      },
      supportPolicy: strengthenPolicy,
      requiredCapabilities: [`frozen-choice:IDENTIFY`],
      transition: nextOrEnd(false),
    }),
    assessable({
      id: `${prefix}-strengthen-distinguish`,
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
        ...explicitChoice(
          [
            {
              id: `${prefix}-opt-spoon-fit`,
              value: spoon,
              displayText: "spoon",
              lexemeRef: MEAL_SENSE.spoon,
            },
            {
              id: `${prefix}-opt-fork-fit`,
              value: fork,
              displayText: "fork",
              lexemeRef: MEAL_SENSE.fork,
            },
          ],
          [`${prefix}-opt-spoon-fit`],
        ),
      },
      supportPolicy: strengthenPolicy,
      requiredCapabilities: [`frozen-choice:DISTINGUISH`],
      transition: nextOrEnd(false),
    }),
    mealRecallStep(prefix, "STRENGTHEN"),
  ];
}

export function createMealBuildPlan(frame: ContextFrame): LearningExperiencePlan {
  const prefix = mealPrefixForFrame(frame.id);
  const steps = mealGuidedBuildSteps(prefix);
  return {
    id: `meal-build-${frame.id}`,
    schemaVersion: "candidate-v0",
    mode: "BUILD",
    sourceLearningNeedRef: "need-meal-spoon",
    targets: [spoonInterpretationTarget(), spoonFormTarget()],
    skeletonId: MEAL_SKELETON_ID,
    contextFrameId: frame.id,
    activeGoalId: "EATER_CAN_EAT_FOOD",
    steps,
    completionPolicy: completeAll(steps),
    provenance: FIXTURE_PROVENANCE,
  };
}

export function createMealRecallStrengthenPlan(
  frame: ContextFrame,
): LearningExperiencePlan {
  const prefix = mealPrefixForFrame(frame.id);
  const spoon = `${prefix}-spoon`;
  const reconnect: GuidedExperienceStepSpec = {
    id: `${prefix}-strengthen-reconnect`,
    purpose: "CONNECT",
    targetIds: ["target-spoon-form"],
    semanticAction: "OBSERVE",
    executionIntent: {
      kind: "GUIDED",
      guidedActivityKind: "RECONNECT_FORM",
      completionMode: "ACKNOWLEDGE_ONLY",
      rationale:
        "Re-show the scene object with the English form. Acknowledgement is support exposure, not Evidence.",
    },
    presentation: {
      instruction: "这是强化，不是测试。重新看一看勺子和它的英文词形。",
      presentedEntityIds: [spoon],
    },
    transition: nextOrEnd(false),
  };
  const fade: GuidedExperienceStepSpec = {
    id: `${prefix}-strengthen-fade`,
    purpose: "CONNECT",
    targetIds: ["target-spoon-form"],
    semanticAction: "OBSERVE",
    executionIntent: {
      kind: "GUIDED",
      guidedActivityKind: "FADE_FORM",
      completionMode: "ACKNOWLEDGE_ONLY",
      rationale:
        "Withdraw the full form and leave a spelling cue. Acknowledgement is support exposure, not Evidence.",
    },
    presentation: {
      instruction: "完整英文已经收起。下面是提示，不是答案。",
      presentedEntityIds: [spoon],
    },
    transition: nextOrEnd(false),
  };
  const steps = [reconnect, fade, mealRecallStep(prefix, "STRENGTHEN")];
  return {
    id: `meal-strengthen-recall-${frame.id}`,
    schemaVersion: "candidate-v0",
    mode: "STRENGTHEN",
    sourceLearningNeedRef: "need-meal-spoon",
    targets: [spoonFormTarget()],
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
  const steps = mealAssessableStrengthenSteps(prefix);
  return {
    id: `meal-strengthen-${frame.id}`,
    schemaVersion: "candidate-v0",
    mode: "STRENGTHEN",
    sourceLearningNeedRef: "need-meal-spoon",
    targets: [
      { ...spoonInterpretationTarget(), focus: "DISCRIMINATION" },
      spoonFormTarget(),
    ],
    skeletonId: MEAL_SKELETON_ID,
    contextFrameId: frame.id,
    activeGoalId: "EATER_CAN_EAT_FOOD",
    steps,
    completionPolicy: completeAll(steps),
    provenance: FIXTURE_PROVENANCE,
  };
}
