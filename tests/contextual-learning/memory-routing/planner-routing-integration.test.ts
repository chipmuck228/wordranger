import { describe, expect, it } from "vitest";
import { planExperience, PlanningErrorCode } from "@/contextual-learning/candidate-v0/planning";
import { planningModeFromRoutingDecision } from "@/contextual-learning/candidate-v0/memory-routing/planning-mode";
import { routeContextualMemory } from "@/contextual-learning/candidate-v0/memory-routing/route-contextual-memory";
import { BUNDLED_SPOON_LEXEME_ID } from "@/contextual-learning/candidate-v0/memory-routing/bundled-lexeme-bindings";
import { MEAL_SENSE } from "@/contextual-learning/candidate-v0/fixtures/meal/knowledge";
import { mealInput } from "../planning/helpers";
import type { ContextualMemoryRoutingDecision } from "@/contextual-learning/candidate-v0/memory-routing/types";

const mappedSpoon = {
  lexemeId: BUNDLED_SPOON_LEXEME_ID,
  senseId: MEAL_SENSE.spoon.senseId,
};

function authoredBuildDecision(): ContextualMemoryRoutingDecision {
  return {
    status: "RESOLVED",
    intent: "BUILD",
    target: mappedSpoon,
    reason: "AUTHORED_CANDIDATE_BUILD_FIXTURE",
    provenance: {
      source: "FROZEN_LEARNING_NEED",
      supportingReasons: [],
      ruleId: "AUTHORED_BUILD_FIXTURE_NOT_FROM_NEW_WORD",
    },
  };
}

describe("planner memory-routing integration", () => {
  it("keeps the existing Meal happy path when no routing decision is supplied", () => {
    const planned = planExperience(mealInput("BUILD"));
    expect(planned.ok).toBe(true);
  });

  it("uses an authored RESOLVED BUILD decision without rereading a snapshot", () => {
    const decision = authoredBuildDecision();
    const mode = planningModeFromRoutingDecision(decision);
    expect(mode.ok).toBe(true);
    if (!mode.ok) {
      return;
    }
    const planned = planExperience({
      ...mealInput(mode.mode),
      memoryRoutingDecision: decision,
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) {
      return;
    }
    expect(planned.plan.mode).toBe("BUILD");
    expect(JSON.stringify(planned)).not.toContain("StudentLexemeModel");
  });

  it("fails closed on UNRESOLVED and never defaults to BUILD", () => {
    const unresolved = routeContextualMemory({
      target: mappedSpoon,
      learningNeed: { lexemeId: BUNDLED_SPOON_LEXEME_ID, reason: "NEW_WORD" },
    });
    expect(unresolved.status).toBe("UNRESOLVED");
    expect(planningModeFromRoutingDecision(unresolved).ok).toBe(false);

    const planned = planExperience({
      ...mealInput("BUILD"),
      memoryRoutingDecision: unresolved,
    });
    expect(planned.ok).toBe(false);
    if (planned.ok) {
      return;
    }
    expect(planned.error.code).toBe(PlanningErrorCode.PLAN_MEMORY_ROUTING_UNRESOLVED);
  });

  it("rejects a RESOLVED decision whose intent does not match the supplied mode", () => {
    const strengthen = routeContextualMemory({
      target: mappedSpoon,
      learningNeed: { lexemeId: BUNDLED_SPOON_LEXEME_ID, reason: "REVIEW_DUE" },
    });
    expect(strengthen.status).toBe("RESOLVED");
    const planned = planExperience({
      ...mealInput("BUILD"),
      memoryRoutingDecision: strengthen,
    });
    expect(planned.ok).toBe(false);
    if (planned.ok) {
      return;
    }
    expect(planned.error.code).toBe(
      PlanningErrorCode.PLAN_MEMORY_ROUTING_INTENT_MISMATCH,
    );
  });
});
