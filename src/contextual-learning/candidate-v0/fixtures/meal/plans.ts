import type {
  ContextFrame,
  ExperienceStepSpec,
  ExperienceTarget,
  GuidedExperienceStepSpec,
  LearningExperiencePlan,
} from "../../domain/types";
import {
  mealSceneEntityIds,
  prefixedMealEntityId,
} from "../../build/meal-lexical-build-profiles";
import { MEAL_BUILD_SCENE_BINDINGS } from "../../build/meal-lexical-build-profiles";
import {
  identityForBundledTarget,
  identityForFixtureSense,
} from "../../strengthen/meal-lexical-profiles";
import type { MealLexicalStrengthenIdentity } from "../../strengthen/meal-lexical-profiles";
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

function emptyMealBuildPlan(frame: ContextFrame): LearningExperiencePlan {
  return {
    id: `meal-build-${frame.id}-unresolved`,
    schemaVersion: "candidate-v0",
    mode: "BUILD",
    sourceLearningNeedRef: "need-opaque-ref",
    targets: [],
    skeletonId: MEAL_SKELETON_ID,
    contextFrameId: frame.id,
    activeGoalId: "EATER_CAN_EAT_FOOD",
    steps: [],
    completionPolicy: completeAll([]),
    provenance: FIXTURE_PROVENANCE,
  };
}

export function createMealLexicalBuildPlan(input: {
  frame: ContextFrame;
  profile: MealLexicalStrengthenIdentity;
}): LearningExperiencePlan {
  const binding = MEAL_BUILD_SCENE_BINDINGS[input.profile.stepToken];
  const prefix = mealPrefixForFrame(input.frame.id);
  const entityId = `${prefix}-${input.profile.stepToken}`;
  const contrastEntityId = prefixedMealEntityId(prefix, binding.contrastEntityId);
  const relatedEntityId = binding.relatedEntityId
    ? prefixedMealEntityId(prefix, binding.relatedEntityId)
    : null;
  if (!contrastEntityId || (binding.relatedEntityId && !relatedEntityId)) {
    return emptyMealBuildPlan(input.frame);
  }
  const interpretationTargetId = `target-${input.profile.stepToken}`;
  const formTargetId = `target-${input.profile.stepToken}-form`;
  const bundledTarget = {
    lexemeId: input.profile.target.lexemeId,
    senseId: input.profile.target.senseId,
  };
  const interpretationTarget = {
    id: interpretationTargetId,
    sense: input.profile.fixtureSense,
    focus: "CONTEXT_INTERPRETATION" as const,
    requiredRoleIds: [input.profile.roleId],
    requiredRelationIds:
      binding.relationPredicate === "suitable_for" ? ["SUITABLE_FOR"] : undefined,
  };
  const formTarget = {
    id: formTargetId,
    sense: input.profile.fixtureSense,
    focus: "MEANING_TO_FORM" as const,
  };

  const ground: GuidedExperienceStepSpec = {
    id: `${prefix}-build-${input.profile.stepToken}-ground`,
    purpose: "GROUND",
    targetIds: [interpretationTargetId],
    semanticAction: "OBSERVE",
    executionIntent: {
      kind: "GUIDED",
      guidedActivityKind: "PRESENT_CONTEXT",
      completionMode: "ACKNOWLEDGE_ONLY",
      rationale:
        "Show the Meal scene and the current entity before any judgment. Acknowledgement is not Evidence.",
    },
    presentation: {
      instruction: binding.groundingInstruction,
      presentedEntityIds: mealSceneEntityIds(prefix),
    },
    transition: nextOrEnd(false),
  };

  const connect: GuidedExperienceStepSpec = {
    id: `${prefix}-build-${input.profile.stepToken}-connect`,
    purpose: "CONNECT",
    targetIds: [interpretationTargetId],
    semanticAction: "OBSERVE",
    executionIntent: {
      kind: "GUIDED",
      guidedActivityKind: binding.relationPredicate
        ? "OBSERVE_RELATION"
        : "CONNECT_ENTITY_AND_MEANING",
      completionMode: "ACKNOWLEDGE_ONLY",
      rationale:
        "Connect the entity, scene role, and Chinese meaning. Acknowledgement is not independent recall.",
    },
    presentation: {
      instruction: binding.connectInstruction,
      presentedEntityIds: relatedEntityId
        ? [entityId, relatedEntityId]
        : [entityId],
      presentedFactPredicates: binding.relationPredicate
        ? [binding.relationPredicate]
        : undefined,
    },
    transition: nextOrEnd(false),
  };

  const teach: GuidedExperienceStepSpec = {
    id: `${prefix}-build-${input.profile.stepToken}-teach`,
    purpose: "CONNECT",
    targetIds: [formTargetId],
    semanticAction: "OBSERVE",
    executionIntent: {
      kind: "GUIDED",
      guidedActivityKind: "PRESENT_LEXICAL_FORM",
      completionMode: "ACKNOWLEDGE_ONLY",
      rationale:
        "Present the English form as teaching support, not as a test.",
    },
    presentation: {
      instruction: binding.teachInstruction,
      presentedEntityIds: [entityId],
    },
    supportExposure: {
      kinds: ["LEXICAL_FORM", "MEANING_GLOSS"],
      target: bundledTarget,
    },
    transition: nextOrEnd(false),
  };

  const contrast: GuidedExperienceStepSpec = {
    id: `${prefix}-build-${input.profile.stepToken}-contrast`,
    purpose: "DISCRIMINATE",
    targetIds: [interpretationTargetId],
    semanticAction: "OBSERVE",
    executionIntent: {
      kind: "GUIDED",
      guidedActivityKind: "SHOW_CONTRAST",
      completionMode: "ACKNOWLEDGE_ONLY",
      rationale:
        "Show an authored contrast binding. Acknowledgement is not Evidence.",
    },
    presentation: {
      instruction: binding.contrastInstruction,
      presentedEntityIds: [entityId, contrastEntityId],
    },
    transition: nextOrEnd(false),
  };

  const fade: GuidedExperienceStepSpec = {
    id: `${prefix}-build-${input.profile.stepToken}-fade`,
    purpose: "CONNECT",
    targetIds: [formTargetId],
    semanticAction: "OBSERVE",
    executionIntent: {
      kind: "GUIDED",
      guidedActivityKind: "FADE_FORM",
      completionMode: "ACKNOWLEDGE_ONLY",
      rationale:
        "Withdraw the full form and leave a spelling cue. Acknowledgement is support exposure, not Evidence.",
    },
    presentation: {
      instruction: binding.fadeInstruction,
      presentedEntityIds: [entityId],
    },
    supportExposure: {
      kinds: ["SPELLING_CUE"],
      target: bundledTarget,
    },
    transition: nextOrEnd(false),
  };

  const recall = assessable({
    id: `${prefix}-build-${input.profile.stepToken}-recall`,
    purpose: "RECALL",
    targetIds: [formTargetId],
    semanticAction: "TYPE",
    promptIntent: {
      instructionKey: binding.recallInstructionKey,
      semanticQuestion: pred("name_required_object", [entityArg(entityId)]),
      mustNotRevealTargetForm: true,
    },
    expectedResponse: {
      kind: "LEXICAL_FORM",
      sense: input.profile.fixtureSense,
    },
    supportPolicy: MINIMAL_SUPPORT,
    requiredCapabilities: [`frozen-text-input:TYPE`],
    transition: nextOrEnd(true),
  });

  const steps = [ground, connect, teach, contrast, fade, recall];
  return {
    id: `meal-build-${input.frame.id}-${input.profile.stepToken}`,
    schemaVersion: "candidate-v0",
    mode: "BUILD",
    sourceLearningNeedRef: "need-opaque-ref",
    targets: [interpretationTarget, formTarget],
    skeletonId: MEAL_SKELETON_ID,
    contextFrameId: input.frame.id,
    activeGoalId: "EATER_CAN_EAT_FOOD",
    steps,
    completionPolicy: completeAll(steps),
    provenance: FIXTURE_PROVENANCE,
  };
}

export function createMealBuildPlan(
  frame: ContextFrame,
  request?: { targets?: readonly ExperienceTarget[] },
): LearningExperiencePlan {
  const requested = request?.targets?.[0]?.sense;
  const identity = requested
    ? identityForFixtureSense(requested) ?? identityForBundledTarget(requested)
    : identityForFixtureSense(MEAL_SENSE.spoon);
  if (!identity || (request && (request.targets?.length ?? 0) !== 1)) {
    return emptyMealBuildPlan(frame);
  }
  return createMealLexicalBuildPlan({ frame, profile: identity });
}

export function createMealActiveRecallStrengthenPlan(input: {
  frame: ContextFrame;
  profile: MealLexicalStrengthenIdentity;
}): LearningExperiencePlan {
  const prefix = mealPrefixForFrame(input.frame.id);
  const entityId = `${prefix}-${input.profile.stepToken}`;
  const targetId = `target-${input.profile.stepToken}-form`;
  const formTarget = {
    id: targetId,
    sense: input.profile.fixtureSense,
    focus: "MEANING_TO_FORM" as const,
  };
  const bundledTarget = {
    lexemeId: input.profile.target.lexemeId,
    senseId: input.profile.target.senseId,
  };
  const reconnect: GuidedExperienceStepSpec = {
    id: `${prefix}-strengthen-${input.profile.stepToken}-reconnect`,
    purpose: "CONNECT",
    targetIds: [targetId],
    semanticAction: "OBSERVE",
    executionIntent: {
      kind: "GUIDED",
      guidedActivityKind: "RECONNECT_FORM",
      completionMode: "ACKNOWLEDGE_ONLY",
      rationale:
        "Re-show the scene object with the English form. Acknowledgement is support exposure, not Evidence.",
    },
    presentation: {
      instruction: "这是强化，不是测试。重新看一看这个词和它的英文词形。",
      presentedEntityIds: [entityId],
    },
    supportExposure: {
      kinds: ["LEXICAL_FORM", "MEANING_GLOSS"],
      target: bundledTarget,
    },
    transition: nextOrEnd(false),
  };
  const fade: GuidedExperienceStepSpec = {
    id: `${prefix}-strengthen-${input.profile.stepToken}-fade`,
    purpose: "CONNECT",
    targetIds: [targetId],
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
      presentedEntityIds: [entityId],
    },
    supportExposure: {
      kinds: ["SPELLING_CUE"],
      target: bundledTarget,
    },
    transition: nextOrEnd(false),
  };
  const verify = assessable({
    id: `${prefix}-strengthen-${input.profile.stepToken}-recall`,
    purpose: "RECALL",
    targetIds: [targetId],
    semanticAction: "TYPE",
    promptIntent: {
      instructionKey: "Produce the English word for the highlighted object.",
      semanticQuestion: pred("name_required_object", [entityArg(entityId)]),
      mustNotRevealTargetForm: true,
    },
    expectedResponse: { kind: "LEXICAL_FORM", sense: input.profile.fixtureSense },
    supportPolicy: MINIMAL_SUPPORT,
    requiredCapabilities: [`frozen-text-input:TYPE`],
    transition: nextOrEnd(true),
  });
  const steps = [reconnect, fade, verify];
  return {
    id: `meal-strengthen-recall-${input.frame.id}-${input.profile.stepToken}`,
    schemaVersion: "candidate-v0",
    mode: "STRENGTHEN",
    sourceLearningNeedRef: "need-opaque-ref",
    targets: [formTarget],
    skeletonId: MEAL_SKELETON_ID,
    contextFrameId: input.frame.id,
    activeGoalId: "EATER_CAN_EAT_FOOD",
    steps,
    completionPolicy: completeAll(steps),
    provenance: FIXTURE_PROVENANCE,
  };
}

export function createMealRecallStrengthenPlan(
  frame: ContextFrame,
  request?: { targets?: readonly ExperienceTarget[] },
): LearningExperiencePlan {
  const requested = request?.targets?.[0]?.sense;
  const identity = requested ? identityForFixtureSense(requested) : null;
  if (!identity || (request?.targets?.length ?? 0) !== 1) {
    return {
      id: `meal-strengthen-recall-${frame.id}-unresolved`,
      schemaVersion: "candidate-v0",
      mode: "STRENGTHEN",
      sourceLearningNeedRef: "need-opaque-ref",
      targets: [],
      skeletonId: MEAL_SKELETON_ID,
      contextFrameId: frame.id,
      activeGoalId: "EATER_CAN_EAT_FOOD",
      steps: [],
      completionPolicy: completeAll([]),
      provenance: FIXTURE_PROVENANCE,
    };
  }
  return createMealActiveRecallStrengthenPlan({ frame, profile: identity });
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
