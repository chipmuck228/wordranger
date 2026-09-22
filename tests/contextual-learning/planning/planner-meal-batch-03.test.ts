import { describe, expect, it } from "vitest";
import { bundledSceneLexemeLoader } from "@/server/runtime/bundled-scene-lexeme-loader";
import { FROZEN_RUNTIME_CAPABILITIES } from "@/contextual-learning/candidate-v0/capabilities/capability-registry";
import { MEAL_SENSE } from "@/contextual-learning/candidate-v0/fixtures/meal/knowledge";
import { homeBreakfastFrame } from "@/contextual-learning/candidate-v0/fixtures/meal/contexts";
import { mealSkeleton } from "@/contextual-learning/candidate-v0/fixtures/meal/skeleton";
import { mealBatch03Skeleton } from "@/contextual-learning/candidate-v0/fixtures/meal/meal-batch-03-skeleton";
import { mealBatch02Skeleton } from "@/contextual-learning/candidate-v0/fixtures/meal/meal-batch-02-skeleton";
import { SCHOOL_SENSE } from "@/contextual-learning/candidate-v0/fixtures/school-challenge/knowledge";
import { createExperienceRun } from "@/contextual-learning/candidate-v0/execution/create-experience-run";
import { issueCurrentStep } from "@/contextual-learning/candidate-v0/execution/issue-current-step";
import { resolveContextSnapshot } from "@/contextual-learning/candidate-v0/validation/resolve-context";
import { validateExperiencePlan } from "@/contextual-learning/candidate-v0/validation/validate-experience-plan";
import {
  PlanningErrorCode,
  findPlannerFrame,
  findPlannerSkeleton,
  planExperience,
} from "@/contextual-learning/candidate-v0/planning";
import {
  PLANNER_SENSE_PROFILES,
  PLANNER_SUPPORT_BLOCKS,
} from "@/contextual-learning/candidate-v0/planning/plan-variant-registry";
import { MEAL_SCENE_EXPANSION_BATCH_03_PACK } from "@/contextual-learning/candidate-v0/content/packs/meal/meal-scene-expansion-batch-03";
import { MEAL_BATCH_03_FRAMES } from "@/contextual-learning/candidate-v0/fixtures/meal/meal-batch-03-contexts";
import { mealInput, TYPING_CAPABILITY } from "./helpers";

const TYPING = FROZEN_RUNTIME_CAPABILITIES.find(
  (capability) => capability.id === "frozen-text-input:TYPE",
)!;

const NINE_SENSES = [
  MEAL_SENSE.soup,
  MEAL_SENSE.bowl,
  MEAL_SENSE.spoon,
  MEAL_SENSE.fork,
  MEAL_SENSE.cup,
  MEAL_SENSE.plate,
  MEAL_SENSE.knife,
  MEAL_SENSE.bread,
  MEAL_SENSE.water,
] as const;

function batch03Input(
  mode: "BUILD" | "STRENGTHEN",
  sense: (typeof NINE_SENSES)[number],
) {
  return {
    learningNeedRef: "need-opaque-ref",
    mode,
    targets: [
      {
        id: `target-${sense.senseId}-form`,
        sense,
        focus: "MEANING_TO_FORM" as const,
      },
    ],
    allowedContextIds: ["home-breakfast-v0"],
    runtimeCapabilities: [TYPING],
    loadLexeme: bundledSceneLexemeLoader,
    runtimeContextId: "MEAL_BATCH_03" as const,
  };
}

function assertExecutable(sense: (typeof NINE_SENSES)[number], mode: "BUILD" | "STRENGTHEN") {
  const planned = planExperience(batch03Input(mode, sense));
  expect(planned.ok).toBe(true);
  if (!planned.ok) {
    throw new Error(planned.error.message);
  }
  const suffix = mode === "BUILD" ? "build" : "strengthen-recall";
  expect(planned.trace.selectedVariantId).toBe(
    `meal-${suffix}:home-breakfast-v0:meal-batch-03`,
  );
  expect(
    planned.plan.targets.some((target) => target.sense.senseId === sense.senseId),
  ).toBe(true);
  expect(planned.plan.targets.some((target) => target.sense.senseId === "spoon#eating-utensil" && sense.senseId !== "spoon#eating-utensil")).toBe(
    false,
  );

  const frame = findPlannerFrame(planned.plan.contextFrameId, "MEAL_BATCH_03");
  const skeleton = findPlannerSkeleton(planned.plan.skeletonId, "MEAL_BATCH_03");
  expect(frame).toBeDefined();
  expect(skeleton).toBeDefined();
  const validated = validateExperiencePlan({
    plan: planned.plan,
    frame: frame!,
    skeleton: skeleton!,
    capabilities: [TYPING],
    supportBlocks: PLANNER_SUPPORT_BLOCKS,
    senseProfiles: PLANNER_SENSE_PROFILES,
  });
  expect(validated.ok).toBe(true);

  const created = createExperienceRun({
    plan: planned.plan,
    resolvedContext: resolveContextSnapshot(frame!, skeleton!, planned.plan.activeGoalId),
    resolvedTargets: planned.plan.targets.map((target) => ({
      targetId: target.id,
      sense: target.sense,
      displayForm: target.sense.senseId.split("#")[0] ?? "",
      focus: target.focus,
    })),
    now: "2026-09-22T00:00:00.000Z",
    createId: () => "00000000-0000-4000-8000-000000000001",
  });
  expect(created.ok).toBe(true);
  if (!created.ok) {
    throw new Error(created.error.message);
  }
  const issued = issueCurrentStep({
    run: created.run,
    now: "2026-09-22T00:00:00.000Z",
    createId: () => "00000000-0000-4000-8000-000000000002",
  });
  expect(issued.ok).toBe(true);
  return planned;
}

describe("Candidate V0 planner — MEAL_BATCH_03", () => {
  it("selects the batch-03 BUILD variant for all nine legal senses", () => {
    for (const sense of NINE_SENSES) {
      const planned = planExperience(batch03Input("BUILD", sense));
      expect(planned.ok, sense.senseId).toBe(true);
      if (!planned.ok) {
        throw new Error(planned.error.message);
      }
      expect(planned.trace.selectedVariantId).toBe(
        "meal-build:home-breakfast-v0:meal-batch-03",
      );
    }
  });

  it("selects the batch-03 recall STRENGTHEN variant for each single target", () => {
    for (const sense of NINE_SENSES) {
      const planned = planExperience(batch03Input("STRENGTHEN", sense));
      expect(planned.ok, sense.senseId).toBe(true);
      if (!planned.ok) {
        throw new Error(planned.error.message);
      }
      expect(planned.trace.selectedVariantId).toBe(
        "meal-strengthen-recall:home-breakfast-v0:meal-batch-03",
      );
    }
  });

  it("generates, validates, and executes knife, bread, and water plans without spoon reuse", () => {
    for (const sense of [MEAL_SENSE.knife, MEAL_SENSE.bread, MEAL_SENSE.water] as const) {
      const build = assertExecutable(sense, "BUILD");
      const strengthen = assertExecutable(sense, "STRENGTHEN");
      const token = sense.senseId.split("#")[0];
      expect(JSON.stringify(build.plan.targets)).toContain(sense.senseId);
      expect(JSON.stringify(strengthen.plan.targets)).toContain(sense.senseId);
      expect(build.plan.targets[0]?.sense.lexemeId).not.toBe(MEAL_SENSE.spoon.lexemeId);
      const frame = findPlannerFrame("home-breakfast-v0", "MEAL_BATCH_03");
      expect(frame?.entityBindings.some((item) => item.entityId === `home-${token}`)).toBe(
        true,
      );
    }
  });

  it("resolves batch-03 frame and skeleton from the batch-03 snapshot", () => {
    const frame = findPlannerFrame("home-breakfast-v0", "MEAL_BATCH_03");
    const skeleton = findPlannerSkeleton("meal-setting-v0", "MEAL_BATCH_03");
    expect(frame?.entityBindings.some((item) => item.entityId === "home-knife")).toBe(true);
    expect(frame?.entityBindings.some((item) => item.entityId === "home-bread")).toBe(true);
    expect(frame?.entityBindings.some((item) => item.entityId === "home-water")).toBe(true);
    expect(homeBreakfastFrame.entityBindings.some((item) => item.entityId === "home-knife")).toBe(
      false,
    );
    expect(findPlannerFrame("home-breakfast-v0")?.entityBindings.some((item) => item.entityId === "home-knife")).toBe(
      false,
    );
    expect(findPlannerFrame("home-breakfast-v0", "MEAL_BATCH_02")?.entityBindings.some((item) => item.entityId === "home-knife")).toBe(
      false,
    );
    expect(skeleton?.roleDefinitions.map((item) => item.id)).toEqual(
      expect.arrayContaining(["SOLID_FOOD", "DRINKABLE_LIQUID", "WATER_VESSEL"]),
    );
    expect(skeleton).toBe(mealBatch03Skeleton);
    expect(findPlannerSkeleton("meal-setting-v0")).toBe(mealSkeleton);
    expect(findPlannerSkeleton("meal-setting-v0", "MEAL_BATCH_02")).toBe(mealBatch02Skeleton);
    expect(mealSkeleton.roleDefinitions.map((item) => item.id)).not.toContain("SOLID_FOOD");
  });

  it("fail-closes when the runtime context does not match", () => {
    const knife = {
      ...batch03Input("BUILD", MEAL_SENSE.knife),
      runtimeContextId: "MEAL_BATCH_02" as const,
    };
    const base = {
      ...batch03Input("BUILD", MEAL_SENSE.knife),
      runtimeContextId: "MEAL_BASE" as const,
    };
    expect(planExperience(knife).ok).toBe(false);
    expect(planExperience(base).ok).toBe(false);
    expect(findPlannerFrame("missing-frame-v0", "MEAL_BATCH_03")).toBeUndefined();
    expect(findPlannerSkeleton("school-challenge-v0", "MEAL_BATCH_03")).toBeUndefined();
  });

  it("does not admit an unknown sense into the batch-03 variant", () => {
    const unknown = planExperience({
      ...batch03Input("BUILD", MEAL_SENSE.knife),
      targets: [
        {
          id: "target-unknown",
          sense: { lexemeId: "lex-unknown", senseId: "unknown#not-a-meal-sense" },
          focus: "MEANING_TO_FORM",
        },
      ],
    });
    expect(unknown.ok).toBe(false);
    if (unknown.ok) {
      throw new Error("unknown sense must fail closed");
    }
    expect(unknown.error.code).toBe(PlanningErrorCode.PLAN_TARGET_NOT_REGISTERED);

    const school = planExperience({
      ...batch03Input("BUILD", MEAL_SENSE.knife),
      targets: [
        {
          id: "target-try",
          sense: SCHOOL_SENSE.try,
          focus: "MEANING_TO_FORM",
        },
      ],
    });
    expect(school.ok).toBe(false);
    if (school.ok) {
      throw new Error("school sense must not match batch-03");
    }
    expect(school.error.code).toBe(PlanningErrorCode.PLAN_NO_COMPATIBLE_VARIANT);
  });

  it("keeps batch-02 plate selection unchanged", () => {
    const planned = planExperience({
      learningNeedRef: "need-opaque-ref",
      mode: "BUILD",
      targets: [
        {
          id: "target-plate-form",
          sense: MEAL_SENSE.plate,
          focus: "MEANING_TO_FORM",
        },
      ],
      allowedContextIds: ["home-breakfast-v0"],
      runtimeCapabilities: [TYPING],
      loadLexeme: bundledSceneLexemeLoader,
      runtimeContextId: "MEAL_BATCH_02",
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) {
      throw new Error(planned.error.message);
    }
    expect(planned.trace.selectedVariantId).toBe(
      "meal-build:home-breakfast-v0:meal-batch-02",
    );
  });

  it("keeps base Meal, School Challenge, and Borrowing-Sharing results unchanged", () => {
    const meal = planExperience(mealInput("BUILD", [TYPING_CAPABILITY]));
    expect(meal.ok).toBe(true);
    if (!meal.ok) {
      throw new Error(meal.error.message);
    }
    expect(meal.trace.selectedVariantId).toBe("meal-build:home-breakfast-v0");

    const retrieve = planExperience(mealInput("RETRIEVE"));
    expect(retrieve.ok).toBe(true);
    if (!retrieve.ok) {
      throw new Error(retrieve.error.message);
    }
    expect(retrieve.trace.selectedVariantId).toBe("meal-retrieve:home-breakfast-v0");

    const probe = planExperience(mealInput("PROBE"));
    expect(probe.ok).toBe(false);
    if (probe.ok) {
      throw new Error("PROBE must remain a planner gap");
    }
    expect(probe.error.code).toBe(PlanningErrorCode.PLAN_MODE_NOT_AVAILABLE);
  });

  it("materializes from caller-injected authored snapshot, not live batch-03 constants", () => {
    const authoredPack = structuredClone(MEAL_SCENE_EXPANSION_BATCH_03_PACK);
    const knife = authoredPack.lexemes.find(
      (lexeme) => lexeme.membership.presentationToken === "knife",
    );
    expect(knife).toBeDefined();
    knife!.lexicalPresentation.displayLabel = "A版小刀标";
    knife!.build.groundInstruction = "A版小刀GROUND";
    const planned = planExperience({
      ...batch03Input("BUILD", MEAL_SENSE.knife),
      authoredRuntime: {
        pack: authoredPack,
        frames: MEAL_BATCH_03_FRAMES,
        skeleton: mealBatch03Skeleton,
      },
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) {
      throw new Error(planned.error.message);
    }
    const json = JSON.stringify(planned.plan);
    expect(json).toContain("A版小刀GROUND");
    expect(json).not.toContain("桌上有一把较小的餐具。先看看它在场景里的位置。");
  });

  it("fail-closes when injected frames or skeleton ids do not match the variant", () => {
    const missingFrame = planExperience({
      ...batch03Input("BUILD", MEAL_SENSE.knife),
      authoredRuntime: {
        pack: MEAL_SCENE_EXPANSION_BATCH_03_PACK,
        frames: [],
        skeleton: mealBatch03Skeleton,
      },
    });
    expect(missingFrame.ok).toBe(false);
    if (missingFrame.ok) {
      throw new Error("missing frame must fail closed");
    }
    expect(missingFrame.error.code).toBe(PlanningErrorCode.PLAN_VARIANT_INVALID);

    const wrongSkeleton = planExperience({
      ...batch03Input("BUILD", MEAL_SENSE.knife),
      authoredRuntime: {
        pack: MEAL_SCENE_EXPANSION_BATCH_03_PACK,
        frames: MEAL_BATCH_03_FRAMES,
        skeleton: { ...mealBatch03Skeleton, id: "not-meal-setting-v0" },
      },
    });
    expect(wrongSkeleton.ok).toBe(false);
    if (wrongSkeleton.ok) {
      throw new Error("skeleton mismatch must fail closed");
    }
    expect(wrongSkeleton.error.code).toBe(PlanningErrorCode.PLAN_VARIANT_INVALID);
  });
});
