import { describe, expect, it } from "vitest";
import {
  homeBreakfastFrame,
  picnicLunchFrame,
  restaurantMealFrame,
} from "@/contextual-learning/candidate-v0/fixtures/meal/contexts";
import { MEAL_SENSE, MEAL_PROFILES } from "@/contextual-learning/candidate-v0/fixtures/meal/knowledge";
import { mealSkeleton } from "@/contextual-learning/candidate-v0/fixtures/meal/skeleton";
import { MEAL_SUPPORTS } from "@/contextual-learning/candidate-v0/fixtures/meal/supports";
import {
  createMealBuildPlan,
  createMealLexicalBuildPlan,
} from "@/contextual-learning/candidate-v0/fixtures/meal/plans";
import { identityForFixtureSense } from "@/contextual-learning/candidate-v0/strengthen/meal-lexical-profiles";
import {
  isAssessableExperienceStep,
  isGuidedExperienceStep,
} from "@/contextual-learning/candidate-v0/domain/types";
import { validateExperiencePlan } from "@/contextual-learning/candidate-v0/validation/validate-experience-plan";
import { compileExperienceStep } from "@/contextual-learning/candidate-v0/compilation/compile-experience-step";
import { profileMap, supportMap } from "@/contextual-learning/candidate-v0/fixtures/shared";
import { FROZEN_RUNTIME_CAPABILITIES } from "@/contextual-learning/candidate-v0/capabilities/capability-registry";
import { compilationRequest } from "../helpers";
import { mealTestLexemeLoader } from "../content/helpers";
import { planExperience } from "@/contextual-learning/candidate-v0/planning";
import { mealInput, TYPING_CAPABILITY } from "../planning/helpers";
import { MEAL_BUILD_SCENE_BINDINGS } from "@/contextual-learning/candidate-v0/build/meal-lexical-build-profiles";

const SENSES = [MEAL_SENSE.soup, MEAL_SENSE.bowl, MEAL_SENSE.spoon, MEAL_SENSE.fork] as const;
const capabilities = FROZEN_RUNTIME_CAPABILITIES.filter(
  (item) => item.id === "frozen-text-input:TYPE",
);

describe("Meal lexical BUILD plan factory", () => {
  it.each(SENSES)("creates a six-step BUILD plan for %s", (sense) => {
    const identity = identityForFixtureSense(sense);
    expect(identity).not.toBeNull();
    const plan = createMealLexicalBuildPlan({
      frame: homeBreakfastFrame,
      profile: identity!,
      loadLexeme: mealTestLexemeLoader,
    });
    expect(plan.mode).toBe("BUILD");
    expect(plan.targets.some((target) => target.sense.senseId === sense.senseId)).toBe(
      true,
    );
    expect(plan.steps).toHaveLength(6);
    expect(plan.steps.filter((step) => isGuidedExperienceStep(step))).toHaveLength(5);
    const recall = plan.steps.at(-1);
    expect(recall && isAssessableExperienceStep(recall)).toBe(true);
    if (!recall || !isAssessableExperienceStep(recall)) {
      return;
    }
    expect(recall.promptIntent.mustNotRevealTargetForm).toBe(true);
    expect(recall.promptIntent.instructionKey.toLowerCase()).not.toContain(
      identity!.canonicalKey,
    );
    expect(recall.expectedResponse).toEqual({
      kind: "LEXICAL_FORM",
      sense,
    });
    const teach = plan.steps[2];
    expect(isGuidedExperienceStep(teach)).toBe(true);
    if (isGuidedExperienceStep(teach)) {
      expect(teach.executionIntent.guidedActivityKind).toBe("PRESENT_LEXICAL_FORM");
      expect(teach.supportExposure?.target).toEqual(identity!.target);
    }
    const contrast = plan.steps[3];
    expect(isGuidedExperienceStep(contrast)).toBe(true);
    if (isGuidedExperienceStep(contrast)) {
      const contrastId = `home-${MEAL_BUILD_SCENE_BINDINGS[identity!.stepToken].contrastEntityId.replace("home-", "")}`;
      expect(contrast.presentation.presentedEntityIds).toContain(
        `home-${identity!.stepToken}`,
      );
      expect(contrast.presentation.presentedEntityIds?.some((id) => id !== `home-${identity!.stepToken}`)).toBe(true);
      expect(contrastId).toBeTruthy();
    }
    const validated = validateExperiencePlan({
      plan,
      frame: homeBreakfastFrame,
      skeleton: mealSkeleton,
      capabilities,
      supportBlocks: supportMap(MEAL_SUPPORTS),
      senseProfiles: profileMap(MEAL_PROFILES),
    });
    expect(validated.ok).toBe(true);
    const compiled = compileExperienceStep(
      compilationRequest({
        plan,
        step: recall,
        frame: homeBreakfastFrame,
        skeleton: mealSkeleton,
        profiles: profileMap(MEAL_PROFILES),
      }),
    );
    expect(compiled.ok).toBe(true);
    if (compiled.ok) {
      expect(compiled.value.publicLearningTask.taskType).toBe("ACTIVE_RECALL_TYPING");
      expect(JSON.stringify(compiled.value.publicLearningTask)).not.toMatch(
        new RegExp(`\\b${identity!.canonicalKey}\\b`, "i"),
      );
    }
  });

  it("builds a restaurant plan from the authored restaurant frame", () => {
    const identity = identityForFixtureSense(MEAL_SENSE.soup);
    expect(identity).not.toBeNull();
    const plan = createMealLexicalBuildPlan({
      frame: restaurantMealFrame,
      profile: identity!,
      loadLexeme: mealTestLexemeLoader,
    });
    expect(plan.mode).toBe("BUILD");
    expect(plan.steps).toHaveLength(6);
    expect(plan.contextFrameId).toBe(restaurantMealFrame.id);
    expect(JSON.stringify(plan)).toContain("rest-soup");
    expect(JSON.stringify(plan)).toContain("rest-bowl");
    expect(JSON.stringify(plan)).not.toContain("home-soup");
    expect(JSON.stringify(plan)).not.toContain("home-fact-");
  });

  it("still projects Picnic, which is not authored in the pack", () => {
    const identity = identityForFixtureSense(MEAL_SENSE.soup);
    expect(identity).not.toBeNull();
    const plan = createMealLexicalBuildPlan({
      frame: picnicLunchFrame,
      profile: identity!,
      loadLexeme: mealTestLexemeLoader,
    });
    expect(plan.mode).toBe("BUILD");
    expect(plan.steps).toHaveLength(6);
    expect(plan.contextFrameId).toBe(picnicLunchFrame.id);
    expect(JSON.stringify(plan)).toContain("picnic-soup");
    expect(JSON.stringify(plan)).not.toContain("home-soup");
  });

  it.each([
    [
      "missing initialFacts",
      { ...restaurantMealFrame, initialFacts: [] as typeof restaurantMealFrame.initialFacts },
    ],
    [
      "reversed contains arguments",
      {
        ...restaurantMealFrame,
        initialFacts: restaurantMealFrame.initialFacts.map((item) =>
          item.id === "rest-fact-contains-bowl-soup"
            ? { ...item, arguments: [...item.arguments].reverse() }
            : item,
        ),
      },
    ],
    [
      "redirected contains predicate",
      {
        ...restaurantMealFrame,
        initialFacts: restaurantMealFrame.initialFacts.map((item) =>
          item.id === "rest-fact-contains-bowl-soup"
            ? { ...item, predicate: "beside" }
            : item,
        ),
      },
    ],
  ])(
    "fails closed when the restaurant runtime frame has %s",
    (_label, frame) => {
      const identity = identityForFixtureSense(MEAL_SENSE.soup);
      expect(identity).not.toBeNull();
      const plan = createMealLexicalBuildPlan({
        frame,
        profile: identity!,
        loadLexeme: mealTestLexemeLoader,
      });
      expect(plan.targets).toEqual([]);
      expect(plan.steps).toEqual([]);
    },
  );

  it("fails closed for an unknown requested target", () => {
    const plan = createMealBuildPlan(homeBreakfastFrame, {
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

  it("lets the planner choose the requested BUILD target", () => {
    for (const sense of SENSES) {
      const planned = planExperience({
        ...mealInput("BUILD", [TYPING_CAPABILITY]),
        targets: [{ id: `target-${sense.lexemeId}`, sense, focus: "MEANING_TO_FORM" }],
      });
      expect(planned.ok).toBe(true);
      if (!planned.ok) {
        throw new Error(planned.error.message);
      }
      expect(planned.plan.targets.some((target) => target.sense.senseId === sense.senseId)).toBe(
        true,
      );
      expect(planned.plan.id).toContain(
        identityForFixtureSense(sense)!.stepToken,
      );
    }
  });

  it("returns an unresolved plan when the authored frame has no injected loader", () => {
    const identity = identityForFixtureSense(MEAL_SENSE.soup);
    expect(identity).not.toBeNull();
    const plan = createMealLexicalBuildPlan({
      frame: homeBreakfastFrame,
      profile: identity!,
    });
    expect(plan.targets).toEqual([]);
    expect(plan.steps).toEqual([]);
  });

  it("returns an unresolved plan when the loader cannot find the lexeme", () => {
    const identity = identityForFixtureSense(MEAL_SENSE.soup);
    expect(identity).not.toBeNull();
    const plan = createMealLexicalBuildPlan({
      frame: homeBreakfastFrame,
      profile: identity!,
      loadLexeme: () => null,
    });
    expect(plan.targets).toEqual([]);
    expect(plan.steps).toEqual([]);
  });

  it("returns an unresolved plan when the loader id does not match the pack target", () => {
    const identity = identityForFixtureSense(MEAL_SENSE.soup);
    expect(identity).not.toBeNull();
    const plan = createMealLexicalBuildPlan({
      frame: homeBreakfastFrame,
      profile: identity!,
      loadLexeme: (canonicalKey) => {
        const bundled = mealTestLexemeLoader(canonicalKey);
        return bundled ? { ...bundled, id: "lex-not-the-pack-target" } : null;
      },
    });
    expect(plan.targets).toEqual([]);
    expect(plan.steps).toEqual([]);
  });

  it("still plans when bundled IPA is missing and does not invent one", () => {
    const identity = identityForFixtureSense(MEAL_SENSE.soup);
    expect(identity).not.toBeNull();
    const plan = createMealLexicalBuildPlan({
      frame: homeBreakfastFrame,
      profile: identity!,
      loadLexeme: (canonicalKey) => {
        const bundled = mealTestLexemeLoader(canonicalKey);
        return bundled ? { ...bundled, ipa: [] } : null;
      },
    });
    expect(plan.steps).toHaveLength(6);
    expect(JSON.stringify(plan)).not.toMatch(/\/suːp\/|\/bəʊl\/|\/spuːn\/|\/fɔːk\//);
  });
});
