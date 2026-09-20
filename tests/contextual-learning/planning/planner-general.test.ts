import { describe, expect, it } from "vitest";
import {
  PlanningErrorCode,
  comparePlanVariants,
  listPlanVariants,
  planExperience,
} from "@/contextual-learning/candidate-v0/planning";
import { MEAL_SENSE } from "@/contextual-learning/candidate-v0/fixtures/meal/knowledge";
import {
  CHOICE_IDENTIFY,
  TYPING_CAPABILITY,
  mealInput,
  planningInput,
  spoonTarget,
} from "./helpers";

describe("Candidate V0 experience planner — general", () => {
  it("returns a deeply equal result for the same structured input", () => {
    const input = mealInput("RETRIEVE");
    const first = planExperience(input);
    const second = planExperience(input);
    expect(first).toEqual(second);
    expect(first.ok).toBe(true);
  });

  it("ignores capability array order and duplicates", () => {
    const ordered = mealInput("RETRIEVE", [TYPING_CAPABILITY, CHOICE_IDENTIFY]);
    const reversed = mealInput("RETRIEVE", [CHOICE_IDENTIFY, TYPING_CAPABILITY]);
    const duplicated = mealInput("RETRIEVE", [
      TYPING_CAPABILITY,
      TYPING_CAPABILITY,
      CHOICE_IDENTIFY,
    ]);
    expect(planExperience(ordered)).toEqual(planExperience(reversed));
    expect(planExperience(ordered)).toEqual(planExperience(duplicated));
  });

  it("does not use registry insertion order as the selection rule", () => {
    const variants = [...listPlanVariants()];
    const picnic = variants.find((item) => item.id === "meal-build:picnic-lunch-v0");
    const home = variants.find((item) => item.id === "meal-build:home-breakfast-v0");
    expect(picnic).toBeDefined();
    expect(home).toBeDefined();
    expect(variants.indexOf(picnic!)).toBeLessThan(variants.indexOf(home!));
    expect(comparePlanVariants(home!, picnic!)).toBeLessThan(0);

    const planned = planExperience(mealInput("BUILD"));
    expect(planned.ok).toBe(true);
    if (!planned.ok) {
      throw new Error(planned.error.message);
    }
    expect(planned.trace.selectedVariantId).toBe("meal-build:home-breakfast-v0");
  });

  it("returns an independent plan copy that cannot mutate the registry source", () => {
    const first = planExperience(mealInput("RETRIEVE"));
    expect(first.ok).toBe(true);
    if (!first.ok) {
      throw new Error(first.error.message);
    }
    first.plan.id = "mutated-by-caller";
    first.plan.steps.splice(0, 1);
    const second = planExperience(mealInput("RETRIEVE"));
    expect(second.ok).toBe(true);
    if (!second.ok) {
      throw new Error(second.error.message);
    }
    expect(second.plan.id).not.toBe("mutated-by-caller");
    expect(second.plan.steps.length).toBeGreaterThan(0);
    expect(second.plan).not.toBe(first.plan);
  });

  it("fails closed for empty need ref, empty targets, and unknown senses", () => {
    expect(
      planExperience(planningInput({ mode: "RETRIEVE", targets: [spoonTarget()], learningNeedRef: "" })),
    ).toMatchObject({
      ok: false,
      error: { code: PlanningErrorCode.PLAN_MISSING_LEARNING_NEED_REF },
    });
    expect(
      planExperience(planningInput({ mode: "RETRIEVE", targets: [] })),
    ).toMatchObject({
      ok: false,
      error: { code: PlanningErrorCode.PLAN_NO_TARGETS },
    });
    expect(
      planExperience(
        planningInput({
          mode: "RETRIEVE",
          targets: [
            {
              id: "ghost",
              sense: { lexemeId: "lex-unknown", senseId: "unknown#sense" },
              focus: "MEANING_TO_FORM",
            },
          ],
        }),
      ),
    ).toMatchObject({
      ok: false,
      error: { code: PlanningErrorCode.PLAN_TARGET_NOT_REGISTERED },
    });
  });

  it("never selects a context outside the allow-list", () => {
    const planned = planExperience({
      ...mealInput("BUILD"),
      allowedContextIds: ["picnic-lunch-v0"],
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) {
      throw new Error(planned.error.message);
    }
    expect(planned.plan.contextFrameId).toBe("picnic-lunch-v0");
    expect(planned.plan.skeletonId).toBe("meal-setting-v0");

    const blocked = planExperience({
      ...mealInput("BUILD"),
      allowedContextIds: ["not-a-reviewed-frame"],
    });
    expect(blocked.ok).toBe(false);
    if (blocked.ok) {
      throw new Error("disallowed context must fail");
    }
    expect(blocked.error.code).toBe(PlanningErrorCode.PLAN_NO_ALLOWED_CONTEXT);
    expect(blocked.trace.selectedVariantId).toBeUndefined();
  });

  it("does not infer mode or case from need-ref or fixture-name strings", () => {
    const schoolishNeed = planExperience({
      ...mealInput("RETRIEVE"),
      learningNeedRef: "need-school-try-BUILD-UNSEEN",
    });
    expect(schoolishNeed.ok).toBe(true);
    if (!schoolishNeed.ok) {
      throw new Error(schoolishNeed.error.message);
    }
    expect(schoolishNeed.plan.mode).toBe("RETRIEVE");
    expect(schoolishNeed.plan.contextFrameId.startsWith("home")).toBe(true);
    expect(schoolishNeed.plan.sourceLearningNeedRef).toBe("need-school-try-BUILD-UNSEEN");

    const labelOnly = planExperience(
      planningInput({
        mode: "RETRIEVE",
        targets: [
          {
            id: "label",
            sense: { lexemeId: "spoon", senseId: "spoon" },
            focus: "MEANING_TO_FORM",
          },
        ],
      }),
    );
    expect(labelOnly.ok).toBe(false);
    if (labelOnly.ok) {
      throw new Error("label inference must fail");
    }
    expect(labelOnly.error.code).toBe(PlanningErrorCode.PLAN_TARGET_NOT_REGISTERED);
    expect(MEAL_SENSE.spoon.lexemeId).toBe("lex-spoon");
  });

  it("does not inspect UNSEEN or invent BUILD from learner-state vocabulary", () => {
    const retrieve = planExperience(mealInput("RETRIEVE"));
    expect(retrieve.ok).toBe(true);
    if (!retrieve.ok) {
      throw new Error(retrieve.error.message);
    }
    expect(retrieve.plan.mode).toBe("RETRIEVE");
    expect(retrieve.trace.requestedMode).toBe("RETRIEVE");
    expect(JSON.stringify(retrieve)).not.toMatch(/UNSEEN/);
  });
});
