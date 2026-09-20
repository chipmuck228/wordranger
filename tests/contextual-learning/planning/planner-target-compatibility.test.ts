import { describe, expect, it } from "vitest";
import {
  PlanningErrorCode,
  idsCovered,
  matchRequestedTargetsToPlan,
  planExperience,
} from "@/contextual-learning/candidate-v0/planning";
import { MEAL_SENSE } from "@/contextual-learning/candidate-v0/fixtures/meal/knowledge";
import type { ExperienceTarget } from "@/contextual-learning/candidate-v0/domain/types";
import { mealInput } from "./helpers";

function spoonTarget(partial: Partial<ExperienceTarget>): ExperienceTarget {
  return {
    id: "caller-spoon",
    sense: MEAL_SENSE.spoon,
    focus: "MEANING_TO_FORM",
    ...partial,
  };
}

describe("Candidate V0 planner target compatibility", () => {
  it("rejects the same sense with a different focus", () => {
    const planned = planExperience({
      ...mealInput("RETRIEVE"),
      targets: [spoonTarget({ focus: "CONTEXT_INTERPRETATION" })],
    });
    expect(planned.ok).toBe(false);
    if (planned.ok) {
      throw new Error("focus mismatch must fail");
    }
    expect(planned.error.code).toBe(
      PlanningErrorCode.PLAN_TARGET_REQUIREMENT_MISMATCH,
    );
    expect(planned.trace.rejectedTargetRequirements[0]).toMatchObject({
      field: "focus",
      requested: "CONTEXT_INTERPRETATION",
      path: "targets[0].focus",
      lexemeId: MEAL_SENSE.spoon.lexemeId,
      senseId: MEAL_SENSE.spoon.senseId,
    });
  });

  it("rejects a required role the plan target does not cover", () => {
    const planned = planExperience({
      ...mealInput("BUILD"),
      targets: [
        spoonTarget({
          focus: "CONTEXT_INTERPRETATION",
          requiredRoleIds: ["NOT_A_MEAL_ROLE"],
        }),
      ],
    });
    expect(planned.ok).toBe(false);
    if (planned.ok) {
      throw new Error("missing role must fail");
    }
    expect(planned.error.code).toBe(
      PlanningErrorCode.PLAN_TARGET_REQUIREMENT_MISMATCH,
    );
    expect(planned.trace.rejectedTargetRequirements[0]).toMatchObject({
      field: "requiredRoleIds",
      requested: ["NOT_A_MEAL_ROLE"],
      available: ["EATING_TOOL"],
      path: "targets[0].requiredRoleIds",
    });
  });

  it("rejects a required relation the plan target does not cover", () => {
    const planned = planExperience({
      ...mealInput("BUILD"),
      targets: [
        spoonTarget({
          focus: "CONTEXT_INTERPRETATION",
          requiredRelationIds: ["ALWAYS_TRUE"],
        }),
      ],
    });
    expect(planned.ok).toBe(false);
    if (planned.ok) {
      throw new Error("missing relation must fail");
    }
    expect(planned.error.code).toBe(
      PlanningErrorCode.PLAN_TARGET_REQUIREMENT_MISMATCH,
    );
    expect(planned.trace.rejectedTargetRequirements[0]).toMatchObject({
      field: "requiredRelationIds",
      requested: ["ALWAYS_TRUE"],
      available: ["SUITABLE_FOR"],
    });
  });

  it("treats role and relation order as irrelevant set coverage", () => {
    expect(idsCovered(["B", "A"], ["A", "B"])).toBe(true);
    expect(
      matchRequestedTargetsToPlan({
        variantId: "order-check",
        requested: [
          {
            id: "in",
            sense: MEAL_SENSE.spoon,
            focus: "CONTEXT_INTERPRETATION",
            requiredRoleIds: ["EATING_TOOL", "EXTRA_ON_PLAN"],
            requiredRelationIds: ["SUITABLE_FOR", "SECOND_REL"],
          },
        ],
        planTargets: [
          {
            id: "plan",
            sense: MEAL_SENSE.spoon,
            focus: "CONTEXT_INTERPRETATION",
            requiredRoleIds: ["EXTRA_ON_PLAN", "EATING_TOOL"],
            requiredRelationIds: ["SECOND_REL", "SUITABLE_FOR"],
          },
        ],
      }).ok,
    ).toBe(true);

    const forward = planExperience({
      ...mealInput("BUILD"),
      targets: [
        spoonTarget({
          focus: "CONTEXT_INTERPRETATION",
          requiredRoleIds: ["EATING_TOOL"],
          requiredRelationIds: ["SUITABLE_FOR"],
        }),
      ],
    });
    const reversed = planExperience({
      ...mealInput("BUILD"),
      targets: [
        spoonTarget({
          focus: "CONTEXT_INTERPRETATION",
          requiredRelationIds: ["SUITABLE_FOR"],
          requiredRoleIds: ["EATING_TOOL"],
        }),
      ],
    });
    expect(forward.ok && reversed.ok).toBe(true);
    if (!forward.ok || !reversed.ok) {
      throw new Error("order must not change coverage");
    }
    expect(forward.trace.selectedVariantId).toBe(reversed.trace.selectedVariantId);
  });

  it("succeeds when a plan target covers every requested requirement", () => {
    const planned = planExperience({
      ...mealInput("BUILD"),
      targets: [
        spoonTarget({
          focus: "CONTEXT_INTERPRETATION",
          requiredRoleIds: ["EATING_TOOL"],
          requiredRelationIds: ["SUITABLE_FOR"],
        }),
      ],
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) {
      throw new Error(planned.error.message);
    }
    expect(planned.plan.targets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "target-spoon",
          focus: "CONTEXT_INTERPRETATION",
          requiredRoleIds: ["EATING_TOOL"],
          requiredRelationIds: ["SUITABLE_FOR"],
        }),
      ]),
    );
    expect(planned.plan.targets.some((target) => target.id === "caller-spoon")).toBe(
      false,
    );
  });

  it("does not mutate the caller target object or copy it onto the plan", () => {
    const target = spoonTarget({
      focus: "CONTEXT_INTERPRETATION",
      requiredRoleIds: ["EATING_TOOL"],
      requiredRelationIds: ["SUITABLE_FOR"],
    });
    const before = structuredClone(target);
    Object.freeze(target);
    Object.freeze(target.sense);
    Object.freeze(target.requiredRoleIds);
    Object.freeze(target.requiredRelationIds);
    const planned = planExperience({
      ...mealInput("BUILD"),
      targets: [target],
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) {
      throw new Error(planned.error.message);
    }
    expect(target).toEqual(before);
    expect(planned.plan.targets[0]).not.toBe(target);
    expect(JSON.stringify(planned.plan)).not.toContain("caller-spoon");
  });
});
