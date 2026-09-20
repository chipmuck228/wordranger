import "server-only";

/**
 * Server-authoritative Meal BUILD Context Lab controller.
 * Orchestrates Candidate steps and frozen-task assignment/submission.
 * Does not grade, inspect AnswerKey, or call processEvidence.
 */

import {
  CONTEXT_LAB_ERROR_CODES,
  CONTEXT_LAB_SUBMIT_REJECTED_MESSAGE,
  type ContextLabCurrentScreen,
} from "@/components/context-lab/types";
import { FROZEN_RUNTIME_CAPABILITIES } from "@/contextual-learning/candidate-v0/capabilities/capability-registry";
import { findProfile } from "@/contextual-learning/candidate-v0/domain/lexeme-sense";
import {
  isGuidedExperienceStep,
  type ExperienceTarget,
  type LearningExperiencePlan,
  type ResolvedTargetSnapshot,
  type RuntimeCapability,
} from "@/contextual-learning/candidate-v0/domain/types";
import { MEAL_SENSE } from "@/contextual-learning/candidate-v0/fixtures/meal/knowledge";
import {
  createExperienceRun,
  createPublicGuidedActivity,
  issueCurrentStep,
  recordFrozenTaskCompletion,
  recordGuidedActivityCompletion,
} from "@/contextual-learning/candidate-v0/execution";
import { ExecutionErrorCode } from "@/contextual-learning/candidate-v0/execution/errors";
import type { PublicGuidedActivity } from "@/contextual-learning/candidate-v0/execution/guided-activity";
import type { ExperienceRun } from "@/contextual-learning/candidate-v0/execution/types";
import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import type { TaskAnswerKey } from "@/domain/tasks/task-answer-key";
import type { LearningRepository } from "@/domain/learning/learning-repository";
import type { LearningEvidence } from "@/domain/learning/evidence.types";
import type { LearningTaskRepository } from "@/domain/tasks/learning-task-repository";
import { TaskProtocolError } from "@/domain/tasks/task-evaluator";
import {
  planExperience,
  type ExperiencePlanningInput,
} from "@/contextual-learning/candidate-v0/planning";
import {
  findPlannerFrame,
  findPlannerSkeleton,
  PLANNER_SENSE_PROFILES,
  PLANNER_SUPPORT_BLOCKS,
} from "@/contextual-learning/candidate-v0/planning/plan-variant-registry";
import { resolveContextSnapshot } from "@/contextual-learning/candidate-v0/validation/resolve-context";
import { validateExperiencePlan } from "@/contextual-learning/candidate-v0/validation/validate-experience-plan";
import { V1_PLACEHOLDER_USER_ID } from "@/server/auth/v1-user";
import { withPersistenceTimeout } from "@/lib/runtime/persistence-timeout";
import { submitTaskAction } from "@/server/tasks/submit-task-action";
import {
  errorScreen,
  notFoundRunScreen,
  staleRunScreen,
} from "./context-lab-errors";
import { contextLabFrozenTaskId } from "./context-lab-frozen-task-id";
import { CONTEXT_LAB_FROZEN_RENDERER_GAME_ID } from "./context-lab-frozen-renderer";
import {
  contextLabFeedbackFromEvaluation,
  contextLabFeedbackFromEvidence,
} from "./context-lab-public-feedback";
import {
  CONTEXT_LAB_RUN_SCHEMA_VERSION,
  type ContextLabRunRecord,
  type ContextLabRunRepository,
} from "./context-lab-run.types";
import { ensureAssignedGeneratedTask } from "./ensure-assigned-generated-task";
import { HOME_BREAKFAST_FRAME_ID } from "./meal-presentation-map";
import {
  presentFrozenTaskScreen,
  presentGuidedScreen,
  presentRecordedScreen,
  progressForIssuedRun,
} from "./present-context-lab-screen";
import { toGeneratedLearningTask } from "./to-generated-learning-task";

const TYPING_CAPABILITY = FROZEN_RUNTIME_CAPABILITIES.find(
  (capability) => capability.id === "frozen-text-input:TYPE",
);

const MAX_RESPONSE_TIME_MS = 120_000;

export interface MealContextLabControllerOptions {
  repository: ContextLabRunRepository;
  learningTasks: LearningTaskRepository;
  learning: LearningRepository;
  userId?: string;
  enabled?: boolean;
  now?: () => string;
  createId?: () => string;
  planningInput?: ExperiencePlanningInput;
}

export interface SubmitContextLabFrozenTaskInput {
  runId: string;
  revision: number;
  taskId: string;
  action: {
    kind: "TEXT_INPUT";
    value: string;
  };
  responseTimeMs?: number | null;
}

export class MealContextLabController {
  private readonly repository: ContextLabRunRepository;
  private readonly learningTasks: LearningTaskRepository;
  private readonly learning: LearningRepository;
  private readonly userId: string;
  private readonly enabled: boolean;
  private readonly now: () => string;
  private readonly createId: () => string;
  private readonly planningInput?: ExperiencePlanningInput;

  constructor(options: MealContextLabControllerOptions) {
    this.repository = options.repository;
    this.learningTasks = options.learningTasks;
    this.learning = options.learning;
    this.userId = options.userId ?? V1_PLACEHOLDER_USER_ID;
    this.enabled = options.enabled ?? true;
    this.now = options.now ?? (() => new Date().toISOString());
    this.createId = options.createId ?? (() => crypto.randomUUID());
    this.planningInput = options.planningInput;
  }

  async start(): Promise<ContextLabCurrentScreen> {
    if (!this.enabled) {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.FEATURE_DISABLED);
    }
    const prepared = this.createIssuedRun();
    if ("screen" in prepared) {
      return prepared.screen;
    }
    const createdAt = this.now();
    await this.repository.create({
      id: prepared.run.id,
      userId: this.userId,
      schemaVersion: CONTEXT_LAB_RUN_SCHEMA_VERSION,
      experienceId: prepared.run.experienceId,
      experienceRun: prepared.run,
      revision: 0,
      createdAt,
      updatedAt: createdAt,
    });
    return this.toPublicScreen(prepared.run, 0, prepared.issued);
  }

  async acknowledge(input: {
    runId: string;
    revision: number;
    activityId: string;
  }): Promise<ContextLabCurrentScreen> {
    if (!this.enabled) {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.FEATURE_DISABLED);
    }
    const record = await this.repository.get({
      runId: input.runId,
      userId: this.userId,
    });
    if (!record) {
      return notFoundRunScreen();
    }
    if (record.revision !== input.revision) {
      return staleRunScreen();
    }
    if (record.experienceRun.status !== "GUIDED_ACTIVITY_ISSUED") {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_ACK_REJECTED, {
        recoverable: true,
      });
    }
    const current = record.experienceRun.stepRuns[record.experienceRun.currentStepIndex];
    if (!current?.activityId || current.activityId !== input.activityId) {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_ACK_REJECTED, {
        recoverable: true,
      });
    }

    const completedAt = this.now();
    const recorded = recordGuidedActivityCompletion({
      run: record.experienceRun,
      receipt: {
        activityId: input.activityId,
        completedAt,
      },
      now: completedAt,
    });
    if (!recorded.ok) {
      return errorScreen(mapAckError(recorded.error.code), {
        recoverable: true,
        detail: recorded.error.code,
      });
    }

    const issued = issueCurrentStep({
      run: recorded.run,
      now: completedAt,
      createId: frozenTaskCreateId(recorded.run),
    });
    if (!issued.ok) {
      return errorScreen(mapIssueError(issued.error.code), {
        detail: issued.error.code,
      });
    }

    if (issued.issuedTask) {
      if (!issued.answerKey) {
        return errorScreen(CONTEXT_LAB_ERROR_CODES.FROZEN_COMPILATION_FAILURE);
      }
      const assigned = await withPersistenceTimeout(
        this.assignIssuedTask(issued.run, issued.issuedTask, issued.answerKey),
      );
      if (!assigned.ok) {
        return assigned.screen;
      }
    }

    const saved = await withPersistenceTimeout(
      this.repository.saveIfRevision({
        runId: input.runId,
        userId: this.userId,
        expectedRevision: input.revision,
        nextRun: issued.run,
        updatedAt: completedAt,
      }),
    );
    if (!saved.ok) {
      return saved.reason === "REVISION_CONFLICT"
        ? staleRunScreen()
        : notFoundRunScreen();
    }
    return this.toPublicScreen(issued.run, saved.revision, {
      issuedActivity: issued.issuedActivity,
      issuedTask: issued.issuedTask,
    });
  }

  async submitFrozenTask(
    input: SubmitContextLabFrozenTaskInput,
  ): Promise<ContextLabCurrentScreen> {
    if (!this.enabled) {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.FEATURE_DISABLED);
    }
    const rejected = rejectMalformedSubmit(input);
    if (rejected) {
      return rejected;
    }

    const record = await this.repository.get({
      runId: input.runId,
      userId: this.userId,
    });
    if (!record) {
      return notFoundRunScreen();
    }
    if (record.userId !== this.userId) {
      return notFoundRunScreen();
    }
    if (record.revision !== input.revision) {
      if (record.experienceRun.status === "COMPLETED") {
        return this.presentCompleted(record, input.taskId);
      }
      return staleRunScreen();
    }

    const current = record.experienceRun.stepRuns[record.experienceRun.currentStepIndex];
    if (record.experienceRun.status === "COMPLETED") {
      return this.presentCompleted(record, input.taskId);
    }
    if (record.experienceRun.status !== "FROZEN_TASK_ISSUED") {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_SUBMIT_REJECTED, {
        message: CONTEXT_LAB_SUBMIT_REJECTED_MESSAGE,
        recoverable: true,
      });
    }
    if (!current?.taskId || current.taskId !== input.taskId) {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_SUBMIT_REJECTED, {
        message: CONTEXT_LAB_SUBMIT_REJECTED_MESSAGE,
        recoverable: true,
      });
    }

    const assigned = await withPersistenceTimeout(
      this.learningTasks.getTaskForEvaluation(input.taskId),
    );
    if (!assigned) {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_TASK_CONFLICT, {
        message: CONTEXT_LAB_SUBMIT_REJECTED_MESSAGE,
        recoverable: false,
      });
    }
    const contract = assigned.task.publicTask.responseContract;
    if (contract.kind !== "TEXT_INPUT") {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_SUBMIT_REJECTED, {
        message: CONTEXT_LAB_SUBMIT_REJECTED_MESSAGE,
        recoverable: true,
      });
    }
    if (input.action.value.length > contract.maxLength) {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_SUBMIT_REJECTED, {
        message: CONTEXT_LAB_SUBMIT_REJECTED_MESSAGE,
        recoverable: true,
      });
    }

    const occurredAt = this.now();
    try {
      const submitted = await withPersistenceTimeout(
        submitTaskAction({
          taskId: input.taskId,
          action: {
            kind: "TEXT_INPUT",
            value: input.action.value,
            taskId: input.taskId,
            occurredAt,
            responseTimeMs: boundResponseTimeMs(input.responseTimeMs),
            hintCount: 0,
          },
          userId: this.userId,
          sessionId: record.id,
          gameId: CONTEXT_LAB_FROZEN_RENDERER_GAME_ID,
          evidenceId: this.createId(),
          learningTaskRepository: this.learningTasks,
          learningRepository: this.learning,
          now: occurredAt,
          createId: this.createId,
        }),
      );
      return this.completeAfterEvidence({
        record,
        taskId: input.taskId,
        occurredAt,
        feedback: contextLabFeedbackFromEvaluation(submitted.evaluation),
        retryOnCasConflict: true,
      });
    } catch (error) {
      if (
        error instanceof TaskProtocolError &&
        error.code === "TASK_ALREADY_COMPLETED"
      ) {
        return this.reconcileExistingEvidence(record, input.taskId);
      }
      if (error instanceof TaskProtocolError) {
        return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_SUBMIT_REJECTED, {
          message: CONTEXT_LAB_SUBMIT_REJECTED_MESSAGE,
          recoverable: true,
        });
      }
      throw error;
    }
  }

  async restart(): Promise<ContextLabCurrentScreen> {
    return this.start();
  }

  async loadCurrent(input: { runId: string }): Promise<ContextLabCurrentScreen> {
    if (!this.enabled) {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.FEATURE_DISABLED);
    }
    const record = await this.repository.get({
      runId: input.runId,
      userId: this.userId,
    });
    if (!record) {
      return notFoundRunScreen();
    }
    return this.presentStoredRun(record);
  }

  private async assignIssuedTask(
    run: ExperienceRun,
    publicTask: PublicLearningTask,
    answerKey: TaskAnswerKey,
  ): Promise<{ ok: true } | { ok: false; screen: ContextLabCurrentScreen }> {
    const ensured = await ensureAssignedGeneratedTask({
      tasks: this.learningTasks,
      task: toGeneratedLearningTask({ publicTask, answerKey }),
      assignment: {
        userId: this.userId,
        sessionId: run.id,
      },
    });
    if (!ensured.ok) {
      return {
        ok: false,
        screen: errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_TASK_CONFLICT, {
          message: CONTEXT_LAB_SUBMIT_REJECTED_MESSAGE,
          recoverable: false,
        }),
      };
    }
    return { ok: true };
  }

  private async completeAfterEvidence(input: {
    record: ContextLabRunRecord;
    taskId: string;
    occurredAt: string;
    feedback: ReturnType<typeof contextLabFeedbackFromEvaluation>;
    retryOnCasConflict?: boolean;
  }): Promise<ContextLabCurrentScreen> {
    const recorded = recordFrozenTaskCompletion({
      run: input.record.experienceRun,
      receipt: {
        taskId: input.taskId,
        completedAt: input.occurredAt,
      },
      now: input.occurredAt,
    });
    if (!recorded.ok) {
      if (
        recorded.error.code === ExecutionErrorCode.EXEC_DUPLICATE_COMPLETION ||
        input.record.experienceRun.status === "COMPLETED"
      ) {
        return this.presentCompleted(input.record, input.taskId);
      }
      return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_SUBMIT_REJECTED, {
        message: CONTEXT_LAB_SUBMIT_REJECTED_MESSAGE,
        recoverable: true,
        detail: recorded.error.code,
      });
    }

    const saved = await withPersistenceTimeout(
      this.repository.saveIfRevision({
        runId: input.record.id,
        userId: this.userId,
        expectedRevision: input.record.revision,
        nextRun: recorded.run,
        updatedAt: input.occurredAt,
      }),
    );
    if (!saved.ok) {
      const latest = await this.repository.get({
        runId: input.record.id,
        userId: this.userId,
      });
      if (latest && input.retryOnCasConflict) {
        return this.reconcileExistingEvidence(latest, input.taskId);
      }
      if (latest?.experienceRun.status === "COMPLETED") {
        return this.presentCompleted(latest, input.taskId);
      }
      return staleRunScreen();
    }
    return presentRecordedScreen({
      handle: { runId: input.record.id, revision: saved.revision },
      feedback: input.feedback,
      progress: progressForIssuedRun(recorded.run),
    });
  }

  private async reconcileExistingEvidence(
    record: ContextLabRunRecord,
    taskId: string,
  ): Promise<ContextLabCurrentScreen> {
    const evidence = await this.findTaskEvidence(record, taskId);
    if (!evidence) {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_SUBMIT_REJECTED, {
        message: CONTEXT_LAB_SUBMIT_REJECTED_MESSAGE,
        recoverable: true,
      });
    }
    if (record.experienceRun.status === "COMPLETED") {
      return presentRecordedScreen({
        handle: { runId: record.id, revision: record.revision },
        feedback: contextLabFeedbackFromEvidence(evidence),
        progress: progressForIssuedRun(record.experienceRun),
      });
    }
    return this.completeAfterEvidence({
      record,
      taskId,
      occurredAt: this.now(),
      feedback: contextLabFeedbackFromEvidence(evidence),
      retryOnCasConflict: false,
    });
  }

  private async presentCompleted(
    record: ContextLabRunRecord,
    taskId: string,
  ): Promise<ContextLabCurrentScreen> {
    const current = record.experienceRun.stepRuns[record.experienceRun.currentStepIndex];
    if (current?.taskId && current.taskId !== taskId) {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_SUBMIT_REJECTED, {
        message: CONTEXT_LAB_SUBMIT_REJECTED_MESSAGE,
        recoverable: true,
      });
    }
    const evidence = await this.findTaskEvidence(record, taskId);
    if (!evidence) {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_SUBMIT_REJECTED, {
        message: CONTEXT_LAB_SUBMIT_REJECTED_MESSAGE,
        recoverable: true,
      });
    }
    return presentRecordedScreen({
      handle: { runId: record.id, revision: record.revision },
      feedback: contextLabFeedbackFromEvidence(evidence),
      progress: progressForIssuedRun(record.experienceRun),
    });
  }

  private async findTaskEvidence(
    record: ContextLabRunRecord,
    taskId: string,
  ): Promise<LearningEvidence | null> {
    const assigned = await this.learningTasks.getTaskForEvaluation(taskId);
    if (!assigned) {
      return null;
    }
    const items = await this.learning.getEvidenceForLexeme(
      this.userId,
      assigned.task.publicTask.lexemeId,
    );
    return (
      items.find(
        (item) =>
          item.taskId === taskId &&
          item.userId === this.userId &&
          item.sessionId === record.id,
      ) ?? null
    );
  }

  private createIssuedRun():
    | { run: ExperienceRun; issued: IssuedPayload }
    | { screen: ContextLabCurrentScreen } {
    const planned = planExperience(
      this.planningInput ?? mealBuildPlanningInput(),
    );
    if (!planned.ok) {
      return {
        screen: errorScreen(CONTEXT_LAB_ERROR_CODES.PLANNER_FAILURE, {
          detail: planned.error.code,
        }),
      };
    }

    const frame = findPlannerFrame(planned.plan.contextFrameId);
    const skeleton = findPlannerSkeleton(planned.plan.skeletonId);
    if (
      !frame ||
      !skeleton ||
      planned.plan.contextFrameId !== HOME_BREAKFAST_FRAME_ID
    ) {
      return {
        screen: errorScreen(CONTEXT_LAB_ERROR_CODES.MISSING_PUBLIC_PRESENTATION),
      };
    }

    const validated = validateExperiencePlan({
      plan: planned.plan,
      frame,
      skeleton,
      capabilities:
        this.planningInput?.runtimeCapabilities ?? typingCapabilities(),
      supportBlocks: PLANNER_SUPPORT_BLOCKS,
      senseProfiles: PLANNER_SENSE_PROFILES,
    });
    if (!validated.ok) {
      return {
        screen: errorScreen(CONTEXT_LAB_ERROR_CODES.PLAN_VALIDATION_FAILURE, {
          detail: validated.issues[0]?.code,
        }),
      };
    }

    const createdAt = this.now();
    const created = createExperienceRun({
      plan: planned.plan,
      resolvedContext: resolveContextSnapshot(
        frame,
        skeleton,
        planned.plan.activeGoalId,
      ),
      resolvedTargets: resolvePlanTargets(planned.plan),
      now: createdAt,
      createId: this.createId,
    });
    if (!created.ok) {
      return {
        screen: errorScreen(CONTEXT_LAB_ERROR_CODES.PLAN_VALIDATION_FAILURE, {
          detail: created.error.code,
        }),
      };
    }

    const issued = issueCurrentStep({
      run: created.run,
      now: createdAt,
      createId: frozenTaskCreateId(created.run),
    });
    if (!issued.ok) {
      return {
        screen: errorScreen(mapIssueError(issued.error.code), {
          detail: issued.error.code,
        }),
      };
    }
    return {
      run: issued.run,
      issued: {
        issuedActivity: issued.issuedActivity,
        issuedTask: issued.issuedTask,
      },
    };
  }

  private async presentStoredRun(
    record: ContextLabRunRecord,
  ): Promise<ContextLabCurrentScreen> {
    const run = record.experienceRun;
    const current = run.stepRuns[run.currentStepIndex];
    const progress = progressForIssuedRun(run);
    const handle = { runId: run.id, revision: record.revision };
    if (run.status === "GUIDED_ACTIVITY_ISSUED" && current?.activityId) {
      const step = run.planSnapshot.plan.steps[run.currentStepIndex];
      if (!step || !isGuidedExperienceStep(step)) {
        return errorScreen(CONTEXT_LAB_ERROR_CODES.MISSING_PUBLIC_PRESENTATION);
      }
      return presentGuidedScreen({
        handle,
        activity: createPublicGuidedActivity({
          runId: run.id,
          experienceId: run.experienceId,
          contextFrameId: run.planSnapshot.resolvedContext.contextFrameId,
          step,
        }),
        resolvedContext: run.planSnapshot.resolvedContext,
        progress,
      });
    }
    if (run.status === "FROZEN_TASK_ISSUED" && current?.taskId) {
      const assigned = await this.learningTasks.getTaskForEvaluation(current.taskId);
      if (!assigned) {
        return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_TASK_CONFLICT, {
          message: CONTEXT_LAB_SUBMIT_REJECTED_MESSAGE,
        });
      }
      return presentFrozenTaskScreen({
        handle,
        task: assigned.task.publicTask,
        resolvedContext: run.planSnapshot.resolvedContext,
        progress,
      });
    }
    if (run.status === "COMPLETED" && current?.taskId) {
      return this.presentCompleted(record, current.taskId);
    }
    return notFoundRunScreen();
  }

  private toPublicScreen(
    run: ExperienceRun,
    revision: number,
    issued: IssuedPayload,
  ): ContextLabCurrentScreen {
    const handle = { runId: run.id, revision };
    const progress = progressForIssuedRun(run);
    if (issued.issuedActivity) {
      return presentGuidedScreen({
        handle,
        activity: issued.issuedActivity,
        resolvedContext: run.planSnapshot.resolvedContext,
        progress,
      });
    }
    if (issued.issuedTask) {
      return presentFrozenTaskScreen({
        handle,
        task: issued.issuedTask,
        resolvedContext: run.planSnapshot.resolvedContext,
        progress,
      });
    }
    return errorScreen(CONTEXT_LAB_ERROR_CODES.FROZEN_COMPILATION_FAILURE);
  }
}

interface IssuedPayload {
  issuedActivity?: PublicGuidedActivity;
  issuedTask?: PublicLearningTask;
}

export function mealBuildPlanningInput(
  capabilities: RuntimeCapability[] = typingCapabilities(),
): ExperiencePlanningInput {
  return {
    learningNeedRef: "need-opaque-ref",
    mode: "BUILD",
    targets: [spoonFormTarget()],
    allowedContextIds: [HOME_BREAKFAST_FRAME_ID],
    runtimeCapabilities: capabilities,
  };
}

function resolvePlanTargets(
  plan: LearningExperiencePlan,
): ResolvedTargetSnapshot[] {
  return plan.targets.map((target) => ({
    targetId: target.id,
    sense: target.sense,
    displayForm: findProfile(PLANNER_SENSE_PROFILES, target.sense)?.displayForm ?? "",
    focus: target.focus,
  }));
}

function spoonFormTarget(): ExperienceTarget {
  return {
    id: "target-spoon",
    sense: MEAL_SENSE.spoon,
    focus: "MEANING_TO_FORM",
  };
}

function typingCapabilities(): RuntimeCapability[] {
  if (!TYPING_CAPABILITY) {
    return [];
  }
  return [TYPING_CAPABILITY];
}

function frozenTaskCreateId(run: ExperienceRun): () => string {
  const step = run.planSnapshot.plan.steps[run.currentStepIndex];
  const taskId = step ? contextLabFrozenTaskId(run.id, step.id) : run.id;
  return () => taskId;
}

function boundResponseTimeMs(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return Math.min(Math.round(value), MAX_RESPONSE_TIME_MS);
}

function rejectMalformedSubmit(
  input: SubmitContextLabFrozenTaskInput,
): ContextLabCurrentScreen | null {
  const extra = Object.keys(input).filter(
    (key) =>
      key !== "runId" &&
      key !== "revision" &&
      key !== "taskId" &&
      key !== "action" &&
      key !== "responseTimeMs",
  );
  if (extra.length > 0) {
    return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_SUBMIT_REJECTED, {
      message: CONTEXT_LAB_SUBMIT_REJECTED_MESSAGE,
      recoverable: true,
    });
  }
  if (
    typeof input.runId !== "string" ||
    typeof input.taskId !== "string" ||
    typeof input.revision !== "number" ||
    !input.action ||
    typeof input.action !== "object"
  ) {
    return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_SUBMIT_REJECTED, {
      message: CONTEXT_LAB_SUBMIT_REJECTED_MESSAGE,
      recoverable: true,
    });
  }
  const actionKeys = Object.keys(input.action);
  if (
    actionKeys.some((key) => key !== "kind" && key !== "value") ||
    input.action.kind !== "TEXT_INPUT" ||
    typeof input.action.value !== "string" ||
    input.action.value.trim().length === 0
  ) {
    return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_SUBMIT_REJECTED, {
      message: CONTEXT_LAB_SUBMIT_REJECTED_MESSAGE,
      recoverable: true,
    });
  }
  return null;
}

function mapIssueError(code: string): (typeof CONTEXT_LAB_ERROR_CODES)[keyof typeof CONTEXT_LAB_ERROR_CODES] {
  if (
    code === ExecutionErrorCode.EXEC_GUIDED_ENTITY_NOT_IN_CONTEXT ||
    code === ExecutionErrorCode.EXEC_GUIDED_FACT_NOT_IN_CONTEXT
  ) {
    return CONTEXT_LAB_ERROR_CODES.GUIDED_GROUNDING_FAILURE;
  }
  if (code.startsWith("COMPILATION_") || code === "EXP_RECALL_LEAKS_ANSWER") {
    return CONTEXT_LAB_ERROR_CODES.FROZEN_COMPILATION_FAILURE;
  }
  return CONTEXT_LAB_ERROR_CODES.PLANNER_FAILURE;
}

function mapAckError(code: string): (typeof CONTEXT_LAB_ERROR_CODES)[keyof typeof CONTEXT_LAB_ERROR_CODES] {
  if (
    code === ExecutionErrorCode.EXEC_ACTIVITY_ID_MISMATCH ||
    code === ExecutionErrorCode.EXEC_DUPLICATE_COMPLETION ||
    code === ExecutionErrorCode.EXEC_RECEIPT_KIND_MISMATCH ||
    code === ExecutionErrorCode.EXEC_INVALID_STATE_TRANSITION
  ) {
    return CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_ACK_REJECTED;
  }
  return CONTEXT_LAB_ERROR_CODES.PLANNER_FAILURE;
}
