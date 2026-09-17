import { describe, expect, it } from "vitest";
import { compileExperienceStep } from "@/contextual-learning/candidate-v0/compilation/compile-experience-step";
import { DomainErrorCode } from "@/contextual-learning/candidate-v0/domain/errors";
import { homeBreakfastFrame } from "@/contextual-learning/candidate-v0/fixtures/meal/contexts";
import { MEAL_PROFILES } from "@/contextual-learning/candidate-v0/fixtures/meal/knowledge";
import { createMealBuildPlan } from "@/contextual-learning/candidate-v0/fixtures/meal/plans";
import { mealSkeleton } from "@/contextual-learning/candidate-v0/fixtures/meal/skeleton";
import { MEAL_SUPPORTS } from "@/contextual-learning/candidate-v0/fixtures/meal/supports";
import { scienceTowerFrame } from "@/contextual-learning/candidate-v0/fixtures/school-challenge/contexts";
import { SCHOOL_PROFILES } from "@/contextual-learning/candidate-v0/fixtures/school-challenge/knowledge";
import { createSchoolBuildPlan } from "@/contextual-learning/candidate-v0/fixtures/school-challenge/plans";
import { schoolChallengeSkeleton } from "@/contextual-learning/candidate-v0/fixtures/school-challenge/skeleton";
import { classroomRulerFrame } from "@/contextual-learning/candidate-v0/fixtures/borrowing-sharing/contexts";
import { BORROW_PROFILES } from "@/contextual-learning/candidate-v0/fixtures/borrowing-sharing/knowledge";
import {
  createBorrowBuildPlan,
  createUnsupportedOrderStep,
} from "@/contextual-learning/candidate-v0/fixtures/borrowing-sharing/plans";
import { borrowingSharingSkeleton } from "@/contextual-learning/candidate-v0/fixtures/borrowing-sharing/skeleton";
import { profileMap, supportMap } from "@/contextual-learning/candidate-v0/fixtures/shared";
import { AnswerMode, EvidenceOutcome, PromptMode } from "@/domain/learning/evidence.types";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { DefaultTaskEvaluator } from "@/domain/tasks/default-task-evaluator";
import { createLearningEvidenceFromTaskEvaluation } from "@/domain/tasks/evidence-factory";
import { LearningTaskType } from "@/domain/tasks/task-type";
import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import { compilationRequest } from "./helpers";

const evaluator = new DefaultTaskEvaluator();

function expectFrozenTask(task: PublicLearningTask): void {
  expect(task.protocolVersion).toBe("v1");
  expect(task.lexemeId.length).toBeGreaterThan(0);
  expect(["CHOICE", "TEXT_INPUT"]).toContain(task.responseContract.kind);
}

function runEvidence(task: PublicLearningTask, answerKey: Parameters<DefaultTaskEvaluator["evaluate"]>[1], action: Parameters<DefaultTaskEvaluator["evaluate"]>[2]) {
  const evaluation = evaluator.evaluate(task, answerKey, action);
  const evidence = createLearningEvidenceFromTaskEvaluation({
    task,
    answerKey,
    evaluation,
    userId: "user-candidate-v0",
    sessionId: "session-candidate-v0",
    gameId: "RANGER_TRIAL",
    evidenceId: "ev-candidate-v0",
  });
  expect(evidence.lexemeId).toBe(task.lexemeId);
  expect(evidence.taskId).toBe(task.id);
  expect(evidence.outcome).toBeDefined();
  return { evaluation, evidence };
}

describe("Candidate V0 compilation contract", () => {
  it("compiles the meal spoon IDENTIFY step to a frozen CHOICE task", () => {
    const plan = createMealBuildPlan(homeBreakfastFrame);
    const step = plan.steps[0];
    const compiled = compileExperienceStep(
      compilationRequest({
        plan,
        step,
        frame: homeBreakfastFrame,
        skeleton: mealSkeleton,
        profiles: profileMap(MEAL_PROFILES),
      }),
      { supportBlocks: supportMap(MEAL_SUPPORTS) },
    );
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      return;
    }
    const task = compiled.value.publicLearningTask;
    expectFrozenTask(task);
    expect(task.taskType).toBe(LearningTaskType.MEANING_CHOICE);
    expect(task.targetSkill).toBe(VocabularySkill.MEANING_RECOGNITION);
    expect(task.answerMode).toBe(AnswerMode.MULTIPLE_CHOICE);
    expect(task.promptMode).toBe(PromptMode.CONTEXT_TO_WORD);
    expect(task.responseContract.kind).toBe("CHOICE");

    const optionId = compiled.value.answerKey.correctOptionIds[0];
    const { evaluation, evidence } = runEvidence(task, compiled.value.answerKey, {
      kind: "CHOICE",
      taskId: task.id,
      optionId,
      hintCount: 0,
      responseTimeMs: 800,
      occurredAt: "2026-09-17T12:00:00.000Z",
    });
    expect(evaluation.outcome).toBe(EvidenceOutcome.INDEPENDENT_CORRECT);
    expect(evidence.skill).toBe(VocabularySkill.MEANING_RECOGNITION);
  });

  it("compiles the school try/success CLAIM_CHOICE step", () => {
    const plan = createSchoolBuildPlan(scienceTowerFrame);
    const step = plan.steps[0];
    const compiled = compileExperienceStep(
      compilationRequest({
        plan,
        step,
        frame: scienceTowerFrame,
        skeleton: schoolChallengeSkeleton,
        profiles: profileMap(SCHOOL_PROFILES),
      }),
    );
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      return;
    }
    const task = compiled.value.publicLearningTask;
    expectFrozenTask(task);
    expect(task.responseContract.kind).toBe("CHOICE");
    const { evaluation } = runEvidence(task, compiled.value.answerKey, {
      kind: "CHOICE",
      taskId: task.id,
      optionId: compiled.value.answerKey.correctOptionIds[0],
      hintCount: 0,
      responseTimeMs: 900,
      occurredAt: "2026-09-17T12:00:00.000Z",
    });
    expect(evaluation.isCorrect).toBe(true);
  });

  it("compiles borrow/lend RELATION_CHOICE and scores it with the frozen evaluator", () => {
    const plan = createBorrowBuildPlan(classroomRulerFrame);
    const step = plan.steps[0];
    const compiled = compileExperienceStep(
      compilationRequest({
        plan,
        step,
        frame: classroomRulerFrame,
        skeleton: borrowingSharingSkeleton,
        profiles: profileMap(BORROW_PROFILES),
      }),
    );
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      return;
    }
    expectFrozenTask(compiled.value.publicLearningTask);
    const { evidence } = runEvidence(
      compiled.value.publicLearningTask,
      compiled.value.answerKey,
      {
        kind: "CHOICE",
        taskId: compiled.value.publicLearningTask.id,
        optionId: compiled.value.answerKey.correctOptionIds[0],
        hintCount: 1,
        responseTimeMs: 1100,
        occurredAt: "2026-09-17T12:00:00.000Z",
      },
    );
    expect(evidence.outcome).toBe(EvidenceOutcome.ASSISTED_CORRECT);
  });

  it("compiles meal RECALL to frozen TEXT_INPUT", () => {
    const plan = createMealBuildPlan(homeBreakfastFrame);
    const step = plan.steps.find((item) => item.purpose === "RECALL");
    expect(step).toBeDefined();
    if (!step) {
      return;
    }
    const compiled = compileExperienceStep(
      compilationRequest({
        plan,
        step,
        frame: homeBreakfastFrame,
        skeleton: mealSkeleton,
        profiles: profileMap(MEAL_PROFILES),
      }),
    );
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      return;
    }
    expect(compiled.value.publicLearningTask.taskType).toBe(
      LearningTaskType.ACTIVE_RECALL_TYPING,
    );
    const { evaluation } = runEvidence(
      compiled.value.publicLearningTask,
      compiled.value.answerKey,
      {
        kind: "TEXT_INPUT",
        taskId: compiled.value.publicLearningTask.id,
        value: "spoon",
        hintCount: 0,
        responseTimeMs: 700,
        occurredAt: "2026-09-17T12:00:00.000Z",
      },
    );
    expect(evaluation.outcome).toBe(EvidenceOutcome.INDEPENDENT_CORRECT);
  });

  it("returns a capability gap for ORDERED_ENTITY_REFS instead of faking a task", () => {
    const plan = createBorrowBuildPlan(classroomRulerFrame);
    const compiled = compileExperienceStep(
      compilationRequest({
        plan,
        step: createUnsupportedOrderStep(),
        frame: classroomRulerFrame,
        skeleton: borrowingSharingSkeleton,
        profiles: profileMap(BORROW_PROFILES),
      }),
    );
    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      return;
    }
    expect([
      DomainErrorCode.COMPILATION_UNSUPPORTED_RESPONSE_KIND,
      DomainErrorCode.EXP_NO_RUNTIME_CAPABILITY,
    ]).toContain(compiled.error.code);
  });
});
