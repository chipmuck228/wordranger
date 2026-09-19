import { describe, expect, it } from "vitest";
import {
  ExecutionErrorCode,
  createExperienceRun,
  guidedActivityId,
  issueCurrentStep,
  recordFrozenTaskCompletion,
  recordGuidedActivityCompletion,
} from "@/contextual-learning/candidate-v0/execution";
import type { IssueCurrentStepInput } from "@/contextual-learning/candidate-v0/execution/issue-current-step";
import { classroomRulerFrame } from "@/contextual-learning/candidate-v0/fixtures/borrowing-sharing/contexts";
import { BORROW_PROFILES } from "@/contextual-learning/candidate-v0/fixtures/borrowing-sharing/knowledge";
import { createBorrowGuidedPerspectivePlan } from "@/contextual-learning/candidate-v0/fixtures/borrowing-sharing/plans";
import { borrowingSharingSkeleton } from "@/contextual-learning/candidate-v0/fixtures/borrowing-sharing/skeleton";
import { createSafeLexicalRecallPlan } from "@/contextual-learning/candidate-v0/fixtures/execution/safe-lexical-recall";
import { homeBreakfastFrame } from "@/contextual-learning/candidate-v0/fixtures/meal/contexts";
import { MEAL_PROFILES } from "@/contextual-learning/candidate-v0/fixtures/meal/knowledge";
import { createMealBuildPlan } from "@/contextual-learning/candidate-v0/fixtures/meal/plans";
import { mealSkeleton } from "@/contextual-learning/candidate-v0/fixtures/meal/skeleton";
import { scienceTowerFrame } from "@/contextual-learning/candidate-v0/fixtures/school-challenge/contexts";
import { SCHOOL_PROFILES } from "@/contextual-learning/candidate-v0/fixtures/school-challenge/knowledge";
import { createSchoolGuidedPresentationPlan } from "@/contextual-learning/candidate-v0/fixtures/school-challenge/plans";
import { schoolChallengeSkeleton } from "@/contextual-learning/candidate-v0/fixtures/school-challenge/skeleton";
import { profileMap } from "@/contextual-learning/candidate-v0/fixtures/shared";
import type {
  ContextFrame,
  GuidedExperienceStepSpec,
  LearningExperiencePlan,
  SemanticSkeleton,
} from "@/contextual-learning/candidate-v0/domain/types";
import { isGuidedExperienceStep } from "@/contextual-learning/candidate-v0/domain/types";
import { resolvedSnapshotFor } from "../helpers";

const now = "2026-09-17T12:00:00.000Z";
const ALL_PROFILES = profileMap([
  ...MEAL_PROFILES,
  ...SCHOOL_PROFILES,
  ...BORROW_PROFILES,
]);

function readyRun(
  plan: LearningExperiencePlan,
  frame: ContextFrame,
  skeleton: SemanticSkeleton,
  runId: string,
) {
  const created = createExperienceRun({
    plan,
    ...resolvedSnapshotFor(plan, frame, skeleton, ALL_PROFILES),
    now,
    createId: () => runId,
  });
  expect(created.ok).toBe(true);
  if (!created.ok) {
    throw new Error(created.error.message);
  }
  expect(created.run.id).toBe(runId);
  return created.run;
}

function issueGuided(
  plan: LearningExperiencePlan,
  frame: ContextFrame,
  skeleton: SemanticSkeleton,
  runId: string,
) {
  const issued = issueCurrentStep({
    run: readyRun(plan, frame, skeleton, runId),
    now,
  });
  expect(issued.ok).toBe(true);
  if (!issued.ok) {
    throw new Error(issued.error.message);
  }
  expect(issued.issuedActivity).toBeDefined();
  return issued;
}

describe("Candidate V0 run-bound Guided Activity identity", () => {
  it("gives two runs of the same plan different activity IDs without using timestamps", () => {
    const plan = createMealBuildPlan(homeBreakfastFrame);
    const step = plan.steps[0];
    expect(isGuidedExperienceStep(step)).toBe(true);
    if (!isGuidedExperienceStep(step)) {
      return;
    }
    const first = issueGuided(plan, homeBreakfastFrame, mealSkeleton, "run-a");
    const second = issueGuided(plan, homeBreakfastFrame, mealSkeleton, "run-b");
    const activityA = first.issuedActivity!;
    const activityB = second.issuedActivity!;

    expect(activityA.experienceId).toBe(plan.id);
    expect(activityB.experienceId).toBe(plan.id);
    expect(activityA.experienceId).toBe(activityB.experienceId);
    expect(activityA.stepId).toBe(step.id);
    expect(activityB.stepId).toBe(step.id);
    expect(activityA.runId).toBe("run-a");
    expect(activityB.runId).toBe("run-b");
    expect(activityA.id).toBe(guidedActivityId("run-a", step.id));
    expect(activityB.id).toBe(guidedActivityId("run-b", step.id));
    expect(activityA.id).not.toBe(activityB.id);
    expect(activityA.id.includes(now)).toBe(false);
    expect(activityB.id.includes(now)).toBe(false);
    expect(activityA.id).not.toBe(`guided:${plan.id}:${step.id}`);
    expect(first.run.stepRuns[0]?.activityId).toBe(activityA.id);
    expect(second.run.stepRuns[0]?.activityId).toBe(activityB.id);
  });

  it("rejects a run-A receipt against run B and still accepts the valid run-B receipt", () => {
    const plan = createMealBuildPlan(homeBreakfastFrame);
    const first = issueGuided(plan, homeBreakfastFrame, mealSkeleton, "run-a");
    const second = issueGuided(plan, homeBreakfastFrame, mealSkeleton, "run-b");
    const beforeIndex = second.run.currentStepIndex;
    const beforeStatus = second.run.status;

    const crossed = recordGuidedActivityCompletion({
      run: second.run,
      receipt: {
        activityId: first.issuedActivity!.id,
        completedAt: now,
      },
    });
    expect(crossed.ok).toBe(false);
    if (crossed.ok) {
      throw new Error("cross-run receipt must fail");
    }
    expect(crossed.error.code).toBe(ExecutionErrorCode.EXEC_ACTIVITY_ID_MISMATCH);
    expect(crossed.run.status).toBe("GUIDED_ACTIVITY_ISSUED");
    expect(crossed.run.currentStepIndex).toBe(beforeIndex);
    expect(crossed.run.status).toBe(beforeStatus);
    expect(crossed.run.stepRuns[0]?.status).toBe("GUIDED_ACTIVITY_ISSUED");
    expect(crossed.run.stepRuns[0]?.activityId).toBe(second.issuedActivity!.id);
    expect("issuedActivity" in crossed).toBe(false);
    expect("issuedTask" in crossed).toBe(false);
    expect(crossed).not.toHaveProperty("learningEvidence");
    expect(crossed).not.toHaveProperty("evidence");

    const accepted = recordGuidedActivityCompletion({
      run: second.run,
      receipt: {
        activityId: second.issuedActivity!.id,
        completedAt: now,
      },
    });
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) {
      throw new Error(accepted.error.message);
    }
    expect(accepted.run.stepRuns[0]?.status).toBe("STEP_COMPLETED");
    expect(accepted.run.status).not.toBe("GUIDED_ACTIVITY_ISSUED");
    expect(accepted).not.toHaveProperty("learningEvidence");
    expect(accepted).not.toHaveProperty("evidence");

    const replay = recordGuidedActivityCompletion({
      run: accepted.run,
      receipt: {
        activityId: second.issuedActivity!.id,
        completedAt: now,
      },
    });
    expect(replay.ok).toBe(false);
    if (replay.ok) {
      throw new Error("replay must fail");
    }
    expect(replay.error.code).toBe(ExecutionErrorCode.EXEC_DUPLICATE_COMPLETION);
    expect(replay.run.stepRuns[0]?.status).toBe("STEP_COMPLETED");
  });

  it("ignores extra issue-time identity fields and still grounds against the snapshot", () => {
    const plan = createMealBuildPlan(homeBreakfastFrame);
    const step = plan.steps[0];
    expect(isGuidedExperienceStep(step)).toBe(true);
    if (!isGuidedExperienceStep(step)) {
      return;
    }
    const run = readyRun(plan, homeBreakfastFrame, mealSkeleton, "run-canonical");
    const issued = issueCurrentStep({
      run,
      now,
      runId: "forged-run",
      experienceId: "forged-experience",
      stepId: "forged-step",
    } as IssueCurrentStepInput & {
      runId: string;
      experienceId: string;
      stepId: string;
    });
    expect(issued.ok).toBe(true);
    if (!issued.ok) {
      throw new Error(issued.error.message);
    }
    expect(issued.issuedActivity?.runId).toBe("run-canonical");
    expect(issued.issuedActivity?.experienceId).toBe(plan.id);
    expect(issued.issuedActivity?.stepId).toBe(step.id);
    expect(issued.issuedActivity?.id).toBe(
      guidedActivityId("run-canonical", step.id),
    );
    expect(issued.issuedActivity?.id).not.toContain("forged");

    const forgedPlan = {
      ...plan,
      id: "forged-grounding-with-override",
      steps: [
        {
          ...step,
          presentation: {
            instruction: "Unknown entity",
            presentedEntityIds: ["not-in-snapshot"],
          },
        },
        ...plan.steps.slice(1),
      ],
    } as unknown as LearningExperiencePlan;
    const blocked = issueCurrentStep({
      run: readyRun(
        forgedPlan,
        homeBreakfastFrame,
        mealSkeleton,
        "run-ungrounded",
      ),
      now,
      runId: "should-not-issue",
    } as IssueCurrentStepInput & { runId: string });
    expect(blocked.ok).toBe(false);
    if (blocked.ok) {
      throw new Error("ungrounded presentation must fail before issuance");
    }
    expect(blocked.error.code).toBe(
      ExecutionErrorCode.EXEC_GUIDED_ENTITY_NOT_IN_CONTEXT,
    );
    expect("issuedActivity" in blocked).toBe(false);
    expect(blocked.run.status).toBe("BLOCKED");
  });

  it("binds Meal, School, and Borrow Guided activities to their run ids", () => {
    const cases: Array<{
      plan: LearningExperiencePlan;
      frame: ContextFrame;
      skeleton: SemanticSkeleton;
      runId: string;
    }> = [
      {
        plan: createMealBuildPlan(homeBreakfastFrame),
        frame: homeBreakfastFrame,
        skeleton: mealSkeleton,
        runId: "run-meal",
      },
      {
        plan: createSchoolGuidedPresentationPlan(scienceTowerFrame),
        frame: scienceTowerFrame,
        skeleton: schoolChallengeSkeleton,
        runId: "run-school",
      },
      {
        plan: createBorrowGuidedPerspectivePlan(classroomRulerFrame),
        frame: classroomRulerFrame,
        skeleton: borrowingSharingSkeleton,
        runId: "run-borrow",
      },
    ];

    for (const item of cases) {
      const step = item.plan.steps[0] as GuidedExperienceStepSpec;
      const issued = issueGuided(item.plan, item.frame, item.skeleton, item.runId);
      expect(issued.issuedActivity?.runId).toBe(item.runId);
      expect(issued.issuedActivity?.experienceId).toBe(item.plan.id);
      expect(issued.issuedActivity?.stepId).toBe(step.id);
      expect(issued.issuedActivity?.id).toBe(
        guidedActivityId(item.runId, step.id),
      );
      expect(issued.run.stepRuns[0]?.activityId).toBe(issued.issuedActivity?.id);
    }
  });

  it("leaves frozen task completion identity unchanged", () => {
    const plan = createSafeLexicalRecallPlan(homeBreakfastFrame);
    const run = readyRun(plan, homeBreakfastFrame, mealSkeleton, "run-frozen");
    const issued = issueCurrentStep({ run, now });
    expect(issued.ok).toBe(true);
    if (!issued.ok) {
      throw new Error(issued.error.message);
    }
    expect(issued.issuedTask).toBeDefined();
    expect(issued.issuedActivity).toBeUndefined();
    expect(issued.issuedTask?.id.startsWith("guided:")).toBe(false);

    const mismatch = recordFrozenTaskCompletion({
      run: issued.run,
      receipt: { taskId: "wrong-task", completedAt: now },
    });
    expect(mismatch.ok).toBe(false);
    if (mismatch.ok) {
      throw new Error("wrong frozen receipt must fail");
    }
    expect(mismatch.error.code).toBe(ExecutionErrorCode.EXEC_TASK_ID_MISMATCH);
    expect(mismatch.run.status).toBe("FROZEN_TASK_ISSUED");
    expect(mismatch.run.currentStepIndex).toBe(0);

    const completed = recordFrozenTaskCompletion({
      run: issued.run,
      receipt: { taskId: issued.issuedTask!.id, completedAt: now },
    });
    expect(completed.ok).toBe(true);
    if (!completed.ok) {
      throw new Error(completed.error.message);
    }
    expect(completed.run.status).toBe("COMPLETED");
    expect(completed).not.toHaveProperty("learningEvidence");
  });
});
