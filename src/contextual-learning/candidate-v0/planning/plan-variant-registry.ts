/**
 * Candidate V0 / Experimental / Not a Standard.
 * Explicit pre-authored plan variants. Metadata is declared, not parsed.
 */

import type { ContextFrame, LexemeSenseRef } from "../domain/types";
import { classroomRulerFrame, libraryBookFrame } from "../fixtures/borrowing-sharing/contexts";
import { BORROW_PROFILES, BORROW_SENSE } from "../fixtures/borrowing-sharing/knowledge";
import {
  createBorrowBuildPlan,
  createBorrowGuidedPerspectivePlan,
  createBorrowStrengthenPlan,
} from "../fixtures/borrowing-sharing/plans";
import { borrowingSharingSkeleton } from "../fixtures/borrowing-sharing/skeleton";
import { BORROW_SUPPORTS } from "../fixtures/borrowing-sharing/supports";
import { createSafeLexicalRecallPlan } from "../fixtures/execution/safe-lexical-recall";
import {
  homeBreakfastFrame,
  picnicLunchFrame,
  restaurantMealFrame,
} from "../fixtures/meal/contexts";
import { MEAL_PROFILES, MEAL_SENSE } from "../fixtures/meal/knowledge";
import {
  createMealBuildPlan,
  createMealRecallStrengthenPlan,
  createMealStrengthenPlan,
} from "../fixtures/meal/plans";
import { mealSkeleton } from "../fixtures/meal/skeleton";
import { MEAL_SUPPORTS } from "../fixtures/meal/supports";
import { SCHOOL_FRAMES } from "../fixtures/school-challenge/contexts";
import { SCHOOL_PROFILES, SCHOOL_SENSE } from "../fixtures/school-challenge/knowledge";
import {
  createSchoolBuildPlan,
  createSchoolGuidedPresentationPlan,
  createSchoolStrengthenPlan,
} from "../fixtures/school-challenge/plans";
import { schoolChallengeSkeleton } from "../fixtures/school-challenge/skeleton";
import { SCHOOL_SUPPORTS } from "../fixtures/school-challenge/supports";
import { profileMap } from "../fixtures/shared";
import type { ExperiencePlanVariant } from "./types";

const TYPING = ["frozen-text-input:TYPE"] as const;
const MEAL_STRENGTHEN_CAPS = [
  "frozen-choice:IDENTIFY",
  "frozen-choice:DISTINGUISH",
  "frozen-text-input:TYPE",
] as const;
const SCHOOL_ASSESSABLE_CAPS = ["frozen-choice:DISTINGUISH"] as const;
const BORROW_ASSESSABLE_CAPS = ["frozen-choice:SELECT"] as const;

const MEAL_SPOON: readonly LexemeSenseRef[] = [MEAL_SENSE.spoon];
const MEAL_PROBE_LEXICAL: readonly LexemeSenseRef[] = [
  MEAL_SENSE.soup,
  MEAL_SENSE.bowl,
  MEAL_SENSE.spoon,
  MEAL_SENSE.fork,
];
const SCHOOL_ABSTRACT: readonly LexemeSenseRef[] = [
  SCHOOL_SENSE.ability,
  SCHOOL_SENSE.possible,
  SCHOOL_SENSE.difficult,
  SCHOOL_SENSE.try,
  SCHOOL_SENSE.success,
];
const BORROW_PERSPECTIVES: readonly LexemeSenseRef[] = [
  BORROW_SENSE.borrow,
  BORROW_SENSE.lend,
];

const MEAL_FRAMES = [picnicLunchFrame, restaurantMealFrame, homeBreakfastFrame];
const BORROW_TRANSFER_FRAMES = [libraryBookFrame, classroomRulerFrame];

function mealVariant(
  kind: "build" | "strengthen" | "strengthen-recall" | "retrieve",
  frame: ContextFrame,
): ExperiencePlanVariant {
  if (kind === "build") {
    return {
      id: `meal-build:${frame.id}`,
      priority: 20,
      mode: "BUILD",
      supportedSenses: MEAL_SPOON,
      requiredSenses: MEAL_SPOON,
      contextFrameId: frame.id,
      skeletonId: mealSkeleton.id,
      requiredCapabilityIds: TYPING,
      containsGuidedSteps: true,
      containsAssessableSteps: true,
      reviewStatus: "REVIEWED",
      createPlan: () => createMealBuildPlan(frame),
    };
  }
  if (kind === "strengthen-recall") {
    return {
      id: `meal-strengthen-recall:${frame.id}`,
      priority: 30,
      mode: "STRENGTHEN",
      supportedSenses: MEAL_PROBE_LEXICAL,
      requiredSenses: [],
      contextFrameId: frame.id,
      skeletonId: mealSkeleton.id,
      requiredCapabilityIds: TYPING,
      containsGuidedSteps: true,
      containsAssessableSteps: true,
      reviewStatus: "REVIEWED",
      createPlan: (request) => createMealRecallStrengthenPlan(frame, request),
    };
  }
  if (kind === "strengthen") {
    return {
      id: `meal-strengthen:${frame.id}`,
      priority: 50,
      mode: "STRENGTHEN",
      supportedSenses: MEAL_SPOON,
      requiredSenses: MEAL_SPOON,
      contextFrameId: frame.id,
      skeletonId: mealSkeleton.id,
      requiredCapabilityIds: MEAL_STRENGTHEN_CAPS,
      containsGuidedSteps: false,
      containsAssessableSteps: true,
      reviewStatus: "REVIEWED",
      createPlan: () => createMealStrengthenPlan(frame),
    };
  }
  return {
    id: `meal-retrieve:${frame.id}`,
    priority: 10,
    mode: "RETRIEVE",
    supportedSenses: MEAL_SPOON,
    requiredSenses: MEAL_SPOON,
    contextFrameId: frame.id,
    skeletonId: mealSkeleton.id,
    requiredCapabilityIds: TYPING,
    containsGuidedSteps: false,
    containsAssessableSteps: true,
    reviewStatus: "REVIEWED",
    createPlan: () => createSafeLexicalRecallPlan(frame),
  };
}

function schoolVariant(
  kind: "build" | "strengthen" | "guided",
  frame: ContextFrame,
): ExperiencePlanVariant {
  if (kind === "guided") {
    return {
      id: `school-guided:${frame.id}`,
      priority: 60,
      mode: "BUILD",
      supportedSenses: SCHOOL_ABSTRACT,
      requiredSenses: [],
      contextFrameId: frame.id,
      skeletonId: schoolChallengeSkeleton.id,
      requiredCapabilityIds: [],
      containsGuidedSteps: true,
      containsAssessableSteps: false,
      reviewStatus: "REVIEWED",
      createPlan: () => createSchoolGuidedPresentationPlan(frame),
    };
  }
  if (kind === "build") {
    return {
      id: `school-build:${frame.id}`,
      priority: 40,
      mode: "BUILD",
      supportedSenses: SCHOOL_ABSTRACT,
      requiredSenses: [],
      contextFrameId: frame.id,
      skeletonId: schoolChallengeSkeleton.id,
      requiredCapabilityIds: SCHOOL_ASSESSABLE_CAPS,
      containsGuidedSteps: false,
      containsAssessableSteps: true,
      reviewStatus: "REVIEWED",
      createPlan: () => createSchoolBuildPlan(frame),
    };
  }
  return {
    id: `school-strengthen:${frame.id}`,
    priority: 50,
    mode: "STRENGTHEN",
    supportedSenses: SCHOOL_ABSTRACT,
    requiredSenses: [],
    contextFrameId: frame.id,
    skeletonId: schoolChallengeSkeleton.id,
    requiredCapabilityIds: SCHOOL_ASSESSABLE_CAPS,
    containsGuidedSteps: false,
    containsAssessableSteps: true,
    reviewStatus: "REVIEWED",
    createPlan: () => createSchoolStrengthenPlan(frame),
  };
}

function borrowVariant(
  kind: "build" | "strengthen" | "guided",
  frame: ContextFrame,
): ExperiencePlanVariant {
  if (kind === "guided") {
    return {
      id: `borrow-guided:${frame.id}`,
      priority: 60,
      mode: "BUILD",
      supportedSenses: BORROW_PERSPECTIVES,
      requiredSenses: BORROW_PERSPECTIVES,
      contextFrameId: frame.id,
      skeletonId: borrowingSharingSkeleton.id,
      requiredCapabilityIds: [],
      containsGuidedSteps: true,
      containsAssessableSteps: false,
      reviewStatus: "REVIEWED",
      createPlan: () => createBorrowGuidedPerspectivePlan(frame),
    };
  }
  if (kind === "build") {
    return {
      id: `borrow-build:${frame.id}`,
      priority: 40,
      mode: "BUILD",
      supportedSenses: BORROW_PERSPECTIVES,
      requiredSenses: BORROW_PERSPECTIVES,
      contextFrameId: frame.id,
      skeletonId: borrowingSharingSkeleton.id,
      requiredCapabilityIds: BORROW_ASSESSABLE_CAPS,
      containsGuidedSteps: false,
      containsAssessableSteps: true,
      reviewStatus: "REVIEWED",
      createPlan: () => createBorrowBuildPlan(frame),
    };
  }
  return {
    id: `borrow-strengthen:${frame.id}`,
    priority: 50,
    mode: "STRENGTHEN",
    supportedSenses: BORROW_PERSPECTIVES,
    requiredSenses: BORROW_PERSPECTIVES,
    contextFrameId: frame.id,
    skeletonId: borrowingSharingSkeleton.id,
    requiredCapabilityIds: BORROW_ASSESSABLE_CAPS,
    containsGuidedSteps: false,
    containsAssessableSteps: true,
    reviewStatus: "REVIEWED",
    createPlan: () => createBorrowStrengthenPlan(frame),
  };
}

/**
 * Picnic/restaurant/library are registered before home/classroom so tests can
 * prove insertion order is not the selection rule.
 */
const PLAN_VARIANTS: readonly ExperiencePlanVariant[] = [
  ...MEAL_FRAMES.flatMap((frame) => [
    mealVariant("retrieve", frame),
    mealVariant("build", frame),
    mealVariant("strengthen-recall", frame),
    mealVariant("strengthen", frame),
  ]),
  ...SCHOOL_FRAMES.flatMap((frame) => [
    schoolVariant("guided", frame),
    schoolVariant("build", frame),
    schoolVariant("strengthen", frame),
  ]),
  ...BORROW_TRANSFER_FRAMES.flatMap((frame) => [
    borrowVariant("guided", frame),
    borrowVariant("build", frame),
    borrowVariant("strengthen", frame),
  ]),
];

const FRAME_BY_ID = Object.fromEntries(
  [
    ...MEAL_FRAMES,
    ...SCHOOL_FRAMES,
    ...BORROW_TRANSFER_FRAMES,
  ].map((frame) => [frame.id, frame]),
);

const SKELETON_BY_ID = Object.fromEntries(
  [mealSkeleton, schoolChallengeSkeleton, borrowingSharingSkeleton].map(
    (skeleton) => [skeleton.id, skeleton],
  ),
);

export const PLANNER_SENSE_PROFILES = profileMap([
  ...MEAL_PROFILES,
  ...SCHOOL_PROFILES,
  ...BORROW_PROFILES,
]);

export const PLANNER_SUPPORT_BLOCKS = new Map(
  [...MEAL_SUPPORTS, ...SCHOOL_SUPPORTS, ...BORROW_SUPPORTS].map((block) => [
    block.id,
    block,
  ]),
);

export function listPlanVariants(): readonly ExperiencePlanVariant[] {
  return PLAN_VARIANTS;
}

export function findPlannerFrame(contextFrameId: string) {
  return FRAME_BY_ID[contextFrameId];
}

export function findPlannerSkeleton(skeletonId: string) {
  return SKELETON_BY_ID[skeletonId];
}

export function registeredPlannerSenses(): readonly LexemeSenseRef[] {
  const seen = new Map<string, LexemeSenseRef>();
  for (const variant of PLAN_VARIANTS) {
    for (const sense of variant.supportedSenses) {
      seen.set(`${sense.lexemeId}::${sense.senseId}`, sense);
    }
  }
  return [...seen.values()];
}

/**
 * Deterministic variant order:
 * 1. authored priority (lower wins)
 * 2. allow-list context index, else stable contextFrameId
 * 3. variant id
 */
export function comparePlanVariants(
  left: ExperiencePlanVariant,
  right: ExperiencePlanVariant,
  allowedContextIds?: readonly string[],
): number {
  if (left.priority !== right.priority) {
    return left.priority - right.priority;
  }
  if (allowedContextIds && allowedContextIds.length > 0) {
    const leftIndex = allowedContextIds.indexOf(left.contextFrameId);
    const rightIndex = allowedContextIds.indexOf(right.contextFrameId);
    const leftRank = leftIndex === -1 ? Number.POSITIVE_INFINITY : leftIndex;
    const rightRank = rightIndex === -1 ? Number.POSITIVE_INFINITY : rightIndex;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
  }
  const byContext = left.contextFrameId.localeCompare(right.contextFrameId);
  if (byContext !== 0) {
    return byContext;
  }
  return left.id.localeCompare(right.id);
}
