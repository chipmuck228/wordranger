import { describe, expect, it } from "vitest";
import { mealTestLexemeLoader } from "./content/helpers";
import { listFrozenRuntimeCapabilities } from "@/contextual-learning/candidate-v0/capabilities/capability-registry";
import { MEAL_FRAMES } from "@/contextual-learning/candidate-v0/fixtures/meal/contexts";
import { MEAL_PROFILES } from "@/contextual-learning/candidate-v0/fixtures/meal/knowledge";
import {
  createMealBuildPlan,
  createMealStrengthenPlan,
} from "@/contextual-learning/candidate-v0/fixtures/meal/plans";
import { mealSkeleton } from "@/contextual-learning/candidate-v0/fixtures/meal/skeleton";
import { MEAL_SUPPORTS } from "@/contextual-learning/candidate-v0/fixtures/meal/supports";
import { SCHOOL_FRAMES } from "@/contextual-learning/candidate-v0/fixtures/school-challenge/contexts";
import { SCHOOL_PROFILES } from "@/contextual-learning/candidate-v0/fixtures/school-challenge/knowledge";
import {
  createSchoolBuildPlan,
  createSchoolStrengthenPlan,
} from "@/contextual-learning/candidate-v0/fixtures/school-challenge/plans";
import { schoolChallengeSkeleton } from "@/contextual-learning/candidate-v0/fixtures/school-challenge/skeleton";
import { SCHOOL_SUPPORTS } from "@/contextual-learning/candidate-v0/fixtures/school-challenge/supports";
import { BORROW_FRAMES } from "@/contextual-learning/candidate-v0/fixtures/borrowing-sharing/contexts";
import { BORROW_PROFILES } from "@/contextual-learning/candidate-v0/fixtures/borrowing-sharing/knowledge";
import {
  createBorrowBuildPlan,
  createBorrowStrengthenPlan,
} from "@/contextual-learning/candidate-v0/fixtures/borrowing-sharing/plans";
import { borrowingSharingSkeleton } from "@/contextual-learning/candidate-v0/fixtures/borrowing-sharing/skeleton";
import { BORROW_SUPPORTS } from "@/contextual-learning/candidate-v0/fixtures/borrowing-sharing/supports";
import { profileMap, supportMap } from "@/contextual-learning/candidate-v0/fixtures/shared";
import { validateContextFrame } from "@/contextual-learning/candidate-v0/validation/validate-context-frame";
import { validateExperiencePlan } from "@/contextual-learning/candidate-v0/validation/validate-experience-plan";
import { validateSemanticSkeleton } from "@/contextual-learning/candidate-v0/validation/validate-semantic-skeleton";

const capabilities = listFrozenRuntimeCapabilities();

describe("Candidate V0 cross-context reuse", () => {
  it("reuses one meal skeleton across three frames and both plans", () => {
    expect(validateSemanticSkeleton(mealSkeleton).ok).toBe(true);
    expect(new Set(MEAL_FRAMES.map((frame) => frame.skeletonId))).toEqual(
      new Set([mealSkeleton.id]),
    );
    for (const frame of MEAL_FRAMES) {
      expect(validateContextFrame({ frame, skeleton: mealSkeleton }).ok).toBe(true);
      const build = validateExperiencePlan({
        plan: createMealBuildPlan(frame, { loadLexeme: mealTestLexemeLoader }),
        frame,
        skeleton: mealSkeleton,
        capabilities,
        supportBlocks: supportMap(MEAL_SUPPORTS),
        senseProfiles: profileMap(MEAL_PROFILES),
      });
      const strengthen = validateExperiencePlan({
        plan: createMealStrengthenPlan(frame),
        frame,
        skeleton: mealSkeleton,
        capabilities,
        supportBlocks: supportMap(MEAL_SUPPORTS),
        senseProfiles: profileMap(MEAL_PROFILES),
      });
      expect(build.ok, build.issues.map((issue) => issue.message).join("; ")).toBe(true);
      expect(strengthen.ok, strengthen.issues.map((issue) => issue.message).join("; ")).toBe(
        true,
      );
    }
  });

  it("reuses one school-challenge skeleton across three frames", () => {
    expect(validateSemanticSkeleton(schoolChallengeSkeleton).ok).toBe(true);
    expect(new Set(SCHOOL_FRAMES.map((frame) => frame.skeletonId))).toEqual(
      new Set([schoolChallengeSkeleton.id]),
    );
    for (const frame of SCHOOL_FRAMES) {
      expect(
        validateContextFrame({ frame, skeleton: schoolChallengeSkeleton }).ok,
      ).toBe(true);
      expect(
        validateExperiencePlan({
          plan: createSchoolBuildPlan(frame),
          frame,
          skeleton: schoolChallengeSkeleton,
          capabilities,
          supportBlocks: supportMap(SCHOOL_SUPPORTS),
          senseProfiles: profileMap(SCHOOL_PROFILES),
        }).ok,
      ).toBe(true);
      expect(
        validateExperiencePlan({
          plan: createSchoolStrengthenPlan(frame),
          frame,
          skeleton: schoolChallengeSkeleton,
          capabilities,
          supportBlocks: supportMap(SCHOOL_SUPPORTS),
          senseProfiles: profileMap(SCHOOL_PROFILES),
        }).ok,
      ).toBe(true);
    }
  });

  it("reuses one borrowing-sharing skeleton across three frames", () => {
    expect(validateSemanticSkeleton(borrowingSharingSkeleton).ok).toBe(true);
    expect(new Set(BORROW_FRAMES.map((frame) => frame.skeletonId))).toEqual(
      new Set([borrowingSharingSkeleton.id]),
    );
    for (const frame of BORROW_FRAMES) {
      const result = validateContextFrame({
        frame,
        skeleton: borrowingSharingSkeleton,
      });
      expect(result.ok, result.issues.map((issue) => issue.message).join("; ")).toBe(true);
      expect(
        validateExperiencePlan({
          plan: createBorrowBuildPlan(frame),
          frame,
          skeleton: borrowingSharingSkeleton,
          capabilities,
          supportBlocks: supportMap(BORROW_SUPPORTS),
          senseProfiles: profileMap(BORROW_PROFILES),
        }).ok,
      ).toBe(true);
      expect(
        validateExperiencePlan({
          plan: createBorrowStrengthenPlan(frame),
          frame,
          skeleton: borrowingSharingSkeleton,
          capabilities,
          supportBlocks: supportMap(BORROW_SUPPORTS),
          senseProfiles: profileMap(BORROW_PROFILES),
        }).ok,
      ).toBe(true);
    }
  });
});
