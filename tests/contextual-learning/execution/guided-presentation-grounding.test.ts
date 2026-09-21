import { describe, expect, it } from "vitest";
import { mealTestLexemeLoader } from "../content/helpers";
import {
  ExecutionErrorCode,
  applyExperienceCommand,
  createExperienceRun,
  issueCurrentStep,
  recordGuidedActivityCompletion,
} from "@/contextual-learning/candidate-v0/execution";
import type { ExperienceRun } from "@/contextual-learning/candidate-v0/execution";
import { classroomRulerFrame } from "@/contextual-learning/candidate-v0/fixtures/borrowing-sharing/contexts";
import { BORROW_PROFILES } from "@/contextual-learning/candidate-v0/fixtures/borrowing-sharing/knowledge";
import {
  createBorrowBuildPlan,
  createBorrowGuidedPerspectivePlan,
} from "@/contextual-learning/candidate-v0/fixtures/borrowing-sharing/plans";
import { borrowingSharingSkeleton } from "@/contextual-learning/candidate-v0/fixtures/borrowing-sharing/skeleton";
import {
  homeBreakfastFrame,
  mealPrefixForFrame,
  picnicLunchFrame,
  restaurantMealFrame,
} from "@/contextual-learning/candidate-v0/fixtures/meal/contexts";
import { MEAL_PROFILES } from "@/contextual-learning/candidate-v0/fixtures/meal/knowledge";
import { createMealBuildPlan } from "@/contextual-learning/candidate-v0/fixtures/meal/plans";
import { mealSkeleton } from "@/contextual-learning/candidate-v0/fixtures/meal/skeleton";
import { scienceTowerFrame } from "@/contextual-learning/candidate-v0/fixtures/school-challenge/contexts";
import { SCHOOL_PROFILES } from "@/contextual-learning/candidate-v0/fixtures/school-challenge/knowledge";
import {
  createSchoolBuildPlan,
  createSchoolGuidedPresentationPlan,
} from "@/contextual-learning/candidate-v0/fixtures/school-challenge/plans";
import { schoolChallengeSkeleton } from "@/contextual-learning/candidate-v0/fixtures/school-challenge/skeleton";
import { profileMap } from "@/contextual-learning/candidate-v0/fixtures/shared";
import type {
  GuidedExperienceStepSpec,
  LearningExperiencePlan,
} from "@/contextual-learning/candidate-v0/domain/types";
import { resolvedSnapshotFor } from "../helpers";

const now = "2026-09-17T12:00:00.000Z";
const HOME_PREFIX = mealPrefixForFrame(homeBreakfastFrame.id);
const ALL_PROFILES = profileMap([
  ...MEAL_PROFILES,
  ...SCHOOL_PROFILES,
  ...BORROW_PROFILES,
]);

function snapshotFor(plan: LearningExperiencePlan, frame: typeof homeBreakfastFrame, skeleton: typeof mealSkeleton) {
  return resolvedSnapshotFor(plan, frame, skeleton, ALL_PROFILES);
}

function expectReadyRun(
  plan: LearningExperiencePlan,
  frame: typeof homeBreakfastFrame,
  skeleton: typeof mealSkeleton,
) {
  const created = createExperienceRun({
    plan,
    ...snapshotFor(plan, frame, skeleton),
    now,
    createId: () => `run-${plan.id}`,
  });
  expect(created.ok).toBe(true);
  if (!created.ok) {
    throw new Error(created.error.message);
  }
  return created.run;
}

function forgeGuidedPresentation(
  plan: LearningExperiencePlan,
  stepIndex: number,
  presentation: GuidedExperienceStepSpec["presentation"],
): LearningExperiencePlan {
  const step = plan.steps[stepIndex];
  if (!step) {
    throw new Error(`Missing step ${stepIndex}`);
  }
  return {
    ...plan,
    id: `${plan.id}-forged-${stepIndex}`,
    steps: plan.steps.map((item, index) =>
      index === stepIndex
        ? ({
            ...item,
            presentation,
          } as GuidedExperienceStepSpec)
        : item,
    ),
  } as unknown as LearningExperiencePlan;
}

function expectGroundingFailure(
  issued: ReturnType<typeof issueCurrentStep>,
  code: string,
  fragment: string,
) {
  expect(issued.ok).toBe(false);
  if (issued.ok) {
    throw new Error("expected grounding failure");
  }
  expect(issued.error.code).toBe(code);
  expect(issued.error.message).toContain(fragment);
  expect(issued.error.path).toMatch(/^presentation\.(presentedEntityIds|presentedFactPredicates)\[\d+\]$/);
  expect("issuedActivity" in issued).toBe(false);
  expect("issuedTask" in issued).toBe(false);
  expect("answerKey" in issued).toBe(false);
  expect(issued.run.status).toBe("BLOCKED");
  const current = issued.run.stepRuns[issued.run.currentStepIndex];
  expect(current?.status).toBe("BLOCKED");
}

describe("Guided presentation grounding Candidate V0", () => {
  it("issues a valid Meal Guided Activity grounded in soup/spoon and suitable_for", () => {
    for (const frame of [homeBreakfastFrame, picnicLunchFrame, restaurantMealFrame]) {
      const plan = createMealBuildPlan(frame, { loadLexeme: mealTestLexemeLoader });
      const run = expectReadyRun(plan, frame, mealSkeleton);
      const present = issueCurrentStep({ run });
      expect(present.ok).toBe(true);
      if (!present.ok) {
        throw new Error(present.error.message);
      }
      expect(present.issuedActivity?.presentedEntityIds).toEqual(
        (plan.steps[0] as GuidedExperienceStepSpec).presentation.presentedEntityIds,
      );
      const snapshotIds = new Set(
        present.run.planSnapshot.resolvedContext.entityBindings.map((binding) => binding.entityId),
      );
      for (const entityId of present.issuedActivity?.presentedEntityIds ?? []) {
        expect(snapshotIds.has(entityId)).toBe(true);
      }

      const observed = recordGuidedActivityCompletion({
        run: present.run,
        receipt: {
          activityId: present.issuedActivity!.id,
          completedAt: now,
        },
      });
      expect(observed.ok).toBe(true);
      if (!observed.ok) {
        throw new Error(observed.error.message);
      }
      const relation = issueCurrentStep({ run: observed.run });
      expect(relation.ok).toBe(true);
      if (!relation.ok) {
        throw new Error(relation.error.message);
      }
      expect(relation.issuedActivity?.presentedFactPredicates).toEqual(["suitable_for"]);
      expect(
        relation.run.planSnapshot.resolvedContext.facts.some(
          (fact) => fact.predicate === "suitable_for",
        ),
      ).toBe(true);
    }
  });

  it("fails closed for an unknown presentedEntityId without stripping or issuing", () => {
    const plan = forgeGuidedPresentation(createMealBuildPlan(homeBreakfastFrame, { loadLexeme: mealTestLexemeLoader }), 0, {
      instruction: "Look at a ghost entity.",
      presentedEntityIds: ["ghost-entity"],
    });
    const issued = issueCurrentStep({
      run: expectReadyRun(plan, homeBreakfastFrame, mealSkeleton),
    });
    expectGroundingFailure(
      issued,
      ExecutionErrorCode.EXEC_GUIDED_ENTITY_NOT_IN_CONTEXT,
      "ghost-entity",
    );
  });

  it("fails closed for an unknown presentedFactPredicate without stripping or issuing", () => {
    const plan = forgeGuidedPresentation(createMealBuildPlan(homeBreakfastFrame, { loadLexeme: mealTestLexemeLoader }), 1, {
      instruction: "Notice a made-up relation.",
      presentedEntityIds: [`${HOME_PREFIX}-spoon`, `${HOME_PREFIX}-soup`],
      presentedFactPredicates: ["imaginary_relation"],
    });
    const run = expectReadyRun(plan, homeBreakfastFrame, mealSkeleton);
    const first = issueCurrentStep({ run });
    expect(first.ok).toBe(true);
    if (!first.ok) {
      throw new Error(first.error.message);
    }
    const acknowledged = recordGuidedActivityCompletion({
      run: first.run,
      receipt: { activityId: first.issuedActivity!.id, completedAt: now },
    });
    expect(acknowledged.ok).toBe(true);
    if (!acknowledged.ok) {
      throw new Error(acknowledged.error.message);
    }
    const issued = issueCurrentStep({ run: acknowledged.run });
    expectGroundingFailure(
      issued,
      ExecutionErrorCode.EXEC_GUIDED_FACT_NOT_IN_CONTEXT,
      "imaginary_relation",
    );
  });

  it("accepts multiple references only when every reference is grounded", () => {
    const valid = issueCurrentStep({
      run: expectReadyRun(
        createMealBuildPlan(homeBreakfastFrame, { loadLexeme: mealTestLexemeLoader }),
        homeBreakfastFrame,
        mealSkeleton,
      ),
    });
    expect(valid.ok).toBe(true);
    if (!valid.ok) {
      throw new Error(valid.error.message);
    }
    expect(valid.issuedActivity?.presentedEntityIds).toHaveLength(4);

    const mixed = forgeGuidedPresentation(createMealBuildPlan(homeBreakfastFrame, { loadLexeme: mealTestLexemeLoader }), 0, {
      instruction: "One unknown entity among valid ones.",
      presentedEntityIds: [
        `${HOME_PREFIX}-soup`,
        `${HOME_PREFIX}-spoon`,
        "unknown-tool",
      ],
    });
    expectGroundingFailure(
      issueCurrentStep({
        run: expectReadyRun(mixed, homeBreakfastFrame, mealSkeleton),
      }),
      ExecutionErrorCode.EXEC_GUIDED_ENTITY_NOT_IN_CONTEXT,
      "unknown-tool",
    );
  });

  it("does not advance the experience after a grounding failure", () => {
    const plan = forgeGuidedPresentation(createMealBuildPlan(homeBreakfastFrame, { loadLexeme: mealTestLexemeLoader }), 0, {
      instruction: "Ungrounded.",
      presentedEntityIds: ["missing-bowl"],
    });
    const issued = issueCurrentStep({
      run: expectReadyRun(plan, homeBreakfastFrame, mealSkeleton),
    });
    expect(issued.ok).toBe(false);
    if (issued.ok) {
      throw new Error("expected failure");
    }
    const retry = issueCurrentStep({ run: issued.run });
    expect(retry.ok).toBe(false);
    if (retry.ok) {
      throw new Error("blocked run must not re-issue");
    }
    expect(retry.error.code).toBe(ExecutionErrorCode.EXEC_CURRENT_STEP_BLOCKED);
    expect(retry.run.currentStepIndex).toBe(0);

    const command = applyExperienceCommand(issued.run, {
      kind: "ISSUE_CURRENT_STEP",
    });
    expect(command.ok).toBe(false);
    expect(command.run.currentStepIndex).toBe(0);

    const completion = recordGuidedActivityCompletion({
      run: issued.run,
      receipt: {
        activityId: "guided:forged:missing",
        completedAt: now,
      },
    });
    expect(completion.ok).toBe(false);
    expect(completion.run.status).toBe("BLOCKED");
  });

  it("grounds School Guided references while CLAIM_CHOICE stays unsupported", () => {
    const guided = createSchoolGuidedPresentationPlan(scienceTowerFrame);
    const issued = issueCurrentStep({
      run: expectReadyRun(guided, scienceTowerFrame, schoolChallengeSkeleton),
    });
    expect(issued.ok).toBe(true);
    if (!issued.ok) {
      throw new Error(issued.error.message);
    }
    const snapshot = issued.run.planSnapshot.resolvedContext;
    const entityIds = new Set(snapshot.entityBindings.map((binding) => binding.entityId));
    const predicates = new Set(snapshot.facts.map((fact) => fact.predicate));
    for (const entityId of issued.issuedActivity?.presentedEntityIds ?? []) {
      expect(entityIds.has(entityId)).toBe(true);
    }
    expect(issued.issuedActivity?.presentedFactPredicates).toEqual(["attempt_status"]);
    expect(predicates.has("attempt_status")).toBe(true);

    const claim = issueCurrentStep({
      run: expectReadyRun(
        createSchoolBuildPlan(scienceTowerFrame),
        scienceTowerFrame,
        schoolChallengeSkeleton,
      ),
    });
    expect(claim.ok).toBe(false);
    if (claim.ok) {
      throw new Error("CLAIM_CHOICE must stay unsupported");
    }
    expect(claim.classification?.kind).toBe("UNSUPPORTED");
    expect("issuedActivity" in claim).toBe(false);
    expect("issuedTask" in claim).toBe(false);
  });

  it("grounds Borrowing Guided references while RELATION_CHOICE stays unsupported", () => {
    const guided = createBorrowGuidedPerspectivePlan(classroomRulerFrame);
    const issued = issueCurrentStep({
      run: expectReadyRun(guided, classroomRulerFrame, borrowingSharingSkeleton),
    });
    expect(issued.ok).toBe(true);
    if (!issued.ok) {
      throw new Error(issued.error.message);
    }
    expect(issued.issuedActivity?.presentedEntityIds).toEqual(
      (guided.steps[0] as GuidedExperienceStepSpec).presentation.presentedEntityIds,
    );
    expect(issued.issuedActivity?.presentedFactPredicates).toEqual(["owns"]);
    const snapshot = issued.run.planSnapshot.resolvedContext;
    expect(snapshot.perspectiveBindings?.length).toBeGreaterThan(1);
    const entityIds = new Set(snapshot.entityBindings.map((binding) => binding.entityId));
    for (const entityId of issued.issuedActivity?.presentedEntityIds ?? []) {
      expect(entityIds.has(entityId)).toBe(true);
    }
    expect(
      snapshot.facts.some((fact) => fact.predicate === "owns"),
    ).toBe(true);

    const relation = issueCurrentStep({
      run: expectReadyRun(
        createBorrowBuildPlan(classroomRulerFrame),
        classroomRulerFrame,
        borrowingSharingSkeleton,
      ),
    });
    expect(relation.ok).toBe(false);
    if (relation.ok) {
      throw new Error("RELATION_CHOICE must stay unsupported");
    }
    expect(relation.classification?.kind).toBe("UNSUPPORTED");
    expect("issuedActivity" in relation).toBe(false);
    expect("issuedTask" in relation).toBe(false);
  });

  it("grounds against the frozen run snapshot, not a later mutated frame", () => {
    const plan = createMealBuildPlan(homeBreakfastFrame, { loadLexeme: mealTestLexemeLoader });
    const snapshot = snapshotFor(plan, homeBreakfastFrame, mealSkeleton);
    const created = createExperienceRun({
      plan,
      ...snapshot,
      now,
      createId: () => "run-frozen-grounding",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      throw new Error(created.error.message);
    }

    snapshot.resolvedContext.entityBindings.length = 0;
    snapshot.resolvedContext.facts.length = 0;

    const issued = issueCurrentStep({ run: created.run });
    expect(issued.ok).toBe(true);
    if (!issued.ok) {
      throw new Error(issued.error.message);
    }
    expect(issued.issuedActivity?.presentedEntityIds?.length).toBeGreaterThan(0);
    expect(
      created.run.planSnapshot.resolvedContext.entityBindings.some(
        (binding) => binding.entityId === `${HOME_PREFIX}-soup`,
      ),
    ).toBe(true);
  });

  it("does not infer identity from labels, prefixes, or serialized fact text", () => {
    const labelAsId = forgeGuidedPresentation(createMealBuildPlan(homeBreakfastFrame, { loadLexeme: mealTestLexemeLoader }), 0, {
      instruction: "Do not treat the label as an entity id.",
      presentedEntityIds: ["spoon"],
    });
    expectGroundingFailure(
      issueCurrentStep({
        run: expectReadyRun(labelAsId, homeBreakfastFrame, mealSkeleton),
      }),
      ExecutionErrorCode.EXEC_GUIDED_ENTITY_NOT_IN_CONTEXT,
      "spoon",
    );

    const prefixAsId = forgeGuidedPresentation(createMealBuildPlan(homeBreakfastFrame, { loadLexeme: mealTestLexemeLoader }), 0, {
      instruction: "Do not treat a prefix as an entity id.",
      presentedEntityIds: [HOME_PREFIX],
    });
    expectGroundingFailure(
      issueCurrentStep({
        run: expectReadyRun(prefixAsId, homeBreakfastFrame, mealSkeleton),
      }),
      ExecutionErrorCode.EXEC_GUIDED_ENTITY_NOT_IN_CONTEXT,
      HOME_PREFIX,
    );

    const substringPredicate = forgeGuidedPresentation(
      createMealBuildPlan(homeBreakfastFrame, { loadLexeme: mealTestLexemeLoader }),
      1,
      {
        instruction: "Do not substring-match predicates.",
        presentedEntityIds: [`${HOME_PREFIX}-spoon`],
        presentedFactPredicates: ["suitable"],
      },
    );
    const run = expectReadyRun(substringPredicate, homeBreakfastFrame, mealSkeleton);
    const first = issueCurrentStep({ run });
    expect(first.ok).toBe(true);
    if (!first.ok) {
      throw new Error(first.error.message);
    }
    const acknowledged = recordGuidedActivityCompletion({
      run: first.run,
      receipt: { activityId: first.issuedActivity!.id, completedAt: now },
    });
    expect(acknowledged.ok).toBe(true);
    if (!acknowledged.ok) {
      throw new Error(acknowledged.error.message);
    }
    expectGroundingFailure(
      issueCurrentStep({ run: acknowledged.run }),
      ExecutionErrorCode.EXEC_GUIDED_FACT_NOT_IN_CONTEXT,
      "suitable",
    );
  });

  it("rejects a structurally forged plan at runtime even when TypeScript would allow it", () => {
    const meal = createMealBuildPlan(homeBreakfastFrame, { loadLexeme: mealTestLexemeLoader });
    const forged = {
      ...meal,
      id: "forged-guided-unknown-entity",
      steps: [
        {
          ...meal.steps[0],
          presentation: {
            instruction: "Forged unknown entity",
            presentedEntityIds: ["not-in-snapshot"],
            presentedFactPredicates: ["suitable_for"],
          },
        },
        ...meal.steps.slice(1),
      ],
    } as unknown as LearningExperiencePlan;

    const created = createExperienceRun({
      plan: forged,
      ...snapshotFor(forged, homeBreakfastFrame, mealSkeleton),
      now,
      createId: () => "run-forged-grounding",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      throw new Error(created.error.message);
    }
    const issued = issueCurrentStep({ run: created.run });
    expectGroundingFailure(
      issued,
      ExecutionErrorCode.EXEC_GUIDED_ENTITY_NOT_IN_CONTEXT,
      "not-in-snapshot",
    );
  });

  it("does not mutate a frozen ExperienceRun argument on grounding failure", () => {
    const plan = forgeGuidedPresentation(createMealBuildPlan(homeBreakfastFrame, { loadLexeme: mealTestLexemeLoader }), 0, {
      instruction: "Unknown.",
      presentedEntityIds: ["absent"],
    });
    const run = expectReadyRun(plan, homeBreakfastFrame, mealSkeleton);
    const before: ExperienceRun = structuredClone(run);
    const issued = issueCurrentStep({ run });
    expect(issued.ok).toBe(false);
    expect(run).toEqual(before);
  });
});
