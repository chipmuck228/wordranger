import { describe, expect, it } from "vitest";
import { mealTestLexemeLoader } from "../content/helpers";
import {
  createPublicGuidedActivity,
  guidedActivityId,
} from "@/contextual-learning/candidate-v0/execution";
import { homeBreakfastFrame } from "@/contextual-learning/candidate-v0/fixtures/meal/contexts";
import { createMealBuildPlan } from "@/contextual-learning/candidate-v0/fixtures/meal/plans";
import { isGuidedExperienceStep } from "@/contextual-learning/candidate-v0/domain/types";

describe("Candidate V0 guided activity contract", () => {
  it("omits answerKey, targetSkill, and taskType from the public activity", () => {
    const plan = createMealBuildPlan(homeBreakfastFrame, { loadLexeme: mealTestLexemeLoader });
    const step = plan.steps[0];
    expect(isGuidedExperienceStep(step)).toBe(true);
    if (!isGuidedExperienceStep(step)) {
      return;
    }
    const activity = createPublicGuidedActivity({
      runId: "run-contract",
      experienceId: plan.id,
      contextFrameId: plan.contextFrameId,
      step,
    });
    expect(activity.id).toBe(guidedActivityId("run-contract", step.id));
    expect(activity.runId).toBe("run-contract");
    expect(activity.experienceId).toBe(plan.id);
    expect(activity.protocolVersion).toBe("candidate-v0");
    expect(activity.completionContract).toEqual({ kind: "ACKNOWLEDGE_ONLY" });
    expect(activity).not.toHaveProperty("answerKey");
    expect(activity).not.toHaveProperty("targetSkill");
    expect(activity).not.toHaveProperty("taskType");
    expect(activity).not.toHaveProperty("correctOptionIds");
    expect(activity).not.toHaveProperty("score");
    expect(activity).not.toHaveProperty("isCorrect");
  });

  it("accepts only activityId and completedAt on the receipt type", () => {
    const receipt = {
      activityId: "guided:meal:present",
      completedAt: "2026-09-17T12:00:00.000Z",
    };
    expect(Object.keys(receipt).sort()).toEqual(["activityId", "completedAt"]);
  });
});
