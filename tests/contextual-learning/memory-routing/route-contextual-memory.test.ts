import { describe, expect, it } from "vitest";
import { WeaknessType } from "@/domain/learning/weakness.types";
import type { LearningNeedReason } from "@/domain/learning/learning-need";
import { routeContextualMemory } from "@/contextual-learning/candidate-v0/memory-routing/route-contextual-memory";
import type {
  ContextualMemoryRoutingInput,
  FrozenLearningNeedSignal,
} from "@/contextual-learning/candidate-v0/memory-routing/types";
import { BUNDLED_SPOON_LEXEME_ID } from "@/contextual-learning/candidate-v0/memory-routing/bundled-lexeme-bindings";
import { MEAL_SENSE } from "@/contextual-learning/candidate-v0/fixtures/meal/knowledge";

const SPOON_TARGET = {
  lexemeId: BUNDLED_SPOON_LEXEME_ID,
  senseId: MEAL_SENSE.spoon.senseId,
};

function need(
  reason: LearningNeedReason | "NOT_A_REAL_REASON",
  extras: Partial<FrozenLearningNeedSignal> = {},
): FrozenLearningNeedSignal {
  return {
    lexemeId: BUNDLED_SPOON_LEXEME_ID,
    reason: reason as LearningNeedReason,
    ...extras,
  };
}

function input(
  reason: LearningNeedReason | "NOT_A_REAL_REASON",
  extras: Partial<FrozenLearningNeedSignal> = {},
): ContextualMemoryRoutingInput {
  return {
    target: { ...SPOON_TARGET },
    learningNeed: need(reason, extras),
  };
}

describe("routeContextualMemory", () => {
  it("never resolves BUILD from any frozen LearningNeed reason", () => {
    const reasons: LearningNeedReason[] = [
      "NEW_WORD",
      "WEAKNESS",
      "REVIEW_DUE",
      "STAGE_PROGRESS",
      "FADING",
      "USER_MARKED",
    ];
    for (const reason of reasons) {
      const decision = routeContextualMemory(input(reason));
      if (decision.status === "RESOLVED") {
        expect(decision.intent, reason).toBe("STRENGTHEN");
      }
    }
  });

  it("does not treat NEW_WORD / first-learn as BUILD", () => {
    const decision = routeContextualMemory(input("NEW_WORD"));
    expect(decision).toMatchObject({
      status: "UNRESOLVED",
      reason: "MEMORY_ROUTING_INSUFFICIENT_FROZEN_SIGNAL",
      provenance: { ruleId: "INSUFFICIENT_FROZEN_SIGNAL_FOR_BUILD" },
    });
  });

  it("routes REVIEW_DUE to STRENGTHEN", () => {
    const decision = routeContextualMemory(input("REVIEW_DUE"));
    expect(decision).toMatchObject({
      status: "RESOLVED",
      intent: "STRENGTHEN",
      reason: "FROZEN_REVIEW_DUE",
      provenance: { needReason: "REVIEW_DUE", source: "FROZEN_LEARNING_NEED" },
    });
  });

  it("routes recall weakness to STRENGTHEN", () => {
    const decision = routeContextualMemory(
      input("WEAKNESS", {
        weaknessFocus: {
          weaknessId: "w-recall",
          type: WeaknessType.ACTIVE_RECALL,
        },
      }),
    );
    expect(decision).toMatchObject({
      status: "RESOLVED",
      intent: "STRENGTHEN",
      reason: "FROZEN_WEAKNESS_ACTIVE_RECALL",
    });
  });

  it("routes spelling weakness to STRENGTHEN", () => {
    const decision = routeContextualMemory(
      input("WEAKNESS", {
        weaknessFocus: { weaknessId: "w-spell", type: WeaknessType.SPELLING },
      }),
    );
    expect(decision).toMatchObject({
      status: "RESOLVED",
      intent: "STRENGTHEN",
      reason: "FROZEN_WEAKNESS_SPELLING",
    });
  });

  it("routes confusion to STRENGTHEN", () => {
    const decision = routeContextualMemory(
      input("WEAKNESS", {
        weaknessFocus: { weaknessId: "w-conf", type: WeaknessType.CONFUSION },
      }),
    );
    expect(decision).toMatchObject({
      status: "RESOLVED",
      intent: "STRENGTHEN",
      reason: "FROZEN_WEAKNESS_CONFUSION",
    });
  });

  it("routes hint dependency to STRENGTHEN", () => {
    const decision = routeContextualMemory(
      input("WEAKNESS", {
        weaknessFocus: {
          weaknessId: "w-hint",
          type: WeaknessType.HINT_DEPENDENCY,
        },
      }),
    );
    expect(decision).toMatchObject({
      status: "RESOLVED",
      intent: "STRENGTHEN",
      reason: "FROZEN_WEAKNESS_HINT_DEPENDENCY",
    });
  });

  it("returns UNRESOLVED for an unknown need reason", () => {
    const decision = routeContextualMemory(input("NOT_A_REAL_REASON"));
    expect(decision.status).toBe("UNRESOLVED");
    if (decision.status !== "UNRESOLVED") {
      return;
    }
    expect(decision.reason).toBe("MEMORY_ROUTING_UNKNOWN_NEED_REASON");
  });

  it("returns UNRESOLVED when weakness has no focus", () => {
    const decision = routeContextualMemory(input("WEAKNESS"));
    expect(decision).toMatchObject({
      status: "UNRESOLVED",
      reason: "MEMORY_ROUTING_INSUFFICIENT_FROZEN_SIGNAL",
    });
  });

  it("returns UNRESOLVED for STAGE_PROGRESS, FADING, and USER_MARKED", () => {
    for (const reason of ["STAGE_PROGRESS", "FADING", "USER_MARKED"] as const) {
      const decision = routeContextualMemory(input(reason));
      expect(decision, reason).toMatchObject({
        status: "UNRESOLVED",
        reason: "MEMORY_ROUTING_INSUFFICIENT_FROZEN_SIGNAL",
      });
    }
  });

  it("returns UNRESOLVED when NEW_WORD conflicts with a strengthen signal", () => {
    const decision = routeContextualMemory(
      input("NEW_WORD", { supportingReasons: ["REVIEW_DUE"] }),
    );
    expect(decision).toMatchObject({
      status: "UNRESOLVED",
      reason: "MEMORY_ROUTING_CONFLICTING_SIGNALS",
    });
  });

  it("returns UNRESOLVED when need lexemeId disagrees with the target", () => {
    const decision = routeContextualMemory({
      target: SPOON_TARGET,
      learningNeed: need("REVIEW_DUE", { lexemeId: "other-lexeme" }),
    });
    expect(decision).toMatchObject({
      status: "UNRESOLVED",
      reason: "MEMORY_ROUTING_CONFLICTING_SIGNALS",
    });
  });

  it("returns UNRESOLVED when sense identity is missing", () => {
    const decision = routeContextualMemory({
      target: { lexemeId: BUNDLED_SPOON_LEXEME_ID, senseId: "" },
      learningNeed: need("REVIEW_DUE"),
    });
    expect(decision).toMatchObject({
      status: "UNRESOLVED",
      reason: "MEMORY_ROUTING_UNMAPPED_SENSE",
    });
  });

  it("does not mutate the input objects", () => {
    const routingInput = input("REVIEW_DUE", { supportingReasons: ["FADING"] });
    const before = structuredClone(routingInput);
    routeContextualMemory(routingInput);
    expect(routingInput).toEqual(before);
  });

  it("does not emit a task, Evidence, or learner-state write", () => {
    const decision = routeContextualMemory(
      input("WEAKNESS", {
        weaknessFocus: {
          weaknessId: "w-recall",
          type: WeaknessType.ACTIVE_RECALL,
        },
      }),
    );
    expect(decision).not.toHaveProperty("publicLearningTask");
    expect(decision).not.toHaveProperty("learningEvidence");
    expect(decision).not.toHaveProperty("studentLexemeModel");
    expect(decision).not.toHaveProperty("masteryScore");
    expect(JSON.stringify(decision)).not.toMatch(
      /processEvidence|submitTaskAction|evidence-factory/,
    );
  });
});
