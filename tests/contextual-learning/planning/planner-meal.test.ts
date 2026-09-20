import { describe, expect, it } from "vitest";
import { PlanningErrorCode, planExperience } from "@/contextual-learning/candidate-v0/planning";
import {
  CHOICE_IDENTIFY,
  TYPING_CAPABILITY,
  mealInput,
} from "./helpers";

describe("Candidate V0 experience planner — Meal", () => {
  it("selects the safe lexical recall variant for RETRIEVE when typing is present", () => {
    const planned = planExperience(mealInput("RETRIEVE"));
    expect(planned.ok).toBe(true);
    if (!planned.ok) {
      throw new Error(planned.error.message);
    }
    expect(planned.trace.selectedVariantId).toBe("meal-retrieve:home-breakfast-v0");
    expect(planned.trace.executability).toBe("FULLY_EXECUTABLE");
    expect(planned.plan.mode).toBe("RETRIEVE");
    expect(planned.plan.steps).toHaveLength(1);
    expect(planned.plan.steps[0]?.semanticAction).toBe("TYPE");
    expect(planned.plan.sourceLearningNeedRef).toBe("need-opaque-ref");
  });

  it("fails explicitly when lexical typing is absent, even if choice is present", () => {
    const none = planExperience(mealInput("RETRIEVE", []));
    expect(none.ok).toBe(false);
    if (none.ok) {
      throw new Error("empty capabilities must fail");
    }
    expect(none.error.code).toBe(PlanningErrorCode.PLAN_MISSING_RUNTIME_CAPABILITY);

    const choiceOnly = planExperience(mealInput("RETRIEVE", [CHOICE_IDENTIFY]));
    expect(choiceOnly.ok).toBe(false);
    if (choiceOnly.ok) {
      throw new Error("choice must not unlock typing");
    }
    expect(choiceOnly.error.code).toBe(
      PlanningErrorCode.PLAN_MISSING_RUNTIME_CAPABILITY,
    );
  });

  it("reports Meal BUILD as fully executable and PROBE as an explicit gap", () => {
    const build = planExperience(mealInput("BUILD", [TYPING_CAPABILITY]));
    expect(build.ok).toBe(true);
    if (!build.ok) {
      throw new Error(build.error.message);
    }
    expect(build.trace.executability).toBe("FULLY_EXECUTABLE");
    expect(build.plan.mode).toBe("BUILD");
    expect(build.plan.steps.some((step) => step.executionIntent.kind === "GUIDED")).toBe(
      true,
    );
    expect(build.plan.steps.some((step) => step.purpose === "RECALL")).toBe(true);

    const probe = planExperience(mealInput("PROBE"));
    expect(probe.ok).toBe(false);
    if (probe.ok) {
      throw new Error("PROBE must not be invented");
    }
    expect(probe.error.code).toBe(PlanningErrorCode.PLAN_MODE_NOT_AVAILABLE);
  });

  it("selects the Meal recall STRENGTHEN variant and keeps IDENTIFY STRENGTHEN as a gap", () => {
    const strengthen = planExperience(mealInput("STRENGTHEN", [TYPING_CAPABILITY]));
    expect(strengthen.ok).toBe(true);
    if (!strengthen.ok) {
      throw new Error(strengthen.error.message);
    }
    expect(strengthen.trace.selectedVariantId).toBe(
      "meal-strengthen-recall:home-breakfast-v0",
    );
    expect(strengthen.plan.mode).toBe("STRENGTHEN");
    expect(strengthen.plan.id).toContain("strengthen-recall");
    expect(strengthen.plan.steps.map((step) => step.executionIntent.kind)).toEqual([
      "GUIDED",
      "GUIDED",
      "ASSESSABLE",
    ]);
    expect(strengthen.trace.rejectedVariantReasons.some((item) =>
      item.variantId.startsWith("meal-strengthen:"),
    )).toBe(true);

    const identifyOnly = planExperience(mealInput("STRENGTHEN", [CHOICE_IDENTIFY]));
    expect(identifyOnly.ok).toBe(false);
    if (identifyOnly.ok) {
      throw new Error("IDENTIFY-only STRENGTHEN must remain an honest gap");
    }
    expect(identifyOnly.error.code).toBe(PlanningErrorCode.PLAN_NO_COMPATIBLE_VARIANT);
  });

  it("selects Home / Restaurant / Picnic from the same Meal skeleton by allow-list order", () => {
    const picnicFirst = planExperience({
      ...mealInput("BUILD"),
      allowedContextIds: ["picnic-lunch-v0", "home-breakfast-v0", "restaurant-meal-v0"],
    });
    const restaurantOnly = planExperience({
      ...mealInput("BUILD"),
      allowedContextIds: ["restaurant-meal-v0"],
    });
    expect(picnicFirst.ok && restaurantOnly.ok).toBe(true);
    if (!picnicFirst.ok || !restaurantOnly.ok) {
      throw new Error("allow-list Meal BUILD must succeed");
    }
    expect(picnicFirst.plan.contextFrameId).toBe("picnic-lunch-v0");
    expect(restaurantOnly.plan.contextFrameId).toBe("restaurant-meal-v0");
    expect(picnicFirst.plan.skeletonId).toBe("meal-setting-v0");
    expect(restaurantOnly.plan.skeletonId).toBe("meal-setting-v0");
    expect(picnicFirst.trace.selectedVariantId).toBe("meal-build:picnic-lunch-v0");
  });

  it("does not treat SUITABLE_FOR as a universal lexical truth", () => {
    const planned = planExperience({
      ...mealInput("BUILD"),
      targets: [
        {
          id: "target-spoon",
          sense: {
            lexemeId: "lex-spoon",
            senseId: "spoon#eating-utensil",
          },
          focus: "CONTEXT_INTERPRETATION",
          requiredRelationIds: ["UNIVERSAL_SUITABLE_FOR"],
        },
      ],
    });
    expect(planned.ok).toBe(false);
    if (planned.ok) {
      throw new Error("universal suitable_for must not match a frame fact");
    }
    expect(planned.error.code).toBe(
      PlanningErrorCode.PLAN_TARGET_REQUIREMENT_MISMATCH,
    );
    expect(planned.trace.rejectedTargetRequirements[0]?.field).toBe(
      "requiredRelationIds",
    );
    expect(planned.trace.rejectedTargetRequirements[0]?.requested).toEqual([
      "UNIVERSAL_SUITABLE_FOR",
    ]);
    expect(planned.trace.rejectedTargetRequirements[0]?.available).toEqual([
      "SUITABLE_FOR",
    ]);
  });
});
