import type {
  ContextFrame,
  ExperienceStepSpec,
  LearningExperiencePlan,
} from "../../domain/types";
import {
  FIXTURE_PROVENANCE,
  MINIMAL_SUPPORT,
  completeAll,
  conceptArg,
  entityArg,
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

  const discriminate: ExperienceStepSpec = {
    id: `${prefix}-${mode.toLowerCase()}-try-vs-success`,
    purpose: "DISCRIMINATE",
    targetIds: ["target-try"],
    semanticAction: "DISTINGUISH",
    promptIntent: {
      instructionKey:
        "Attempt 1 fell. Which claim is supported: try, or success?",
      semanticQuestion: pred("attempt_is", [
        entityArg(`${prefix}-attempt-1`),
        conceptArg("concept-attempt"),
      ]),
    },
    expectedResponse: {
      kind: "CLAIM_CHOICE",
      allowedPredicates: [
        pred("attempt_is", [
          entityArg(`${prefix}-attempt-1`),
          conceptArg("concept-attempt"),
        ]),
        pred("attempt_is", [
          entityArg(`${prefix}-attempt-1`),
          conceptArg("concept-success-outcome"),
        ], false),
      ],
    },
    supportPolicy: mode === "BUILD" ? MINIMAL_SUPPORT : strengthenPolicy,
    requiredCapabilities: ["frozen-choice:DISTINGUISH"],
    transition: nextOrEnd(false),
  };

  const successClaim: ExperienceStepSpec = {
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
      allowedPredicates: [
        pred("goal_satisfied", [entityArg(`${prefix}-attempt-2`)]),
        pred("has_general_ability", [entityArg(`${prefix}-challenger`)], false),
      ],
    },
    supportPolicy: mode === "BUILD" ? MINIMAL_SUPPORT : strengthenPolicy,
    requiredCapabilities: ["frozen-choice:SELECT"],
    transition: nextOrEnd(false),
  };

  const recall: ExperienceStepSpec = {
    id: `${prefix}-${mode.toLowerCase()}-recall`,
    purpose: "RECALL",
    targetIds: ["target-try"],
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
  };

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
