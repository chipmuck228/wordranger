import { describe, expect, it } from "vitest";
import { classifyExperienceStep } from "@/contextual-learning/candidate-v0/execution";
import { createSafeLexicalRecallPlan } from "@/contextual-learning/candidate-v0/fixtures/execution/safe-lexical-recall";
import { classroomRulerFrame } from "@/contextual-learning/candidate-v0/fixtures/borrowing-sharing/contexts";
import { createBorrowBuildPlan } from "@/contextual-learning/candidate-v0/fixtures/borrowing-sharing/plans";
import { homeBreakfastFrame } from "@/contextual-learning/candidate-v0/fixtures/meal/contexts";
import { MEAL_PROFILES } from "@/contextual-learning/candidate-v0/fixtures/meal/knowledge";
import { createMealBuildPlan } from "@/contextual-learning/candidate-v0/fixtures/meal/plans";
import { mealSkeleton } from "@/contextual-learning/candidate-v0/fixtures/meal/skeleton";
import { scienceTowerFrame } from "@/contextual-learning/candidate-v0/fixtures/school-challenge/contexts";
import { createSchoolBuildPlan } from "@/contextual-learning/candidate-v0/fixtures/school-challenge/plans";
import { profileMap } from "@/contextual-learning/candidate-v0/fixtures/shared";
import { resolvedSnapshotFor } from "../helpers";

describe("Candidate V0 step execution classification", () => {
  it("classifies safe lexical recall as ASSESSABLE_FROZEN_TASK", () => {
    const plan = createSafeLexicalRecallPlan(homeBreakfastFrame);
    const resolved = resolvedSnapshotFor(
      plan,
      homeBreakfastFrame,
      mealSkeleton,
      profileMap(MEAL_PROFILES),
    );
    const classification = classifyExperienceStep({
      step: plan.steps[0]!,
      resolvedTargets: resolved.resolvedTargets,
    });
    expect(classification).toEqual({
      kind: "ASSESSABLE_FROZEN_TASK",
      semanticProjectionId: "lexical-form-type-recall-to-active-recall",
    });
  });

  it("classifies explicit meal presentation as GUIDED_ACTIVITY", () => {
    const plan = createMealBuildPlan(homeBreakfastFrame);
    const classification = classifyExperienceStep({
      step: plan.steps[0]!,
      resolvedTargets: [],
    });
    expect(classification.kind).toBe("GUIDED_ACTIVITY");
    if (classification.kind !== "GUIDED_ACTIVITY") {
      return;
    }
    expect(classification.guidedActivityKind).toBe("PRESENT_CONTEXT");
  });

  it("classifies assessable CLAIM_CHOICE as UNSUPPORTED", () => {
    const plan = createSchoolBuildPlan(scienceTowerFrame);
    const classification = classifyExperienceStep({
      step: plan.steps[0]!,
      resolvedTargets: [],
    });
    expect(classification.kind).toBe("UNSUPPORTED");
  });

  it("classifies assessable RELATION_CHOICE as UNSUPPORTED", () => {
    const plan = createBorrowBuildPlan(classroomRulerFrame);
    const classification = classifyExperienceStep({
      step: plan.steps[0]!,
      resolvedTargets: [],
    });
    expect(classification.kind).toBe("UNSUPPORTED");
  });
});
