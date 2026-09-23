import { describe, expect, it } from "vitest";
import { mealLexicalQueueCatalog } from "@/contextual-learning/candidate-v0/build/meal-lexical-build-profiles";
import { createMealBuildQueueState } from "@/contextual-learning/candidate-v0/build/queue";
import { createMealStrengthenQueueState } from "@/contextual-learning/candidate-v0/strengthen/queue";
import type { ExperienceRun } from "@/contextual-learning/candidate-v0/execution/types";
import type { MealProbeOrchestration } from "@/server/context-lab/meal-probe-orchestration";
import { validateActiveExperienceQueue } from "@/server/context-lab/validate-active-experience-queue";

const PLAN_ID = "meal-build-home-breakfast-soup";

function runFor(planId: string): Pick<ExperienceRun, "planSnapshot"> {
  return { planSnapshot: { plan: { id: planId } } } as Pick<
    ExperienceRun,
    "planSnapshot"
  >;
}

function queueItems() {
  const catalog = mealLexicalQueueCatalog();
  if (!catalog.ok) {
    throw new Error(catalog.reason);
  }
  return catalog.catalog.map((item, index) => ({
    target: item.target,
    entityId: item.entityId,
    sourceProbeTaskIds: [`${item.entityId}-recall`, `${item.entityId}-rec-${index}`],
  }));
}

function probe(overrides: Partial<MealProbeOrchestration>): MealProbeOrchestration {
  return {
    phase: "PROBE_INTRO",
    targets: [],
    currentTargetIndex: 0,
    currentSkill: null,
    issued: null,
    observations: [],
    experienceMode: null,
    supportExposures: [],
    buildQueue: null,
    strengthenQueue: null,
    ...overrides,
  };
}

describe("validateActiveExperienceQueue", () => {
  it("accepts BUILD_HANDOFF only when currentPlanId matches the run", () => {
    const items = queueItems().slice(0, 2);
    const queue = createMealBuildQueueState(items)!;
    const aligned = {
      ...queue,
      currentPlanId: PLAN_ID,
    };
    expect(
      validateActiveExperienceQueue({
        probe: probe({
          phase: "BUILD_HANDOFF",
          experienceMode: "BUILD",
          buildQueue: aligned,
        }),
        experienceRun: runFor(PLAN_ID),
      }).ok,
    ).toBe(true);
    expect(
      validateActiveExperienceQueue({
        probe: probe({
          phase: "BUILD_HANDOFF",
          experienceMode: "BUILD",
          buildQueue: { ...aligned, currentPlanId: "other-plan" },
        }),
        experienceRun: runFor(PLAN_ID),
      }),
    ).toEqual({ ok: false, reason: "BUILD_QUEUE_PLAN_MISMATCH" });
  });

  it("requires recorded and completed queues to clear currentPlanId", () => {
    const items = queueItems().slice(0, 2);
    const started = {
      ...createMealBuildQueueState(items)!,
      currentIndex: 1,
      completed: [items[0]!.target],
      currentPlanId: null,
    };
    expect(
      validateActiveExperienceQueue({
        probe: probe({
          phase: "BUILD_ITEM_RECORDED",
          experienceMode: "BUILD",
          buildQueue: started,
        }),
        experienceRun: runFor(PLAN_ID),
      }).ok,
    ).toBe(true);
    expect(
      validateActiveExperienceQueue({
        probe: probe({
          phase: "BUILD_ITEM_RECORDED",
          experienceMode: "BUILD",
          buildQueue: { ...started, currentPlanId: PLAN_ID },
        }),
        experienceRun: runFor(PLAN_ID),
      }),
    ).toEqual({ ok: false, reason: "BUILD_QUEUE_PHASE_INVARIANT" });

    const finished = {
      ...started,
      currentIndex: 2,
      completed: [items[0]!.target, items[1]!.target],
      currentPlanId: null,
    };
    expect(
      validateActiveExperienceQueue({
        probe: probe({
          phase: "BUILD_QUEUE_COMPLETED",
          experienceMode: "BUILD",
          buildQueue: finished,
        }),
        experienceRun: runFor(PLAN_ID),
      }).ok,
    ).toBe(true);
    expect(
      validateActiveExperienceQueue({
        probe: probe({
          phase: "BUILD_QUEUE_COMPLETED",
          experienceMode: "BUILD",
          buildQueue: started,
        }),
        experienceRun: runFor(PLAN_ID),
      }),
    ).toEqual({ ok: false, reason: "BUILD_QUEUE_PHASE_INVARIANT" });
  });

  it("rejects ROUTING_SUMMARY when any queue still has an active plan", () => {
    const items = queueItems().slice(0, 1);
    const strengthen = {
      ...createMealStrengthenQueueState(items)!,
      currentPlanId: PLAN_ID,
    };
    expect(
      validateActiveExperienceQueue({
        probe: probe({
          phase: "ROUTING_SUMMARY",
          strengthenQueue: strengthen,
        }),
        experienceRun: runFor(PLAN_ID),
      }),
    ).toEqual({ ok: false, reason: "ACTIVE_PLAN_ID_NOT_ALLOWED" });
    expect(
      validateActiveExperienceQueue({
        probe: probe({
          phase: "ROUTING_SUMMARY",
          strengthenQueue: { ...strengthen, currentPlanId: null },
        }),
        experienceRun: runFor(PLAN_ID),
      }).ok,
    ).toBe(true);
  });
});
