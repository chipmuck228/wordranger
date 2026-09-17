import { describe, expect, it } from "vitest";
import { compileExperienceStep } from "@/contextual-learning/candidate-v0/compilation/compile-experience-step";
import { findSemanticProjection } from "@/contextual-learning/candidate-v0/compilation/semantic-projection";
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
  it("rejects meal IDENTIFY as situational reasoning, not meaning recognition", () => {
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
    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      return;
    }
    expect(compiled.error.code).toBe(DomainErrorCode.COMPILATION_SEMANTIC_MISMATCH);
  });

  it("rejects school CLAIM_CHOICE instead of emitting MEANING_RECOGNITION Evidence", () => {
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
    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      return;
    }
    expect(compiled.error.code).toBe(DomainErrorCode.COMPILATION_SEMANTIC_MISMATCH);
    expect(step.expectedResponse.kind).toBe("CLAIM_CHOICE");
  });

  it("rejects borrow/lend RELATION_CHOICE instead of mapping it to MEANING_CHOICE", () => {
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
    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      return;
    }
    expect(compiled.error.code).toBe(DomainErrorCode.COMPILATION_SEMANTIC_MISMATCH);
    expect(step.expectedResponse.kind).toBe("RELATION_CHOICE");
  });

  it("compiles meal RECALL through the lexical-form whitelist and frozen evaluator", () => {
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
    const target = plan.targets.find((item) => item.id === step.targetIds[0]);
    const projection = findSemanticProjection({
      semanticAction: step.semanticAction,
      responseKind: step.expectedResponse.kind,
      targetFocus: target?.focus ?? "CONTEXT_INTERPRETATION",
      stepPurpose: step.purpose,
    });
    expect(target?.focus).toBe("MEANING_TO_FORM");
    expect(step.purpose).toBe("RECALL");
    expect(projection?.id).toBe(compiled.value.trace.semanticProjectionId);
    expect(compiled.value.trace.semanticProjectionId).toBe(
      "lexical-form-type-recall-to-active-recall",
    );

    const task = compiled.value.publicLearningTask;
    expectFrozenTask(task);
    expect(task.taskType).toBe(LearningTaskType.ACTIVE_RECALL_TYPING);
    expect(task.targetSkill).toBe(VocabularySkill.ACTIVE_RECALL);
    expect(task.promptMode).toBe(PromptMode.MEANING_TO_WORD);
    expect(task.answerMode).toBe(AnswerMode.TYPING);
    expect(task.lexemeId).toBe("lex-spoon");
    expect(compiled.value.answerKey.targetLexemeId).toBe("lex-spoon");

    const { evaluation, evidence } = runEvidence(
      task,
      compiled.value.answerKey,
      {
        kind: "TEXT_INPUT",
        taskId: task.id,
        value: "spoon",
        hintCount: 0,
        responseTimeMs: 700,
        occurredAt: "2026-09-17T12:00:00.000Z",
      },
    );
    expect(evaluation.outcome).toBe(EvidenceOutcome.INDEPENDENT_CORRECT);
    expect(evaluation.skill).toBe(VocabularySkill.ACTIVE_RECALL);
    expect(evidence.skill).toBe(VocabularySkill.ACTIVE_RECALL);
    expect(evidence.taskType).toBe(LearningTaskType.ACTIVE_RECALL_TYPING);
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
