import { describe, expect, it } from "vitest";
import {
  homeBreakfastFrame,
  restaurantMealFrame,
} from "@/contextual-learning/candidate-v0/fixtures/meal/contexts";
import { MEAL_SENSE } from "@/contextual-learning/candidate-v0/fixtures/meal/knowledge";
import {
  createMealActiveRecallStrengthenPlan,
  createMealRecallStrengthenPlan,
} from "@/contextual-learning/candidate-v0/fixtures/meal/plans";
import { identityForFixtureSense } from "@/contextual-learning/candidate-v0/strengthen/meal-lexical-profiles";
import { isGuidedExperienceStep } from "@/contextual-learning/candidate-v0/domain/types";
import { planExperience } from "@/contextual-learning/candidate-v0/planning";
import { mealTestLexemeLoader } from "../content/helpers";
import { mealInput, TYPING_CAPABILITY } from "../planning/helpers";

const SENSES = [MEAL_SENSE.soup, MEAL_SENSE.bowl, MEAL_SENSE.spoon, MEAL_SENSE.fork] as const;

describe("Meal active-recall STRENGTHEN plan factory", () => {
  it.each(SENSES)("creates a three-step plan for %s", (sense) => {
    const identity = identityForFixtureSense(sense);
    expect(identity).not.toBeNull();
    const plan = createMealActiveRecallStrengthenPlan({
      frame: homeBreakfastFrame,
      profile: identity!,
      loadLexeme: mealTestLexemeLoader,
    });
    expect(plan.mode).toBe("STRENGTHEN");
    expect(plan.targets[0]?.sense).toEqual(sense);
    expect(plan.steps).toHaveLength(3);
    expect(plan.steps.map((step) => step.executionIntent.kind)).toEqual([
      "GUIDED",
      "GUIDED",
      "ASSESSABLE",
    ]);
    expect(plan.id).toContain(identity!.stepToken);
    const [reconnect, fade] = plan.steps;
    expect(isGuidedExperienceStep(reconnect!)).toBe(true);
    expect(isGuidedExperienceStep(fade!)).toBe(true);
    if (isGuidedExperienceStep(reconnect!) && isGuidedExperienceStep(fade!)) {
      expect(reconnect.supportExposure?.target).toEqual(identity!.target);
      expect(fade.supportExposure?.target).toEqual(identity!.target);
      expect(reconnect.supportExposure?.kinds).toEqual(["LEXICAL_FORM", "MEANING_GLOSS"]);
      expect(fade.supportExposure?.kinds).toEqual(["SPELLING_CUE"]);
      expect(reconnect.id).toContain(identity!.stepToken);
    }
    expect(JSON.stringify(plan.steps.map((step) => step.id)).includes("spoon") && identity!.stepToken !== "spoon").toBe(false);
  });

  it("builds a restaurant STRENGTHEN plan from the authored restaurant frame", () => {
    const identity = identityForFixtureSense(MEAL_SENSE.soup);
    expect(identity).not.toBeNull();
    const plan = createMealActiveRecallStrengthenPlan({
      frame: restaurantMealFrame,
      profile: identity!,
      loadLexeme: mealTestLexemeLoader,
    });
    expect(plan.mode).toBe("STRENGTHEN");
    expect(plan.steps).toHaveLength(3);
    expect(plan.contextFrameId).toBe(restaurantMealFrame.id);
    expect(JSON.stringify(plan)).toContain("rest-soup");
    expect(JSON.stringify(plan)).not.toContain("home-soup");
    expect(JSON.stringify(plan)).not.toContain("home-fact-");
  });

  it("fails closed when restaurant initialFacts are missing or reversed", () => {
    const identity = identityForFixtureSense(MEAL_SENSE.soup);
    expect(identity).not.toBeNull();
    const missing = createMealActiveRecallStrengthenPlan({
      frame: { ...restaurantMealFrame, initialFacts: [] },
      profile: identity!,
      loadLexeme: mealTestLexemeLoader,
    });
    const reversed = createMealActiveRecallStrengthenPlan({
      frame: {
        ...restaurantMealFrame,
        initialFacts: restaurantMealFrame.initialFacts.map((item) =>
          item.id === "rest-fact-contains-bowl-soup"
            ? { ...item, arguments: [...item.arguments].reverse() }
            : item,
        ),
      },
      profile: identity!,
      loadLexeme: mealTestLexemeLoader,
    });
    expect(missing.steps).toEqual([]);
    expect(reversed.steps).toEqual([]);
  });

  it("fails closed when the requested target is missing", () => {
    const plan = createMealRecallStrengthenPlan(homeBreakfastFrame, {
      loadLexeme: mealTestLexemeLoader,
      targets: [
        {
          id: "target-unknown",
          sense: { lexemeId: "lex-unknown", senseId: "unknown" },
          focus: "MEANING_TO_FORM",
        },
      ],
    });
    expect(plan.targets).toEqual([]);
    expect(plan.steps).toEqual([]);
  });

  it("lets the planner choose the requested target variant", () => {
    for (const sense of SENSES) {
      const planned = planExperience({
        ...mealInput("STRENGTHEN", [TYPING_CAPABILITY]),
        targets: [{ id: `target-${sense.lexemeId}`, sense, focus: "MEANING_TO_FORM" }],
      });
      expect(planned.ok).toBe(true);
      if (!planned.ok) {
        throw new Error(planned.error.message);
      }
      expect(planned.plan.targets[0]?.sense).toEqual(sense);
      expect(planned.trace.selectedVariantId).toBe(
        "meal-strengthen-recall:home-breakfast-v0",
      );
    }
  });
});
