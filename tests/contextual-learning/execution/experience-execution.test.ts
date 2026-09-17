import { describe, expect, it } from "vitest";
import { DomainErrorCode } from "@/contextual-learning/candidate-v0/domain/errors";
import {
  ExecutionErrorCode,
  abortExperienceRun,
  applyExperienceCommand,
  createExperienceRun,
  issueCurrentStep,
  recordTaskCompletion,
} from "@/contextual-learning/candidate-v0/execution";
import type { ExperienceRun } from "@/contextual-learning/candidate-v0/execution";
import { createSafeLexicalRecallPlan } from "@/contextual-learning/candidate-v0/fixtures/execution/safe-lexical-recall";
import { classroomRulerFrame } from "@/contextual-learning/candidate-v0/fixtures/borrowing-sharing/contexts";
import { BORROW_PROFILES } from "@/contextual-learning/candidate-v0/fixtures/borrowing-sharing/knowledge";
import { createBorrowBuildPlan } from "@/contextual-learning/candidate-v0/fixtures/borrowing-sharing/plans";
import { borrowingSharingSkeleton } from "@/contextual-learning/candidate-v0/fixtures/borrowing-sharing/skeleton";
import {
  homeBreakfastFrame,
  picnicLunchFrame,
  restaurantMealFrame,
} from "@/contextual-learning/candidate-v0/fixtures/meal/contexts";
import { MEAL_PROFILES } from "@/contextual-learning/candidate-v0/fixtures/meal/knowledge";
import { createMealBuildPlan } from "@/contextual-learning/candidate-v0/fixtures/meal/plans";
import { mealSkeleton } from "@/contextual-learning/candidate-v0/fixtures/meal/skeleton";
import { scienceTowerFrame } from "@/contextual-learning/candidate-v0/fixtures/school-challenge/contexts";
import { SCHOOL_PROFILES } from "@/contextual-learning/candidate-v0/fixtures/school-challenge/knowledge";
import { createSchoolBuildPlan } from "@/contextual-learning/candidate-v0/fixtures/school-challenge/plans";
import { schoolChallengeSkeleton } from "@/contextual-learning/candidate-v0/fixtures/school-challenge/skeleton";
import {
  FIXTURE_PROVENANCE,
  completeAll,
  nextOrEnd,
  profileMap,
} from "@/contextual-learning/candidate-v0/fixtures/shared";
import type { LearningExperiencePlan } from "@/contextual-learning/candidate-v0/domain/types";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { LearningTaskType } from "@/domain/tasks/task-type";
import { resolvedSnapshotFor } from "../helpers";

const now = "2026-09-17T12:00:00.000Z";
const ALL_PROFILES = profileMap([
  ...MEAL_PROFILES,
  ...SCHOOL_PROFILES,
  ...BORROW_PROFILES,
]);
const FRAME_BY_ID = Object.fromEntries(
  [
    homeBreakfastFrame,
    picnicLunchFrame,
    restaurantMealFrame,
    scienceTowerFrame,
    classroomRulerFrame,
  ].map((frame) => [frame.id, frame]),
);
const SKELETON_BY_ID = Object.fromEntries(
  [mealSkeleton, schoolChallengeSkeleton, borrowingSharingSkeleton].map(
    (skeleton) => [skeleton.id, skeleton],
  ),
);

function resolvedSnapshotForPlan(plan: LearningExperiencePlan) {
  const frame = FRAME_BY_ID[plan.contextFrameId];
  const skeleton = SKELETON_BY_ID[plan.skeletonId];
  if (!frame || !skeleton) {
    throw new Error(`No fixture snapshot for ${plan.id}`);
  }
  return resolvedSnapshotFor(plan, frame, skeleton, ALL_PROFILES);
}

function createRun(plan: LearningExperiencePlan) {
  return createExperienceRun({
    plan,
    ...resolvedSnapshotForPlan(plan),
    now,
    createId: () => `run-${plan.id}`,
  });
}

function expectReadyRun(plan: LearningExperiencePlan) {
  const created = createRun(plan);
  expect(created.ok).toBe(true);
  if (!created.ok) {
    throw new Error(created.error.message);
  }
  expect(created.run.status).toBe("READY");
  expect(created.run.currentStepIndex).toBe(0);
  expect(created.run.stepRuns.map((item) => item.stepId)).toEqual(
    plan.steps.map((step) => step.id),
  );
  expect(created.run.stepRuns.every((item) => item.status === "PENDING")).toBe(
    true,
  );
  return created.run;
}

function unreachableTerminalBeforeRequiredPlan(): LearningExperiencePlan {
  const recall = createSafeLexicalRecallPlan(homeBreakfastFrame);
  const earlyEnd = {
    ...recall.steps[0]!,
    id: "early-end",
    transition: nextOrEnd(true),
  };
  const laterRequired = {
    ...recall.steps[0]!,
    id: "later-required",
    transition: nextOrEnd(false),
  };
  return {
    ...recall,
    id: "unreachable-terminal-before-required",
    steps: [earlyEnd, laterRequired],
    completionPolicy: {
      requiredStepIds: ["later-required"],
      terminalStepIds: ["early-end"],
      onCompilationFailure: "ABORT_PLAN",
    },
  };
}

function handIssuedUnreachableRun(): ExperienceRun {
  const plan = unreachableTerminalBeforeRequiredPlan();
  return {
    id: "hand-built-unreachable",
    schemaVersion: "candidate-v0",
    experienceId: plan.id,
    planSnapshot: { plan, ...resolvedSnapshotForPlan(plan) },
    status: "TASK_ISSUED",
    currentStepIndex: 0,
    stepRuns: [
      {
        stepId: "early-end",
        status: "TASK_ISSUED",
        taskId: "task-early-end",
        issuedAt: now,
      },
      { stepId: "later-required", status: "PENDING" },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

function expectStepNotStillIssued(run: ExperienceRun, taskId: string) {
  const step = run.stepRuns.find((item) => item.taskId === taskId);
  expect(step).toBeDefined();
  expect(step?.status).not.toBe("TASK_ISSUED");
}

describe("Candidate V0 experience execution — creation", () => {
  it("creates a READY run whose stepRuns follow the plan", () => {
    const plan = createMealBuildPlan(homeBreakfastFrame);
    const run = expectReadyRun(plan);
    expect(run.experienceId).toBe(plan.id);
    expect(run.planSnapshot.plan.steps).toHaveLength(plan.steps.length);
  });

  it("rejects an empty plan", () => {
    const plan = createSafeLexicalRecallPlan(homeBreakfastFrame);
    plan.steps = [];
    plan.completionPolicy = completeAll([]);
    const created = createRun(plan);
    expect(created.ok).toBe(false);
    if (created.ok) {
      return;
    }
    expect(created.error.code).toBe(ExecutionErrorCode.EXEC_INVALID_PLAN_SNAPSHOT);
  });

  it("rejects duplicate step ids", () => {
    const plan = createSafeLexicalRecallPlan(homeBreakfastFrame);
    plan.steps = [plan.steps[0]!, { ...plan.steps[0]!, id: plan.steps[0]!.id }];
    const created = createRun(plan);
    expect(created.ok).toBe(false);
    if (created.ok) {
      return;
    }
    expect(created.error.code).toBe(ExecutionErrorCode.EXEC_INVALID_PLAN_SNAPSHOT);
  });

  it("rejects a missing requiredStepId", () => {
    const plan = createSafeLexicalRecallPlan(homeBreakfastFrame);
    plan.completionPolicy = {
      ...plan.completionPolicy,
      requiredStepIds: ["missing-required"],
    };
    const created = createRun(plan);
    expect(created.ok).toBe(false);
    if (created.ok) {
      return;
    }
    expect(created.error.code).toBe(ExecutionErrorCode.EXEC_INVALID_PLAN_SNAPSHOT);
  });

  it("rejects a missing terminalStepId", () => {
    const plan = createSafeLexicalRecallPlan(homeBreakfastFrame);
    plan.completionPolicy = {
      ...plan.completionPolicy,
      terminalStepIds: ["missing-terminal"],
    };
    const created = createRun(plan);
    expect(created.ok).toBe(false);
    if (created.ok) {
      return;
    }
    expect(created.error.code).toBe(ExecutionErrorCode.EXEC_INVALID_PLAN_SNAPSHOT);
  });

  it("rejects a terminal / END step that cannot complete required later steps", () => {
    const created = createRun(unreachableTerminalBeforeRequiredPlan());
    expect(created.ok).toBe(false);
    if (created.ok) {
      return;
    }
    expect(created.error.code).toBe(ExecutionErrorCode.EXEC_INVALID_PLAN_SNAPSHOT);
  });
});

describe("Candidate V0 experience execution — safe lexical recall", () => {
  it("issues ACTIVE_RECALL_TYPING and completes from a receipt only", () => {
    const plan = createSafeLexicalRecallPlan(homeBreakfastFrame);
    const run = expectReadyRun(plan);
    const issued = issueCurrentStep({
      run,
      now,
    });
    expect(issued.ok).toBe(true);
    if (!issued.ok) {
      return;
    }
    expect(issued.run.status).toBe("TASK_ISSUED");
    expect(issued.issuedTask?.taskType).toBe(LearningTaskType.ACTIVE_RECALL_TYPING);
    expect(issued.issuedTask?.targetSkill).toBe(VocabularySkill.ACTIVE_RECALL);
    expect(issued.run.stepRuns[0]?.compilationTrace?.semanticProjectionId).toBe(
      "lexical-form-type-recall-to-active-recall",
    );
    expect(issued.run.stepRuns[0]?.taskId).toBe(issued.issuedTask?.id);
    expect(issued.answerKey?.exactAcceptedTexts).toEqual(["spoon"]);
    expect(issued.issuedTask?.lexemeId).toBe("lex-spoon");

    const completed = recordTaskCompletion({
      run: issued.run,
      receipt: {
        taskId: issued.issuedTask!.id,
        completedAt: "2026-09-17T12:01:00.000Z",
      },
    });
    expect(completed.ok).toBe(true);
    if (!completed.ok) {
      return;
    }
    expect(completed.run.status).toBe("COMPLETED");
    expect(completed.run.stepRuns[0]?.status).toBe("TASK_COMPLETED");
    expect(completed.run.currentStepIndex).toBe(0);
    expectStepNotStillIssued(completed.run, issued.issuedTask!.id);
  });
});

describe("Candidate V0 experience execution — completion persistence", () => {
  it("does not leave TASK_ISSUED after a legal receipt, even if the terminal policy fails", () => {
    const run = handIssuedUnreachableRun();
    const receipt = { taskId: "task-early-end", completedAt: now };
    const first = recordTaskCompletion({ run, receipt });
    expect(first.ok).toBe(false);
    if (first.ok) {
      return;
    }
    expect(first.error.code).toBe(
      ExecutionErrorCode.EXEC_TERMINAL_POLICY_NOT_SATISFIED,
    );
    expect(first.run.status).not.toBe("TASK_ISSUED");
    expectStepNotStillIssued(first.run, receipt.taskId);

    const retry = recordTaskCompletion({ run: first.run, receipt });
    expect(retry.ok).toBe(false);
    if (retry.ok) {
      return;
    }
    expect(retry.error.code).toBe(ExecutionErrorCode.EXEC_DUPLICATE_COMPLETION);
    expectStepNotStillIssued(retry.run, receipt.taskId);
  });
});

describe("Candidate V0 experience execution — resolved snapshot binding", () => {
  it("freezes resolvedTargets.displayForm after create", () => {
    const plan = createSafeLexicalRecallPlan(homeBreakfastFrame);
    const resolved = resolvedSnapshotForPlan(plan);
    const created = createExperienceRun({
      plan,
      ...resolved,
      now,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    resolved.resolvedTargets[0]!.displayForm = "fork";
    expect(created.run.planSnapshot.resolvedTargets[0]?.displayForm).toBe("spoon");
  });

  it("issues from the snapshot even if the caller tries to replace displayForm", () => {
    const plan = createSafeLexicalRecallPlan(homeBreakfastFrame);
    const run = expectReadyRun(plan);
    const leaked = {
      run,
      now,
      resolvedTargets: run.planSnapshot.resolvedTargets.map((target) => ({
        ...target,
        displayForm: "fork",
      })),
    };
    const issued = issueCurrentStep(leaked);
    expect(issued.ok).toBe(true);
    if (!issued.ok) {
      return;
    }
    expect(issued.answerKey?.exactAcceptedTexts).toEqual(["spoon"]);
    expect(issued.issuedTask?.lexemeId).toBe("lex-spoon");
    expect(issued.run.planSnapshot.resolvedTargets[0]?.displayForm).toBe("spoon");
  });

  it("cannot use the same contextFrameId with different facts at issue time", () => {
    const plan = createSafeLexicalRecallPlan(homeBreakfastFrame);
    const run = expectReadyRun(plan);
    const originalFacts = structuredClone(run.planSnapshot.resolvedContext.facts);
    const picnic = resolvedSnapshotFor(
      { ...plan, contextFrameId: picnicLunchFrame.id },
      picnicLunchFrame,
      mealSkeleton,
      ALL_PROFILES,
    );
    const leaked = {
      run,
      now,
      resolvedContext: {
        ...run.planSnapshot.resolvedContext,
        facts: picnic.resolvedContext.facts,
      },
    };
    const issued = issueCurrentStep(leaked);
    expect(issued.ok).toBe(true);
    if (!issued.ok) {
      return;
    }
    expect(issued.run.planSnapshot.resolvedContext.facts).toEqual(originalFacts);
    expect(issued.run.planSnapshot.resolvedContext.facts).not.toEqual(
      picnic.resolvedContext.facts,
    );
  });

  it("cannot use the same skeletonId with different entityBindings at issue time", () => {
    const plan = createSafeLexicalRecallPlan(homeBreakfastFrame);
    const run = expectReadyRun(plan);
    const originalBindings = structuredClone(
      run.planSnapshot.resolvedContext.entityBindings,
    );
    const picnic = resolvedSnapshotFor(
      { ...plan, contextFrameId: picnicLunchFrame.id },
      picnicLunchFrame,
      mealSkeleton,
      ALL_PROFILES,
    );
    const leaked = {
      run,
      now,
      resolvedContext: {
        ...run.planSnapshot.resolvedContext,
        entityBindings: picnic.resolvedContext.entityBindings,
      },
    };
    const issued = issueCurrentStep(leaked);
    expect(issued.ok).toBe(true);
    if (!issued.ok) {
      return;
    }
    expect(issued.run.planSnapshot.resolvedContext.entityBindings).toEqual(
      originalBindings,
    );
    expect(issued.run.planSnapshot.resolvedContext.entityBindings).not.toEqual(
      picnic.resolvedContext.entityBindings,
    );
  });

  it("compiles the answerKey from the snapshotted displayForm", () => {
    const plan = createSafeLexicalRecallPlan(homeBreakfastFrame);
    const resolved = resolvedSnapshotForPlan(plan);
    resolved.resolvedTargets[0] = {
      ...resolved.resolvedTargets[0]!,
      displayForm: "spoon",
    };
    const created = createExperienceRun({
      plan,
      ...resolved,
      now,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const issued = issueCurrentStep({ run: created.run, now });
    expect(issued.ok).toBe(true);
    if (!issued.ok) {
      return;
    }
    expect(issued.answerKey?.exactAcceptedTexts).toEqual(
      [created.run.planSnapshot.resolvedTargets[0]?.displayForm],
    );
    expect(issued.answerKey?.exactAcceptedTexts).toEqual(["spoon"]);
  });
});

describe("Candidate V0 experience execution — unsupported first steps stay BLOCKED", () => {
  it("blocks Meal IDENTIFY without skipping to RECALL", () => {
    const plan = createMealBuildPlan(homeBreakfastFrame);
    const run = expectReadyRun(plan);
    const issued = issueCurrentStep({
      run,
      now,
    });
    expect(issued.ok).toBe(false);
    if (issued.ok) {
      return;
    }
    expect("issuedTask" in issued).toBe(false);
    expect(issued.run.status).toBe("BLOCKED");
    expect(issued.run.currentStepIndex).toBe(0);
    expect(issued.error.code).toBe(DomainErrorCode.COMPILATION_SEMANTIC_MISMATCH);
    expect(issued.run.stepRuns[0]?.compilationError?.code).toBe(
      DomainErrorCode.COMPILATION_SEMANTIC_MISMATCH,
    );
    expect(issued.run.stepRuns[1]?.status).toBe("PENDING");
    expect(issued.run.stepRuns[2]?.status).toBe("PENDING");
  });

  it("blocks School CLAIM_CHOICE without issuing a task", () => {
    const plan = createSchoolBuildPlan(scienceTowerFrame);
    const run = expectReadyRun(plan);
    const issued = issueCurrentStep({
      run,
      now,
    });
    expect(issued.ok).toBe(false);
    if (issued.ok) {
      return;
    }
    expect("issuedTask" in issued).toBe(false);
    expect(issued.run.status).toBe("BLOCKED");
    expect(issued.run.currentStepIndex).toBe(0);
    expect(issued.error.code).toBe(DomainErrorCode.COMPILATION_SEMANTIC_MISMATCH);
  });

  it("blocks Borrow RELATION_CHOICE without jumping to recall", () => {
    const plan = createBorrowBuildPlan(classroomRulerFrame);
    const run = expectReadyRun(plan);
    const issued = issueCurrentStep({
      run,
      now,
    });
    expect(issued.ok).toBe(false);
    if (issued.ok) {
      return;
    }
    expect("issuedTask" in issued).toBe(false);
    expect(issued.run.status).toBe("BLOCKED");
    expect(issued.run.currentStepIndex).toBe(0);
    expect(issued.error.code).toBe(DomainErrorCode.COMPILATION_SEMANTIC_MISMATCH);
    expect(
      issued.run.stepRuns.some((item) => item.status === "TASK_ISSUED"),
    ).toBe(false);
  });
});

describe("Candidate V0 experience execution — no skip", () => {
  it("does not compile a later safe RECALL after an unsupported first step", () => {
    const school = createSchoolBuildPlan(scienceTowerFrame);
    const recall = createSafeLexicalRecallPlan(homeBreakfastFrame);
    const plan: LearningExperiencePlan = {
      id: "no-skip-claim-then-recall",
      schemaVersion: "candidate-v0",
      mode: "BUILD",
      sourceLearningNeedRef: "need-no-skip",
      targets: [...school.targets, ...recall.targets],
      skeletonId: school.skeletonId,
      contextFrameId: school.contextFrameId,
      activeGoalId: school.activeGoalId,
      steps: [school.steps[0]!, recall.steps[0]!],
      completionPolicy: completeAll([school.steps[0]!, recall.steps[0]!]),
      provenance: FIXTURE_PROVENANCE,
    };
    const run = expectReadyRun(plan);
    const issued = issueCurrentStep({
      run,
      now,
    });
    expect(issued.ok).toBe(false);
    if (issued.ok) {
      return;
    }
    expect(issued.run.status).toBe("BLOCKED");
    expect(issued.run.currentStepIndex).toBe(0);
    expect(issued.run.stepRuns[1]?.status).toBe("PENDING");
    expect(issued.run.stepRuns[1]?.taskId).toBeUndefined();
    expect(issued.run.stepRuns[1]?.compilationTrace).toBeUndefined();
    expect(issued.run.stepRuns[1]?.issuedAt).toBeUndefined();
  });
});

describe("Candidate V0 experience execution — illegal transitions", () => {
  it("rejects completion before a task is issued", () => {
    const run = expectReadyRun(createSafeLexicalRecallPlan(homeBreakfastFrame));
    const completed = recordTaskCompletion({
      run,
      receipt: { taskId: "never-issued", completedAt: now },
    });
    expect(completed.ok).toBe(false);
    if (completed.ok) {
      return;
    }
    expect(completed.error.code).toBe(
      ExecutionErrorCode.EXEC_INVALID_STATE_TRANSITION,
    );
    expect(completed.run).toBe(run);
    expect(run.status).toBe("READY");
  });

  it("rejects a mismatched completion taskId", () => {
    const plan = createSafeLexicalRecallPlan(homeBreakfastFrame);
    const run = expectReadyRun(plan);
    const issued = issueCurrentStep({
      run,
      now,
    });
    expect(issued.ok).toBe(true);
    if (!issued.ok) {
      return;
    }
    const completed = recordTaskCompletion({
      run: issued.run,
      receipt: { taskId: "other-task", completedAt: now },
    });
    expect(completed.ok).toBe(false);
    if (completed.ok) {
      return;
    }
    expect(completed.error.code).toBe(ExecutionErrorCode.EXEC_TASK_ID_MISMATCH);
    expect(issued.run.status).toBe("TASK_ISSUED");
  });

  it("rejects a duplicate completion receipt", () => {
    const plan = createSafeLexicalRecallPlan(homeBreakfastFrame);
    const run = expectReadyRun(plan);
    const issued = issueCurrentStep({
      run,
      now,
    });
    expect(issued.ok).toBe(true);
    if (!issued.ok) {
      return;
    }
    const receipt = {
      taskId: issued.issuedTask!.id,
      completedAt: now,
    };
    const first = recordTaskCompletion({ run: issued.run, receipt });
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    const second = recordTaskCompletion({ run: first.run, receipt });
    expect(second.ok).toBe(false);
    if (second.ok) {
      return;
    }
    expect(second.error.code).toBe(ExecutionErrorCode.EXEC_DUPLICATE_COMPLETION);
    expect(first.run.status).toBe("COMPLETED");
  });

  it("rejects issuing from BLOCKED or COMPLETED, and completion from ABORTED", () => {
    const meal = createMealBuildPlan(homeBreakfastFrame);
    const blocked = issueCurrentStep({
      run: expectReadyRun(meal),
      now,
    });
    expect(blocked.ok).toBe(false);
    if (blocked.ok) {
      return;
    }
    const reissue = issueCurrentStep({
      run: blocked.run,
      now,
    });
    expect(reissue.ok).toBe(false);
    if (reissue.ok) {
      return;
    }
    expect(reissue.error.code).toBe(ExecutionErrorCode.EXEC_CURRENT_STEP_BLOCKED);

    const recall = createSafeLexicalRecallPlan(homeBreakfastFrame);
    const issued = issueCurrentStep({
      run: expectReadyRun(recall),
      now,
    });
    expect(issued.ok).toBe(true);
    if (!issued.ok) {
      return;
    }
    const completed = recordTaskCompletion({
      run: issued.run,
      receipt: { taskId: issued.issuedTask!.id, completedAt: now },
    });
    expect(completed.ok).toBe(true);
    if (!completed.ok) {
      return;
    }
    const afterComplete = issueCurrentStep({
      run: completed.run,
      now,
    });
    expect(afterComplete.ok).toBe(false);
    if (afterComplete.ok) {
      return;
    }
    expect(afterComplete.error.code).toBe(
      ExecutionErrorCode.EXEC_INVALID_STATE_TRANSITION,
    );

    const aborted = abortExperienceRun({
      run: expectReadyRun(recall),
      reason: "caller stopped the run",
      now,
    });
    expect(aborted.ok).toBe(true);
    if (!aborted.ok) {
      return;
    }
    const afterAbort = recordTaskCompletion({
      run: aborted.run,
      receipt: { taskId: "any", completedAt: now },
    });
    expect(afterAbort.ok).toBe(false);
    if (afterAbort.ok) {
      return;
    }
    expect(afterAbort.error.code).toBe(
      ExecutionErrorCode.EXEC_INVALID_STATE_TRANSITION,
    );
  });
});

describe("Candidate V0 experience execution — immutability", () => {
  it("does not mutate the original run or the caller plan", () => {
    const plan = createSafeLexicalRecallPlan(homeBreakfastFrame);
    const originalStepId = plan.steps[0]!.id;
    const run = expectReadyRun(plan);
    const beforeStatus = run.status;
    const beforeSteps = run.stepRuns;

    const issued = applyExperienceCommand(run, {
      kind: "ISSUE_CURRENT_STEP",
    }, { now });
    expect(issued.ok).toBe(true);
    if (!issued.ok) {
      return;
    }

    plan.steps[0]!.id = "mutated-after-start";
    expect(run.planSnapshot.plan.steps[0]?.id).toBe(originalStepId);
    expect(issued.run.planSnapshot.plan.steps[0]?.id).toBe(originalStepId);
    expect(run.status).toBe(beforeStatus);
    expect(run.stepRuns).toBe(beforeSteps);
    expect(issued.run.stepRuns).not.toBe(run.stepRuns);
    issued.run.stepRuns.push({
      stepId: "extra",
      status: "PENDING",
    });
    expect(run.stepRuns).toHaveLength(1);
  });
});
