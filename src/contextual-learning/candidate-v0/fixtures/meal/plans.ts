import type {
  ContextFrame,
  ExperienceStepSpec,
  ExperienceTarget,
  LearningExperiencePlan,
} from "../../domain/types";
import { HOME_BREAKFAST_FRAME_ID } from "../../content/packs/meal/meal-scene-content";
import { MEAL_SCENE_CONTENT_PACK } from "../../content/packs/meal/meal-scene-content";
import { resolveSceneContent } from "../../content/resolve-scene-content";
import { snapshotSceneContentFromPack } from "../../content/snapshot-from-pack";
import type { SceneLexemeLoader } from "../../content/types";
import { MEAL_SCENE_CLUSTER } from "../../memory-routing/scene-catalog";
import {
  createContextualLexicalBuildPlan,
  createContextualLexicalStrengthenPlan,
} from "../../planning/create-contextual-lexical-plans";
import { MEAL_FRAMES } from "./contexts";
import { projectResolvedMealContentOntoFrame } from "./project-resolved-onto-frame";
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
import { MEAL_SKELETON_ID, mealSkeleton } from "./skeleton";

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

function mealContentForFrame(
  frame: ContextFrame,
  loadLexeme?: SceneLexemeLoader,
) {
  const authored = MEAL_SCENE_CONTENT_PACK.frames.some(
    (item) => item.frameId === frame.id,
  );
  if (authored) {
    if (!loadLexeme) {
      return null;
    }
    const resolved = resolveSceneContent({
      pack: MEAL_SCENE_CONTENT_PACK,
      frame,
      frames: MEAL_FRAMES,
      skeleton: mealSkeleton,
      cluster: MEAL_SCENE_CLUSTER,
      loadLexeme,
    });
    return resolved.ok ? resolved.content : null;
  }
  const homeCatalog = snapshotSceneContentFromPack(
    MEAL_SCENE_CONTENT_PACK,
    HOME_BREAKFAST_FRAME_ID,
  );
  return homeCatalog
    ? projectResolvedMealContentOntoFrame(homeCatalog, frame)
    : null;
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
  loadLexeme?: SceneLexemeLoader;
}): LearningExperiencePlan {
  const content = mealContentForFrame(input.frame, input.loadLexeme);
  if (!content) {
    return emptyMealBuildPlan(input.frame);
  }
  return createContextualLexicalBuildPlan({
    frame: input.frame,
    content,
    target: input.profile.target,
    stepIdPrefix: mealPrefixForFrame(input.frame.id),
  });
}

export function createMealBuildPlan(
  frame: ContextFrame,
  request?: { targets?: readonly ExperienceTarget[]; loadLexeme?: SceneLexemeLoader },
): LearningExperiencePlan {
  const requested = request?.targets?.[0]?.sense;
  const identity = requested
    ? identityForFixtureSense(requested) ?? identityForBundledTarget(requested)
    : identityForFixtureSense(MEAL_SENSE.spoon);
  if (!identity || (request && request.targets && request.targets.length !== 1)) {
    return emptyMealBuildPlan(frame);
  }
  return createMealLexicalBuildPlan({
    frame,
    profile: identity,
    loadLexeme: request?.loadLexeme,
  });
}

export function createMealActiveRecallStrengthenPlan(input: {
  frame: ContextFrame;
  profile: MealLexicalStrengthenIdentity;
  loadLexeme?: SceneLexemeLoader;
}): LearningExperiencePlan {
  const content = mealContentForFrame(input.frame, input.loadLexeme);
  if (!content) {
    return {
      id: `meal-strengthen-recall-${input.frame.id}-unresolved`,
      schemaVersion: "candidate-v0",
      mode: "STRENGTHEN",
      sourceLearningNeedRef: "need-opaque-ref",
      targets: [],
      skeletonId: MEAL_SKELETON_ID,
      contextFrameId: input.frame.id,
      activeGoalId: "EATER_CAN_EAT_FOOD",
      steps: [],
      completionPolicy: completeAll([]),
      provenance: FIXTURE_PROVENANCE,
    };
  }
  return createContextualLexicalStrengthenPlan({
    frame: input.frame,
    content,
    target: input.profile.target,
    stepIdPrefix: mealPrefixForFrame(input.frame.id),
  });
}

export function createMealRecallStrengthenPlan(
  frame: ContextFrame,
  request?: { targets?: readonly ExperienceTarget[]; loadLexeme?: SceneLexemeLoader },
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
  return createMealActiveRecallStrengthenPlan({
    frame,
    profile: identity,
    loadLexeme: request?.loadLexeme,
  });
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
