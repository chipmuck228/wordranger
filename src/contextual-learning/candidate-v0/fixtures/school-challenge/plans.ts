import type {
  ContextFrame,
  ExperienceStepSpec,
  GuidedExperienceStepSpec,
  LearningExperiencePlan,
} from "../../domain/types";
import { serializePredicate } from "../../domain/predicates";
import {
  FIXTURE_PROVENANCE,
  MINIMAL_SUPPORT,
  assessable,
  completeAll,
  conceptArg,
  entityArg,
  explicitChoice,
  nextOrEnd,
  pred,
  strengthenLadder,
} from "../shared";
import { schoolPrefixForFrame } from "./contexts";
import { SCHOOL_SENSE } from "./knowledge";
import { SCHOOL_SKELETON_ID } from "./skeleton";

function schoolTargets() {
  return [
    {
      id: "target-try",
      sense: SCHOOL_SENSE.try,
      focus: "DISCRIMINATION" as const,
    },
    {
      id: "target-success",
      sense: SCHOOL_SENSE.success,
      focus: "CONTEXT_INTERPRETATION" as const,
    },
    {
      id: "target-try-form",
      sense: SCHOOL_SENSE.try,
      focus: "MEANING_TO_FORM" as const,
    },
  ];
}

function schoolSteps(
  prefix: string,
  mode: "BUILD" | "STRENGTHEN",
): ExperienceStepSpec[] {
  const strengthenPolicy = {
    initialSupportBlockIds: [],
    ladder: strengthenLadder({
      functionCue: "school-support-function",
      contrast: "school-support-contrast",
      partial: "school-support-partial",
      answer: "school-support-answer",
    }),
  };

  const tryClaim = pred("attempt_is", [
    entityArg(`${prefix}-attempt-1`),
    conceptArg("concept-attempt"),
  ]);
  const successMisread = pred("attempt_is", [
    entityArg(`${prefix}-attempt-1`),
    conceptArg("concept-success-outcome"),
  ], false);
  const goalSatisfied = pred("goal_satisfied", [
    entityArg(`${prefix}-attempt-2`),
  ]);
  const generalAbility = pred("has_general_ability", [
    entityArg(`${prefix}-challenger`),
  ], false);

  const discriminate: ExperienceStepSpec = assessable({
    id: `${prefix}-${mode.toLowerCase()}-try-vs-success`,
    purpose: "DISCRIMINATE",
    targetIds: ["target-try"],
    semanticAction: "DISTINGUISH",
    promptIntent: {
      instructionKey:
        "Attempt 1 fell. Which claim is supported: try, or success?",
      semanticQuestion: tryClaim,
    },
    expectedResponse: {
      kind: "CLAIM_CHOICE",
      ...explicitChoice(
        [
          {
            id: `${prefix}-claim-try`,
            value: tryClaim,
            displayText: serializePredicate(tryClaim),
            lexemeRef: SCHOOL_SENSE.try,
          },
          {
            id: `${prefix}-claim-success-misread`,
            value: successMisread,
            displayText: serializePredicate(successMisread),
            lexemeRef: SCHOOL_SENSE.success,
          },
        ],
        [`${prefix}-claim-try`],
      ),
    },
    supportPolicy: mode === "BUILD" ? MINIMAL_SUPPORT : strengthenPolicy,
    requiredCapabilities: ["frozen-choice:DISTINGUISH"],
    transition: nextOrEnd(false),
  });

  const successClaim: ExperienceStepSpec = assessable({
    id: `${prefix}-${mode.toLowerCase()}-success`,
    purpose: "CONNECT",
    targetIds: ["target-success"],
    semanticAction: "SELECT",
    promptIntent: {
      instructionKey:
        "Attempt 2 stood longer than the goal requires. Which claim is supported?",
      semanticQuestion: pred("goal_satisfied", [
        entityArg(`${prefix}-attempt-2`),
      ]),
    },
    expectedResponse: {
      kind: "CLAIM_CHOICE",
      ...explicitChoice(
        [
          {
            id: `${prefix}-claim-goal-satisfied`,
            value: goalSatisfied,
            displayText: serializePredicate(goalSatisfied),
            lexemeRef: SCHOOL_SENSE.success,
          },
          {
            id: `${prefix}-claim-general-ability`,
            value: generalAbility,
            displayText: serializePredicate(generalAbility),
          },
        ],
        [`${prefix}-claim-goal-satisfied`],
      ),
    },
    supportPolicy: mode === "BUILD" ? MINIMAL_SUPPORT : strengthenPolicy,
    requiredCapabilities: ["frozen-choice:SELECT"],
    transition: nextOrEnd(false),
  });

  const recall: ExperienceStepSpec = assessable({
    id: `${prefix}-${mode.toLowerCase()}-recall`,
    purpose: "RECALL",
    targetIds: ["target-try-form"],
    semanticAction: "TYPE",
    promptIntent: {
      instructionKey:
        "Name the word for an effort that does not yet satisfy the goal.",
      semanticQuestion: pred("name_attempt_action", [
        entityArg(`${prefix}-attempt-1`),
      ]),
      mustNotRevealTargetForm: true,
    },
    expectedResponse: { kind: "LEXICAL_FORM", sense: SCHOOL_SENSE.try },
    supportPolicy: MINIMAL_SUPPORT,
    requiredCapabilities: ["frozen-text-input:TYPE"],
    transition: nextOrEnd(true),
  });

  return [discriminate, successClaim, recall];
}

export function createSchoolBuildPlan(
  frame: ContextFrame,
): LearningExperiencePlan {
  const prefix = schoolPrefixForFrame(frame.id);
  const steps = schoolSteps(prefix, "BUILD");
  return {
    id: `school-build-${frame.id}`,
    schemaVersion: "candidate-v0",
    mode: "BUILD",
    sourceLearningNeedRef: "need-school-try",
    targets: schoolTargets(),
    skeletonId: SCHOOL_SKELETON_ID,
    contextFrameId: frame.id,
    activeGoalId: "COMPLETE_CHALLENGE",
    steps,
    completionPolicy: completeAll(steps),
    provenance: FIXTURE_PROVENANCE,
  };
}

export function createSchoolStrengthenPlan(
  frame: ContextFrame,
): LearningExperiencePlan {
  const prefix = schoolPrefixForFrame(frame.id);
  const steps = schoolSteps(prefix, "STRENGTHEN");
  return {
    id: `school-strengthen-${frame.id}`,
    schemaVersion: "candidate-v0",
    mode: "STRENGTHEN",
    sourceLearningNeedRef: "need-school-try",
    targets: schoolTargets(),
    skeletonId: SCHOOL_SKELETON_ID,
    contextFrameId: frame.id,
    activeGoalId: "COMPLETE_CHALLENGE",
    steps,
    completionPolicy: completeAll(steps),
    provenance: FIXTURE_PROVENANCE,
  };
}

/**
 * Presentation only. Not a substitute for assessable CLAIM_CHOICE.
 */
export function createSchoolGuidedPresentationPlan(
  frame: ContextFrame,
): LearningExperiencePlan {
  const prefix = schoolPrefixForFrame(frame.id);
  const present: GuidedExperienceStepSpec = {
    id: `${prefix}-guided-present-attempt`,
    purpose: "OBSERVE",
    targetIds: ["target-try"],
    semanticAction: "OBSERVE",
    executionIntent: {
      kind: "GUIDED",
      guidedActivityKind: "PRESENT_CONTEXT",
      completionMode: "ACKNOWLEDGE_ONLY",
      rationale:
        "Show that the first attempt fell. Acknowledgement does not judge try vs success.",
    },
    presentation: {
      instruction:
        "Watch the first attempt fall. This scene is shown, not scored.",
      presentedEntityIds: [`${prefix}-attempt-1`, `${prefix}-challenger`],
    },
    transition: nextOrEnd(true),
  };
  return {
    id: `school-guided-present-${frame.id}`,
    schemaVersion: "candidate-v0",
    mode: "BUILD",
    sourceLearningNeedRef: "need-school-try",
    targets: schoolTargets(),
    skeletonId: SCHOOL_SKELETON_ID,
    contextFrameId: frame.id,
    activeGoalId: "COMPLETE_CHALLENGE",
    steps: [present],
    completionPolicy: completeAll([present]),
    provenance: FIXTURE_PROVENANCE,
  };
}
