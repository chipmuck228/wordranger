import { describe, expect, it } from "vitest";
import { mealTestLexemeLoader } from "./content/helpers";
import { MEAL_FRAMES, homeBreakfastFrame } from "@/contextual-learning/candidate-v0/fixtures/meal/contexts";
import { mealSkeleton } from "@/contextual-learning/candidate-v0/fixtures/meal/skeleton";
import { isAssessableExperienceStep } from "@/contextual-learning/candidate-v0/domain/types";
import { createMealBuildPlan } from "@/contextual-learning/candidate-v0/fixtures/meal/plans";
import { serializeFact } from "@/contextual-learning/candidate-v0/domain/predicates";

describe("Candidate V0 meal case", () => {
  it("shares one skeleton across Home / Restaurant / Picnic", () => {
    expect(MEAL_FRAMES).toHaveLength(3);
    expect(MEAL_FRAMES.every((frame) => frame.skeletonId === mealSkeleton.id)).toBe(
      true,
    );
    expect(new Set(MEAL_FRAMES.map((frame) => frame.id)).size).toBe(3);
  });

  it("treats spoon/soup suitability as a contextual fact, not a skeleton axiom", () => {
    const skeletonHasSuitabilityInstance = mealSkeleton.validationRules.some((rule) =>
      rule.predicate.predicate === "suitable_for",
    );
    expect(skeletonHasSuitabilityInstance).toBe(false);
    for (const frame of MEAL_FRAMES) {
      const suitability = frame.initialFacts.filter(
        (item) => item.predicate === "suitable_for",
      );
      expect(suitability.length).toBeGreaterThan(0);
      expect(suitability.every((fact) => fact.arguments.some((arg) => arg.kind === "ENTITY"))).toBe(
        true,
      );
      expect(suitability.map(serializeFact).join(" ")).toMatch(/soup/);
    }
  });

  it("ends the BUILD plan with reduced-support RECALL", () => {
    const plan = createMealBuildPlan(homeBreakfastFrame, { loadLexeme: mealTestLexemeLoader });
    const last = plan.steps[plan.steps.length - 1];
    expect(isAssessableExperienceStep(last)).toBe(true);
    if (!isAssessableExperienceStep(last)) {
      return;
    }
    expect(last.purpose).toBe("RECALL");
    expect(last.promptIntent.mustNotRevealTargetForm).toBe(true);
    expect(last.supportPolicy.ladder.every((level) => level.level === 0)).toBe(true);
    expect(
      last.supportPolicy.ladder.every((level) => level.supportBlockIds.length === 0),
    ).toBe(true);
  });
});
