import "server-only";

/**
 * Server-authoritative Meal BUILD Context Lab controller.
 * Orchestrates Candidate steps and frozen-task assignment/submission.
 * Does not grade, inspect AnswerKey, or call processEvidence.
 */

import {
  CONTEXT_LAB_ERROR_CODES,
  CONTEXT_LAB_BUILD_NEXT_LABEL,
  CONTEXT_LAB_BUILD_QUEUE_COMPLETE_MESSAGE,
  CONTEXT_LAB_PROBE_UNIT,
  CONTEXT_LAB_RETURN_TO_SUMMARY_LABEL,
  CONTEXT_LAB_STRENGTHEN_NEXT_LABEL,
  CONTEXT_LAB_STRENGTHEN_QUEUE_COMPLETE_MESSAGE,
  CONTEXT_LAB_SUBMIT_REJECTED_MESSAGE,
  type ContextLabCurrentScreen,
  type ContextLabHandoffIntent,
} from "@/components/context-lab/types";
import { FROZEN_RUNTIME_CAPABILITIES } from "@/contextual-learning/candidate-v0/capabilities/capability-registry";
import { findProfile } from "@/contextual-learning/candidate-v0/domain/lexeme-sense";
import {
  isGuidedExperienceStep,
  type ExperienceStepSpec,
  type LearningExperiencePlan,
  type ResolvedTargetSnapshot,
  type RuntimeCapability,
} from "@/contextual-learning/candidate-v0/domain/types";
import { listMealStrengthenIdentities } from "@/contextual-learning/candidate-v0/strengthen/meal-lexical-profiles";
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
  type PlannerAuthoredRuntime,
} from "@/contextual-learning/candidate-v0/planning";
import type { ContextualSceneContentPack } from "@/contextual-learning/candidate-v0/content/types";
import { requireLearnerLexicalForm } from "@/contextual-learning/candidate-v0/content/project-learner-lexical-form";
import { findBundledLexemeBinding } from "@/contextual-learning/candidate-v0/memory-routing/bundled-lexeme-bindings";
import { bundledSceneLexemeLoader } from "@/server/runtime/bundled-scene-lexeme-loader";
import { experimentalMealRuntimeContextId } from "@/contextual-learning/candidate-v0/planning/meal-runtime-context";
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
  ContextLabError,
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
import { bindGeneratedTaskToVocabulary } from "./bind-generated-task-to-vocabulary";
import { ensureAssignedGeneratedTask } from "./ensure-assigned-generated-task";
import { HOME_BREAKFAST_FRAME_ID } from "./meal-presentation-map";
import {
  experiencePresentationProgress,
  presentFrozenTaskScreen,
  presentGuidedScreen,
  presentProbeFrozenTaskScreen,
  presentProbeIntroScreen,
  presentProbeRecordedScreen,
  presentProbeSummaryScreen,
  presentRecordedScreen,
} from "./present-context-lab-screen";
import { generateMealProbeTask } from "./generate-meal-probe-task";
import { mealColdProbeTargets } from "./meal-probe-targets";
import {
  loadContextLabContent,
  type ContextLabContentSnapshot,
} from "./context-lab-content-source";
import { validateActiveExperienceQueue } from "./validate-active-experience-queue";
import {
  currentBuildQueueItem,
  markBuildQueueItemCompleted,
} from "@/contextual-learning/candidate-v0/build/queue";
import type { MealLexicalBuildProfile } from "@/contextual-learning/candidate-v0/build/types";
import {
  buildButtonLabelForProbe,
  canHandoffRecallBuild,
  canHandoffRecallStrengthen,
  capabilityNoteForResult,
  createMealProbeOrchestration,
  initializeBuildQueue,
  initializeStrengthenQueue,
  nextProbeSkill,
  probePendingMessage,
  publicDispositionLabel,
  remainingBuildCount,
  remainingStrengthenCount,
  requireBuildQueue,
  requireStrengthenQueue,
  routingResultsForProbe,
  strengthenButtonLabelForProbe,
  type MealProbeOrchestration,
} from "./meal-probe-orchestration";
import type { StudentAction } from "@/domain/tasks/student-action";
import { deriveFrozenHintCountFromSupportExposure } from "@/contextual-learning/candidate-v0/strengthen/derive-frozen-hint-count";
import {
  currentStrengthenQueueItem,
  markStrengthenQueueItemCompleted,
} from "@/contextual-learning/candidate-v0/strengthen/queue";
import {
  mergeSupportExposures,
  supportExposuresForStrengthenStep,
} from "@/contextual-learning/candidate-v0/strengthen/record-support-exposure";
import type { MealLexicalStrengthenProfile } from "@/contextual-learning/candidate-v0/strengthen/types";
import {
  mealBuildProfileForTarget,
  mealProfileForTarget,
} from "./meal-strengthen-profiles";
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
  beginAt?: "PROBE" | "BUILD";
  content?: ContextLabContentSnapshot;
  loadContent?: (pin?: {
    releaseId: string;
    releaseFingerprint: string;
  } | null) => Promise<ContextLabContentSnapshot>;
}

export interface SubmitContextLabFrozenTaskInput {
  runId: string;
  revision: number;
  taskId: string;
  action:
    | { kind: "TEXT_INPUT"; value: string }
    | { kind: "CHOICE"; optionId: string };
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
  private readonly beginAt: "PROBE" | "BUILD";
  private readonly injectedContent?: ContextLabContentSnapshot;
  private readonly loadContent: (pin?: {
    releaseId: string;
    releaseFingerprint: string;
  } | null) => Promise<ContextLabContentSnapshot>;

  constructor(options: MealContextLabControllerOptions) {
    this.repository = options.repository;
    this.learningTasks = options.learningTasks;
    this.learning = options.learning;
    this.userId = options.userId ?? V1_PLACEHOLDER_USER_ID;
    this.enabled = options.enabled ?? true;
    this.now = options.now ?? (() => new Date().toISOString());
    this.createId = options.createId ?? (() => crypto.randomUUID());
    this.planningInput = options.planningInput;
    this.beginAt = options.beginAt ?? "PROBE";
    this.injectedContent = options.content;
    this.loadContent = options.loadContent ?? ((pin) => loadContextLabContent({ pin }));
  }

  async start(): Promise<ContextLabCurrentScreen> {
    if (!this.enabled) {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.FEATURE_DISABLED);
    }
    try {
      if (this.beginAt === "PROBE") {
        return await this.startProbe();
      }
      const content = await this.resolveContent();
      const prepared = this.createIssuedRun({ content });
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
        probe: null,
        releaseId: content.releaseId,
        releaseFingerprint: content.releaseFingerprint,
        revision: 0,
        createdAt,
        updatedAt: createdAt,
      });
      return this.toPublicScreen(
        prepared.run,
        0,
        prepared.issued,
        content.pack,
        content.releaseId,
      );
    } catch (error) {
      return this.contentErrorScreen(error);
    }
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
    const misaligned = rejectInvalidExperienceQueue(record);
    if (misaligned) {
      return misaligned;
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
    const acknowledgedStep =
      record.experienceRun.planSnapshot.plan.steps[record.experienceRun.currentStepIndex];
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

    let issuedTask = issued.issuedTask;
    if (issued.issuedTask) {
      if (!issued.answerKey) {
        return errorScreen(CONTEXT_LAB_ERROR_CODES.FROZEN_COMPILATION_FAILURE);
      }
      try {
        const assigned = await withPersistenceTimeout(
          this.assignIssuedTask(issued.run, issued.issuedTask, issued.answerKey),
        );
        if (!assigned.ok) {
          return assigned.screen;
        }
        issuedTask = assigned.publicTask;
      } catch (error) {
        console.error("[context-lab] assign frozen task failed", persistErrorMessage(error));
        return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_TASK_CONFLICT, {
          message: CONTEXT_LAB_SUBMIT_REJECTED_MESSAGE,
          recoverable: true,
        });
      }
    }

    const nextProbe = recordSupportExposureOnProbe({
      probe: record.probe,
      step: acknowledgedStep,
      planId: record.experienceRun.planSnapshot.plan.id,
      shownAt: completedAt,
    });
    const saved = await withPersistenceTimeout(
      this.repository.saveIfRevision({
        runId: input.runId,
        userId: this.userId,
        expectedRevision: input.revision,
        nextRun: issued.run,
        nextProbe,
        updatedAt: completedAt,
      }),
    );
    if (!saved.ok) {
      return saved.reason === "REVISION_CONFLICT"
        ? staleRunScreen()
        : notFoundRunScreen();
    }
    const loaded = await this.resolvePinnedContentOrScreen(record);
    if (!loaded.ok) {
      return loaded.screen;
    }
    return this.toPublicScreen(
      issued.run,
      saved.revision,
      {
        issuedActivity: issued.issuedActivity,
        issuedTask,
      },
      loaded.content.pack,
      record.releaseId,
      record.probe,
    );
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
    if (record.experienceRun.status !== "COMPLETED") {
      const misaligned = rejectInvalidExperienceQueue(record, {
        code: CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_SUBMIT_REJECTED,
        message: CONTEXT_LAB_SUBMIT_REJECTED_MESSAGE,
      });
      if (misaligned) {
        return misaligned;
      }
    }
    if (record.probe && isProbeSubmissionPhase(record.probe.phase)) {
      return this.submitProbeTask(record, input);
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
      this.learningTasks.getTaskForEvaluation({
        taskId: input.taskId,
        userId: this.userId,
        sessionId: record.id,
      }),
    );
    if (!assigned) {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_TASK_CONFLICT, {
        message: CONTEXT_LAB_SUBMIT_REJECTED_MESSAGE,
        recoverable: false,
      });
    }
    const contract = assigned.task.publicTask.responseContract;
    if (contract.kind !== "TEXT_INPUT" || input.action.kind !== "TEXT_INPUT") {
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
    const loaded = await this.resolvePinnedContentOrScreen(record);
    if (!loaded.ok) {
      return loaded.screen;
    }
    const hintCount = frozenHintCountForRecord(record, loaded.content.pack);
    if (hintCount === null) {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_SUBMIT_REJECTED, {
        message: CONTEXT_LAB_SUBMIT_REJECTED_MESSAGE,
        recoverable: false,
      });
    }
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
            hintCount,
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

  async continueProbe(input: {
    runId: string;
    revision: number;
    intent?: ContextLabHandoffIntent;
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
    if (!record.probe) {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_ACK_REJECTED, {
        recoverable: true,
      });
    }
    const rejectedContinue = rejectMalformedContinue(input);
    if (rejectedContinue) {
      return rejectedContinue;
    }
    const misaligned = rejectInvalidExperienceQueue(record);
    if (misaligned) {
      return misaligned;
    }
    if (input.intent === "START_BUILD" || input.intent === "START_STRENGTHEN") {
      return this.handoffFromProbe(record, input.intent);
    }
    if (record.probe.phase === "STRENGTHEN_ITEM_RECORDED") {
      return this.continueStrengthenQueue(record);
    }
    if (record.probe.phase === "BUILD_ITEM_RECORDED") {
      return this.continueBuildQueue(record);
    }
    if (
      record.probe.phase === "BUILD_QUEUE_COMPLETED" ||
      record.probe.phase === "STRENGTHEN_QUEUE_COMPLETED"
    ) {
      return this.returnToSummary(record);
    }
    if (
      record.probe.phase !== "PROBE_INTRO" &&
      record.probe.phase !== "PROBE_FEEDBACK_RECORDED" &&
      record.probe.phase !== "ROUTING_SUMMARY" &&
      record.probe.phase !== "PROBE_COMPLETED"
    ) {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_ACK_REJECTED, {
        recoverable: true,
      });
    }
    return this.advanceProbe(record);
  }

  private async assignIssuedTask(
    run: ExperienceRun,
    publicTask: PublicLearningTask,
    answerKey: TaskAnswerKey,
  ): Promise<
    | { ok: true; publicTask: PublicLearningTask }
    | { ok: false; screen: ContextLabCurrentScreen }
  > {
    const bound = bindGeneratedTaskToVocabulary(
      toGeneratedLearningTask({ publicTask, answerKey }),
    );
    if (!bound.ok) {
      return {
        ok: false,
        screen: errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_TASK_CONFLICT, {
          message: CONTEXT_LAB_SUBMIT_REJECTED_MESSAGE,
          recoverable: false,
        }),
      };
    }
    const ensured = await ensureAssignedGeneratedTask({
      tasks: this.learningTasks,
      task: bound.task,
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
    return { ok: true, publicTask: bound.task.publicTask };
  }

  private async completeAfterEvidence(input: {
    record: ContextLabRunRecord;
    taskId: string;
    occurredAt: string;
    feedback: ReturnType<typeof contextLabFeedbackFromEvaluation>;
    retryOnCasConflict?: boolean;
  }): Promise<ContextLabCurrentScreen> {
    const misaligned = rejectInvalidExperienceQueue(input.record);
    if (misaligned) {
      return misaligned;
    }
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

    const loaded = await this.resolvePinnedContentOrScreen(input.record);
    if (!loaded.ok) {
      return loaded.screen;
    }
    const nextProbe = completeExperienceAfterEvidence({
      probe: input.record.probe,
      experienceRun: input.record.experienceRun,
      pack: loaded.content.pack,
    });
    if (nextProbe && "screen" in nextProbe) {
      return nextProbe.screen;
    }

    const saved = await withPersistenceTimeout(
      this.repository.saveIfRevision({
        runId: input.record.id,
        userId: this.userId,
        expectedRevision: input.record.revision,
        nextRun: recorded.run,
        nextProbe: nextProbe ?? input.record.probe,
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
      handle: this.handleFor(input.record.id, saved.revision, input.record.releaseId),
      feedback: input.feedback,
      progress: experiencePresentationProgress({
        planMode: planModeOf(recorded.run),
        probe: nextProbe ?? input.record.probe,
        recorded: true,
      }),
      planMode: planModeOf(recorded.run),
      ...experienceRecordedCopy(
        nextProbe ?? input.record.probe,
        recorded.run,
        loaded.content.pack,
      ),
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
      const loaded = await this.resolvePinnedContentOrScreen(record);
      if (!loaded.ok) {
        return loaded.screen;
      }
      return presentRecordedScreen({
        handle: this.handleFor(record.id, record.revision, record.releaseId),
        feedback: contextLabFeedbackFromEvidence(evidence),
        progress: experiencePresentationProgress({
          planMode: planModeOf(record.experienceRun),
          probe: record.probe,
          recorded: true,
        }),
        planMode: planModeOf(record.experienceRun),
        ...experienceRecordedCopy(
          record.probe,
          record.experienceRun,
          loaded.content.pack,
        ),
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
    const loaded = await this.resolvePinnedContentOrScreen(record);
    if (!loaded.ok) {
      return loaded.screen;
    }
    return presentRecordedScreen({
      handle: this.handleFor(record.id, record.revision, record.releaseId),
      feedback: contextLabFeedbackFromEvidence(evidence),
      progress: experiencePresentationProgress({
        planMode: planModeOf(record.experienceRun),
        probe: record.probe,
        recorded: true,
      }),
      planMode: planModeOf(record.experienceRun),
      ...experienceRecordedCopy(
        record.probe,
        record.experienceRun,
        loaded.content.pack,
      ),
    });
  }

  private async findTaskEvidence(
    record: ContextLabRunRecord,
    taskId: string,
  ): Promise<LearningEvidence | null> {
    const assigned = await this.learningTasks.getTaskForEvaluation({
      taskId,
      userId: this.userId,
      sessionId: record.id,
    });
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

  private createIssuedRun(options?: {
    planningInput?: ExperiencePlanningInput;
    runId?: string;
    content?: ContextLabContentSnapshot;
  }):
    | { run: ExperienceRun; issued: IssuedPayload }
    | { screen: ContextLabCurrentScreen } {
    const authoredRuntime = authoredRuntimeFromContent(options?.content);
    const planningInput =
      options?.planningInput ??
      this.planningInput ??
      mealBuildPlanningInput(
        undefined,
        undefined,
        options?.content?.context.runtimeContextId,
        authoredRuntime,
      );
    const planned = planExperience({
      ...planningInput,
      authoredRuntime: planningInput.authoredRuntime ?? authoredRuntime,
    });
    if (!planned.ok) {
      return {
        screen: errorScreen(CONTEXT_LAB_ERROR_CODES.PLANNER_FAILURE, {
          detail: planned.error.code,
        }),
      };
    }

    const runtimeContextId =
      options?.content?.context.runtimeContextId ?? experimentalMealRuntimeContextId();
    const frame = options?.content
      ? options.content.context.frames.find(
          (item) => item.id === planned.plan.contextFrameId,
        )
      : findPlannerFrame(planned.plan.contextFrameId, runtimeContextId);
    const skeleton = options?.content
      ? options.content.context.skeleton.id === planned.plan.skeletonId
        ? options.content.context.skeleton
        : undefined
      : findPlannerSkeleton(planned.plan.skeletonId, runtimeContextId);
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
      createId: options?.runId ? () => options.runId! : this.createId,
    });
    if (!created.ok) {
      return {
        screen: errorScreen(CONTEXT_LAB_ERROR_CODES.PLAN_VALIDATION_FAILURE, {
          detail: created.error.code,
        }),
      };
    }
    const pinnedRun: ExperienceRun = {
      ...created.run,
      releaseId: options?.content?.releaseId,
      releaseFingerprint: options?.content?.releaseFingerprint,
    };

    const issued = issueCurrentStep({
      run: pinnedRun,
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
    const loaded = await this.resolvePinnedContentOrScreen(record);
    if (!loaded.ok) {
      return loaded.screen;
    }
    const content = loaded.content;
    const aligned = rejectInvalidExperienceQueue(record);
    if (aligned) {
      return aligned;
    }
    if (
      record.probe &&
      record.probe.phase !== "BUILD_HANDOFF" &&
      record.probe.phase !== "BUILD_ITEM_RECORDED" &&
      record.probe.phase !== "BUILD_QUEUE_COMPLETED" &&
      record.probe.phase !== "STRENGTHEN_HANDOFF" &&
      record.probe.phase !== "STRENGTHEN_ITEM_RECORDED" &&
      record.probe.phase !== "STRENGTHEN_QUEUE_COMPLETED"
    ) {
      if (record.probe.phase === "PROBE_TASK_ISSUED") {
        return this.presentIssuedProbeTask(record, content.pack);
      }
      return this.presentProbe(record, content.pack);
    }
    const run = record.experienceRun;
    const current = run.stepRuns[run.currentStepIndex];
    const progress = experiencePresentationProgress({
      planMode: planModeOf(run),
      probe: record.probe,
    });
    const handle = this.handleFor(
      run.id,
      record.revision,
      record.releaseId ?? run.releaseId,
    );
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
        planMode: planModeOf(run),
        strengthenProfile: strengthenProfileForRun(run, content.pack),
        buildProfile: buildProfileForRun(run, content.pack),
        pack: content.pack,
      });
    }
    if (run.status === "FROZEN_TASK_ISSUED" && current?.taskId) {
      const assigned = await this.learningTasks.getTaskForEvaluation({
        taskId: current.taskId,
        userId: this.userId,
        sessionId: run.id,
      });
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
        planMode: planModeOf(run),
        strengthenProfile: strengthenProfileForRun(run, content.pack),
        buildProfile: buildProfileForRun(run, content.pack),
        pack: content.pack,
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
    pack: ContextualSceneContentPack,
    releaseId?: string | null,
    probe?: MealProbeOrchestration | null,
  ): ContextLabCurrentScreen {
    const handle = this.handleFor(run.id, revision, releaseId ?? run.releaseId);
    const progress = experiencePresentationProgress({
      planMode: planModeOf(run),
      probe,
    });
    if (issued.issuedActivity) {
      return presentGuidedScreen({
        handle,
        activity: issued.issuedActivity,
        resolvedContext: run.planSnapshot.resolvedContext,
        progress,
        planMode: planModeOf(run),
        strengthenProfile: strengthenProfileForRun(run, pack),
        buildProfile: buildProfileForRun(run, pack),
        pack,
      });
    }
    if (issued.issuedTask) {
      return presentFrozenTaskScreen({
        handle,
        task: issued.issuedTask,
        resolvedContext: run.planSnapshot.resolvedContext,
        progress,
        planMode: planModeOf(run),
        strengthenProfile: strengthenProfileForRun(run, pack),
        buildProfile: buildProfileForRun(run, pack),
        pack,
      });
    }
    return errorScreen(CONTEXT_LAB_ERROR_CODES.FROZEN_COMPILATION_FAILURE);
  }

  private async startProbe(): Promise<ContextLabCurrentScreen> {
    const content = await this.resolveContent();
    const prepared = this.createUnissuedRun(content);
    if ("screen" in prepared) {
      return prepared.screen;
    }
    const createdAt = this.now();
    const probe = createMealProbeOrchestration(mealColdProbeTargets(content.pack));
    await this.repository.create({
      id: prepared.run.id,
      userId: this.userId,
      schemaVersion: CONTEXT_LAB_RUN_SCHEMA_VERSION,
      experienceId: prepared.run.experienceId,
      experienceRun: prepared.run,
      probe,
      releaseId: content.releaseId,
      releaseFingerprint: content.releaseFingerprint,
      revision: 0,
      createdAt,
      updatedAt: createdAt,
    });
    return presentProbeIntroScreen({
      handle: this.handleFor(prepared.run.id, 0, content.releaseId),
      progress: { current: 0, total: probe.targets.length },
      pack: content.pack,
    });
  }

  private createUnissuedRun(content?: ContextLabContentSnapshot):
    | { run: ExperienceRun }
    | { screen: ContextLabCurrentScreen } {
    const issued = this.createIssuedRun({ content });
    if ("screen" in issued) {
      return issued;
    }
    return { run: resetIssuedRun(issued.run) };
  }

  private presentProbe(
    record: ContextLabRunRecord,
    pack: ContextualSceneContentPack,
  ): ContextLabCurrentScreen {
    const probe = record.probe;
    if (!probe) {
      return notFoundRunScreen();
    }
    const handle = this.handleFor(record.id, record.revision, record.releaseId);
    const progress = {
      current: Math.min(probe.currentTargetIndex + 1, probe.targets.length),
      total: probe.targets.length,
      unit: CONTEXT_LAB_PROBE_UNIT,
    };
    if (probe.phase === "PROBE_INTRO") {
      return presentProbeIntroScreen({
        handle,
        progress: { current: 0, total: probe.targets.length },
        pack,
      });
    }
    if (probe.phase === "ROUTING_SUMMARY" || probe.phase === "PROBE_COMPLETED") {
      const results = routingResultsForProbe(probe);
      return presentProbeSummaryScreen({
        handle,
        progress: { current: probe.targets.length, total: probe.targets.length },
        pack,
        items: results.map((result, index) => ({
          entityId: probe.targets[index].entityId,
          label: probe.targets[index].displayLabel,
          summary: publicDispositionLabel(result.disposition),
          capabilityNote: capabilityNoteForResult() ?? undefined,
        })),
        canHandoffToBuild: canHandoffRecallBuild(probe),
        canHandoffToStrengthen: canHandoffRecallStrengthen(probe),
        strengthenButtonLabel: strengthenButtonLabelForProbe(probe),
        buildButtonLabel: buildButtonLabelForProbe(probe),
        pendingMessage: probePendingMessage(results),
      });
    }
    if (probe.phase === "PROBE_FEEDBACK_RECORDED") {
      return presentProbeRecordedScreen({ handle, progress });
    }
    return notFoundRunScreen();
  }

  private async presentIssuedProbeTask(
    record: ContextLabRunRecord,
    pack: ContextualSceneContentPack,
  ): Promise<ContextLabCurrentScreen> {
    const probe = record.probe;
    if (!probe?.issued) {
      return notFoundRunScreen();
    }
    const assigned = await this.learningTasks.getTaskForEvaluation({
      taskId: probe.issued.taskId,
      userId: this.userId,
      sessionId: record.id,
    });
    if (!assigned) {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_TASK_CONFLICT, {
        message: CONTEXT_LAB_SUBMIT_REJECTED_MESSAGE,
        recoverable: false,
      });
    }
    return presentProbeFrozenTaskScreen({
      handle: this.handleFor(record.id, record.revision, record.releaseId),
      task: assigned.task.publicTask,
      skill: probe.issued.skill,
      entityId: probe.issued.entityId,
      progress: {
        current: probe.currentTargetIndex + 1,
        total: probe.targets.length,
      },
      pack,
    });
  }

  private async advanceProbe(
    record: ContextLabRunRecord,
  ): Promise<ContextLabCurrentScreen> {
    const probe = record.probe;
    if (!probe) {
      return notFoundRunScreen();
    }
    const next = nextProbeSkill(probe);
    if (next === "SUMMARY") {
      const completed: MealProbeOrchestration = {
        ...probe,
        phase: "ROUTING_SUMMARY",
        issued: null,
        currentSkill: null,
      };
      const saved = await this.repository.saveIfRevision({
        runId: record.id,
        userId: this.userId,
        expectedRevision: record.revision,
        nextRun: record.experienceRun,
        nextProbe: completed,
        updatedAt: this.now(),
      });
      if (!saved.ok) {
        return saved.reason === "REVISION_CONFLICT"
          ? staleRunScreen()
          : notFoundRunScreen();
      }
      const loaded = await this.resolvePinnedContentOrScreen(record);
      if (!loaded.ok) {
        return loaded.screen;
      }
      return this.presentProbe(
        {
          ...record,
          probe: completed,
          revision: saved.revision,
        },
        loaded.content.pack,
      );
    }
    const target = probe.targets[next.targetIndex];
    const loaded = await this.resolvePinnedContentOrScreen(record);
    if (!loaded.ok) {
      return loaded.screen;
    }
    const content = loaded.content;
    const siblingLemmas = probe.targets
      .filter((item) => item.target.lexemeId !== target.target.lexemeId)
      .map((item) => displayFormForTarget(item.target, content.pack));
    const generated = await generateMealProbeTask({
      runId: record.id,
      target,
      skill: next.skill,
      siblingLemmas,
      targetLemma: displayFormForTarget(target.target, content.pack),
      now: this.now(),
      pack: content.pack,
    });
    if (!generated.ok) {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_TASK_CONFLICT, {
        message: CONTEXT_LAB_SUBMIT_REJECTED_MESSAGE,
        recoverable: false,
      });
    }
    const bound = bindGeneratedTaskToVocabulary(generated.task);
    if (!bound.ok) {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_TASK_CONFLICT, {
        message: CONTEXT_LAB_SUBMIT_REJECTED_MESSAGE,
        recoverable: false,
      });
    }
    const ensured = await ensureAssignedGeneratedTask({
      tasks: this.learningTasks,
      task: bound.task,
      assignment: { userId: this.userId, sessionId: record.id },
    });
    if (!ensured.ok) {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_TASK_CONFLICT, {
        message: CONTEXT_LAB_SUBMIT_REJECTED_MESSAGE,
        recoverable: false,
      });
    }
    const nextProbe: MealProbeOrchestration = {
      ...probe,
      phase: "PROBE_TASK_ISSUED",
      currentTargetIndex: next.targetIndex,
      currentSkill: next.skill,
      issued: {
        taskId: bound.task.publicTask.id,
        targetLexemeId: target.target.lexemeId,
        senseId: target.target.senseId,
        skill: next.skill,
        entityId: target.entityId,
      },
    };
    const saved = await this.repository.saveIfRevision({
      runId: record.id,
      userId: this.userId,
      expectedRevision: record.revision,
      nextRun: record.experienceRun,
      nextProbe,
      updatedAt: this.now(),
    });
    if (!saved.ok) {
      return saved.reason === "REVISION_CONFLICT"
        ? staleRunScreen()
        : notFoundRunScreen();
    }
    return presentProbeFrozenTaskScreen({
      handle: this.handleFor(record.id, saved.revision, record.releaseId),
      task: bound.task.publicTask,
      skill: next.skill,
      entityId: target.entityId,
      progress: {
        current: next.targetIndex + 1,
        total: probe.targets.length,
      },
      pack: content.pack,
    });
  }

  private async submitProbeTask(
    record: ContextLabRunRecord,
    input: SubmitContextLabFrozenTaskInput,
  ): Promise<ContextLabCurrentScreen> {
    const probe = record.probe;
    if (!probe) {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_SUBMIT_REJECTED, {
        message: CONTEXT_LAB_SUBMIT_REJECTED_MESSAGE,
        recoverable: true,
      });
    }
    if (record.revision !== input.revision) {
      return staleRunScreen();
    }
    if (probe.phase === "PROBE_FEEDBACK_RECORDED") {
      if (probe.observations.some((item) => item.taskId === input.taskId)) {
        const loaded = await this.resolvePinnedContentOrScreen(record);
        if (!loaded.ok) {
          return loaded.screen;
        }
        return this.presentProbe(record, loaded.content.pack);
      }
      return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_SUBMIT_REJECTED, {
        message: CONTEXT_LAB_SUBMIT_REJECTED_MESSAGE,
        recoverable: true,
      });
    }
    if (probe.phase !== "PROBE_TASK_ISSUED" || !probe.issued) {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_SUBMIT_REJECTED, {
        message: CONTEXT_LAB_SUBMIT_REJECTED_MESSAGE,
        recoverable: true,
      });
    }
    if (probe.issued.taskId !== input.taskId) {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_SUBMIT_REJECTED, {
        message: CONTEXT_LAB_SUBMIT_REJECTED_MESSAGE,
        recoverable: true,
      });
    }
    const assigned = await this.learningTasks.getTaskForEvaluation({
      taskId: input.taskId,
      userId: this.userId,
      sessionId: record.id,
    });
    if (!assigned) {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_TASK_CONFLICT, {
        message: CONTEXT_LAB_SUBMIT_REJECTED_MESSAGE,
        recoverable: false,
      });
    }
    const action = toStudentAction(input, this.now());
    if (!action) {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_SUBMIT_REJECTED, {
        message: CONTEXT_LAB_SUBMIT_REJECTED_MESSAGE,
        recoverable: true,
      });
    }
    try {
      const submitted = await withPersistenceTimeout(
        submitTaskAction({
          taskId: input.taskId,
          action,
          userId: this.userId,
          sessionId: record.id,
          gameId: CONTEXT_LAB_FROZEN_RENDERER_GAME_ID,
          evidenceId: this.createId(),
          learningTaskRepository: this.learningTasks,
          learningRepository: this.learning,
          now: action.occurredAt,
          createId: this.createId,
        }),
      );
      const nextProbe: MealProbeOrchestration = {
        ...probe,
        phase: "PROBE_FEEDBACK_RECORDED",
        lastOutcome: submitted.evidence.outcome,
        issued: null,
        observations: [
          ...probe.observations,
          {
            target: {
              lexemeId: probe.issued.targetLexemeId,
              senseId: probe.issued.senseId,
            },
            skill: probe.issued.skill,
            taskId: input.taskId,
            evidenceId: submitted.evidence.id,
            outcome: submitted.evidence.outcome,
          },
        ],
      };
      const saved = await this.repository.saveIfRevision({
        runId: record.id,
        userId: this.userId,
        expectedRevision: record.revision,
        nextRun: record.experienceRun,
        nextProbe,
        updatedAt: this.now(),
      });
      if (!saved.ok) {
        return this.reconcileProbeAfterEvidence(record, input.taskId);
      }
      return presentProbeRecordedScreen({
        handle: this.handleFor(record.id, saved.revision, record.releaseId),
        progress: {
          current: nextProbe.currentTargetIndex + 1,
          total: nextProbe.targets.length,
        },
      });
    } catch (error) {
      if (
        error instanceof TaskProtocolError &&
        error.code === "TASK_ALREADY_COMPLETED"
      ) {
        return this.reconcileProbeAfterEvidence(record, input.taskId);
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

  private async reconcileProbeAfterEvidence(
    record: ContextLabRunRecord,
    taskId: string,
  ): Promise<ContextLabCurrentScreen> {
    const latest =
      (await this.repository.get({
        runId: record.id,
        userId: this.userId,
      })) ?? record;
    const probe = latest.probe;
    if (!probe) {
      return notFoundRunScreen();
    }
    if (probe.observations.some((item) => item.taskId === taskId)) {
      const loaded = await this.resolvePinnedContentOrScreen(latest);
      if (!loaded.ok) {
        return loaded.screen;
      }
      return this.presentProbe(latest, loaded.content.pack);
    }
    const evidence = await this.findTaskEvidence(latest, taskId);
    if (!evidence || !probe.issued || probe.issued.taskId !== taskId) {
      return staleRunScreen();
    }
    const nextProbe: MealProbeOrchestration = {
      ...probe,
      phase: "PROBE_FEEDBACK_RECORDED",
      lastOutcome: evidence.outcome,
      issued: null,
      observations: [
        ...probe.observations,
        {
          target: {
            lexemeId: probe.issued.targetLexemeId,
            senseId: probe.issued.senseId,
          },
          skill: probe.issued.skill,
          taskId,
          evidenceId: evidence.id,
          outcome: evidence.outcome,
        },
      ],
    };
    const saved = await this.repository.saveIfRevision({
      runId: latest.id,
      userId: this.userId,
      expectedRevision: latest.revision,
      nextRun: latest.experienceRun,
      nextProbe,
      updatedAt: this.now(),
    });
    if (!saved.ok) {
      const again = await this.repository.get({
        runId: latest.id,
        userId: this.userId,
      });
      return again ? this.presentStoredRun(again) : staleRunScreen();
    }
    return presentProbeRecordedScreen({
      handle: this.handleFor(latest.id, saved.revision, latest.releaseId),
      progress: {
        current: nextProbe.currentTargetIndex + 1,
        total: nextProbe.targets.length,
      },
    });
  }

  private async handoffFromProbe(
    record: ContextLabRunRecord,
    intent: ContextLabHandoffIntent,
  ): Promise<ContextLabCurrentScreen> {
    if (record.probe?.phase !== "ROUTING_SUMMARY" && record.probe?.phase !== "PROBE_COMPLETED") {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_ACK_REJECTED, {
        recoverable: true,
      });
    }
    if (intent === "START_BUILD") {
      return this.handoffToBuild(record);
    }
    return this.handoffToStrengthen(record);
  }

  private async handoffToStrengthen(
    record: ContextLabRunRecord,
  ): Promise<ContextLabCurrentScreen> {
    if (!record.probe || !canHandoffRecallStrengthen(record.probe)) {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_ACK_REJECTED, {
        recoverable: true,
      });
    }
    const queue = initializeStrengthenQueue(record.probe);
    if (!queue) {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_ACK_REJECTED, {
        recoverable: true,
      });
    }
    return this.issueStrengthenTarget(record, {
      ...record.probe,
      phase: "STRENGTHEN_HANDOFF",
      experienceMode: "STRENGTHEN",
      supportExposures: [],
      strengthenQueue: queue,
    });
  }

  private async continueStrengthenQueue(
    record: ContextLabRunRecord,
  ): Promise<ContextLabCurrentScreen> {
    if (!record.probe) {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_ACK_REJECTED, {
        recoverable: true,
      });
    }
    const queue = requireStrengthenQueue(record.probe);
    if (!queue.ok || !currentStrengthenQueueItem(queue.queue)) {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_ACK_REJECTED, {
        recoverable: true,
      });
    }
    return this.issueStrengthenTarget(record, {
      ...record.probe,
      phase: "STRENGTHEN_HANDOFF",
      experienceMode: "STRENGTHEN",
      supportExposures: [],
      strengthenQueue: queue.queue,
    });
  }

  private async issueStrengthenTarget(
    record: ContextLabRunRecord,
    probe: MealProbeOrchestration,
  ): Promise<ContextLabCurrentScreen> {
    const queue = requireStrengthenQueue(probe);
    if (!queue.ok) {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_ACK_REJECTED, {
        recoverable: false,
        detail: queue.reason,
      });
    }
    const current = currentStrengthenQueueItem(queue.queue);
    if (!current) {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_ACK_REJECTED, {
        recoverable: true,
      });
    }
    const loaded = await this.resolvePinnedContentOrScreen(record);
    if (!loaded.ok) {
      return loaded.screen;
    }
    const content = loaded.content;
    const profile = mealProfileForTarget(current.target, content.pack);
    if (!profile) {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.PLANNER_FAILURE, {
        detail: "MEAL_TARGET_PROFILE_UNRESOLVED",
      });
    }
    const prepared = this.createIssuedRun({
      planningInput: mealStrengthenPlanningInput(
        profile,
        typingCapabilities(),
        content.context.runtimeContextId,
        authoredRuntimeFromContent(content),
      ),
      runId: record.id,
      content,
    });
    if ("screen" in prepared) {
      return prepared.screen;
    }
    const nextProbe: MealProbeOrchestration = {
      ...probe,
      phase: "STRENGTHEN_HANDOFF",
      experienceMode: "STRENGTHEN",
      supportExposures: [],
      strengthenQueue: {
        ...queue.queue,
        currentPlanId: prepared.run.planSnapshot.plan.id,
      },
    };
    const saved = await this.repository.saveIfRevision({
      runId: record.id,
      userId: this.userId,
      expectedRevision: record.revision,
      nextRun: prepared.run,
      nextProbe,
      updatedAt: this.now(),
    });
    if (!saved.ok) {
      return saved.reason === "REVISION_CONFLICT"
        ? staleRunScreen()
        : notFoundRunScreen();
    }
    return this.toPublicScreen(
      prepared.run,
      saved.revision,
      prepared.issued,
      content.pack,
      content.releaseId,
      nextProbe,
    );
  }

  private async handoffToBuild(
    record: ContextLabRunRecord,
  ): Promise<ContextLabCurrentScreen> {
    if (!record.probe || !canHandoffRecallBuild(record.probe)) {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_ACK_REJECTED, {
        recoverable: true,
      });
    }
    const initialized = initializeBuildQueue(record.probe);
    if (!initialized.ok) {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_ACK_REJECTED, {
        recoverable: true,
        detail: initialized.reason,
      });
    }
    return this.issueBuildTarget(record, {
      ...record.probe,
      phase: "BUILD_HANDOFF",
      experienceMode: "BUILD",
      supportExposures: [],
      buildQueue: initialized.queue,
    });
  }

  private async continueBuildQueue(
    record: ContextLabRunRecord,
  ): Promise<ContextLabCurrentScreen> {
    if (!record.probe) {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_ACK_REJECTED, {
        recoverable: true,
      });
    }
    const queue = requireBuildQueue(record.probe);
    if (!queue.ok || !currentBuildQueueItem(queue.queue)) {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_ACK_REJECTED, {
        recoverable: true,
      });
    }
    return this.issueBuildTarget(record, {
      ...record.probe,
      phase: "BUILD_HANDOFF",
      experienceMode: "BUILD",
      supportExposures: [],
      buildQueue: queue.queue,
    });
  }

  private async issueBuildTarget(
    record: ContextLabRunRecord,
    probe: MealProbeOrchestration,
  ): Promise<ContextLabCurrentScreen> {
    const queue = requireBuildQueue(probe);
    if (!queue.ok) {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_ACK_REJECTED, {
        recoverable: false,
        detail: queue.reason,
      });
    }
    const current = currentBuildQueueItem(queue.queue);
    if (!current) {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_ACK_REJECTED, {
        recoverable: true,
      });
    }
    const loaded = await this.resolvePinnedContentOrScreen(record);
    if (!loaded.ok) {
      return loaded.screen;
    }
    const content = loaded.content;
    const profile = mealBuildProfileForTarget(current.target, content.pack);
    if (!profile) {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.PLANNER_FAILURE, {
        detail: "MEAL_TARGET_PROFILE_UNRESOLVED",
      });
    }
    const prepared = this.createIssuedRun({
      planningInput: mealBuildPlanningInput(
        profile,
        typingCapabilities(),
        content.context.runtimeContextId,
        authoredRuntimeFromContent(content),
      ),
      runId: record.id,
      content,
    });
    if ("screen" in prepared) {
      return prepared.screen;
    }
    const nextProbe: MealProbeOrchestration = {
      ...probe,
      phase: "BUILD_HANDOFF",
      experienceMode: "BUILD",
      supportExposures: [],
      buildQueue: {
        ...queue.queue,
        currentPlanId: prepared.run.planSnapshot.plan.id,
      },
    };
    const saved = await this.repository.saveIfRevision({
      runId: record.id,
      userId: this.userId,
      expectedRevision: record.revision,
      nextRun: prepared.run,
      nextProbe,
      updatedAt: this.now(),
    });
    if (!saved.ok) {
      return saved.reason === "REVISION_CONFLICT"
        ? staleRunScreen()
        : notFoundRunScreen();
    }
    return this.toPublicScreen(
      prepared.run,
      saved.revision,
      prepared.issued,
      content.pack,
      content.releaseId,
      nextProbe,
    );
  }

  private async returnToSummary(
    record: ContextLabRunRecord,
  ): Promise<ContextLabCurrentScreen> {
    if (!record.probe) {
      return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_ACK_REJECTED, {
        recoverable: true,
      });
    }
    const nextProbe: MealProbeOrchestration = {
      ...record.probe,
      phase: "ROUTING_SUMMARY",
      experienceMode: null,
      issued: null,
      currentSkill: null,
    };
    const saved = await this.repository.saveIfRevision({
      runId: record.id,
      userId: this.userId,
      expectedRevision: record.revision,
      nextRun: record.experienceRun,
      nextProbe,
      updatedAt: this.now(),
    });
    if (!saved.ok) {
      return saved.reason === "REVISION_CONFLICT"
        ? staleRunScreen()
        : notFoundRunScreen();
    }
    const loaded = await this.resolvePinnedContentOrScreen(record);
    if (!loaded.ok) {
      return loaded.screen;
    }
    return this.presentProbe(
      {
        ...record,
        probe: nextProbe,
        revision: saved.revision,
      },
      loaded.content.pack,
    );
  }

  private async resolveContent(
    record?: ContextLabRunRecord,
  ): Promise<ContextLabContentSnapshot> {
    try {
      if (this.injectedContent) {
        return this.injectedContent;
      }
      const pin =
        record?.releaseId && record.releaseFingerprint
          ? { releaseId: record.releaseId, releaseFingerprint: record.releaseFingerprint }
          : record?.experienceRun.releaseId && record.experienceRun.releaseFingerprint
            ? {
                releaseId: record.experienceRun.releaseId,
                releaseFingerprint: record.experienceRun.releaseFingerprint,
              }
            : null;
      return await this.loadContent(pin);
    } catch (error) {
      if (error instanceof ContextLabError) {
        throw error;
      }
      throw new ContextLabError(
        CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_CONTENT_UNAVAILABLE,
        "Experimental Context Lab content is unavailable.",
        false,
      );
    }
  }

  private async resolvePinnedContentOrScreen(
    record?: ContextLabRunRecord,
  ): Promise<
    | { ok: true; content: ContextLabContentSnapshot }
    | { ok: false; screen: ContextLabCurrentScreen }
  > {
    try {
      return { ok: true, content: await this.resolveContent(record) };
    } catch (error) {
      return { ok: false, screen: this.contentErrorScreen(error) };
    }
  }

  private handleFor(
    runId: string,
    revision: number,
    releaseId?: string | null,
  ): { runId: string; revision: number; contentReleaseId?: string } {
    return {
      runId,
      revision,
      ...(releaseId ? { contentReleaseId: releaseId } : {}),
    };
  }

  private contentErrorScreen(error: unknown): ContextLabCurrentScreen {
    if (error instanceof ContextLabError) {
      if (error.code === CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_CONTENT_UNAVAILABLE) {
        return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_CONTENT_UNAVAILABLE, {
          title: "实验内容暂时不可用",
          message: "当前没有可用的已发布实验内容。这不会影响 /train。",
          recoverable: false,
        });
      }
      return errorScreen(error.code, { recoverable: error.recoverable });
    }
    throw error;
  }
}

interface IssuedPayload {
  issuedActivity?: PublicGuidedActivity;
  issuedTask?: PublicLearningTask;
}

export function mealBuildPlanningInput(
  profileOrCapabilities?: MealLexicalBuildProfile | RuntimeCapability[],
  capabilities: RuntimeCapability[] = typingCapabilities(),
  runtimeContextId: ReturnType<typeof experimentalMealRuntimeContextId> = experimentalMealRuntimeContextId(),
  authoredRuntime?: PlannerAuthoredRuntime,
): ExperiencePlanningInput {
  const profile = Array.isArray(profileOrCapabilities)
    ? null
    : profileOrCapabilities;
  const runtime = Array.isArray(profileOrCapabilities)
    ? profileOrCapabilities
    : capabilities;
  const fallback = defaultMealPlanningIdentity();
  const sense = profile?.fixtureSense ?? fallback?.fixtureSense;
  if (!sense) {
    return {
      learningNeedRef: "need-opaque-ref",
      mode: "BUILD",
      targets: [],
      allowedContextIds: [HOME_BREAKFAST_FRAME_ID],
      runtimeCapabilities: runtime,
      loadLexeme: bundledSceneLexemeLoader,
      runtimeContextId,
      authoredRuntime,
    };
  }
  return {
    learningNeedRef: "need-opaque-ref",
    mode: "BUILD",
    targets: [
      {
        id: `target-${profile?.stepToken ?? fallback?.stepToken}-form`,
        sense,
        focus: "MEANING_TO_FORM",
      },
    ],
    allowedContextIds: [HOME_BREAKFAST_FRAME_ID],
    runtimeCapabilities: runtime,
    loadLexeme: bundledSceneLexemeLoader,
    runtimeContextId,
    authoredRuntime,
  };
}

export function mealStrengthenPlanningInput(
  profileOrCapabilities?: MealLexicalStrengthenProfile | RuntimeCapability[],
  capabilities: RuntimeCapability[] = typingCapabilities(),
  runtimeContextId: ReturnType<typeof experimentalMealRuntimeContextId> = experimentalMealRuntimeContextId(),
  authoredRuntime?: PlannerAuthoredRuntime,
): ExperiencePlanningInput {
  const profile = Array.isArray(profileOrCapabilities)
    ? null
    : profileOrCapabilities;
  const runtime = Array.isArray(profileOrCapabilities)
    ? profileOrCapabilities
    : capabilities;
  const fallback = defaultMealPlanningIdentity();
  const sense = profile?.fixtureSense ?? fallback?.fixtureSense;
  if (!sense) {
    return {
      learningNeedRef: "need-opaque-ref",
      mode: "STRENGTHEN",
      targets: [],
      allowedContextIds: [HOME_BREAKFAST_FRAME_ID],
      runtimeCapabilities: runtime,
      loadLexeme: bundledSceneLexemeLoader,
      runtimeContextId,
      authoredRuntime,
    };
  }
  return {
    learningNeedRef: "need-opaque-ref",
    mode: "STRENGTHEN",
    targets: [
      {
        id: `target-${profile?.stepToken ?? fallback?.stepToken}-form`,
        sense,
        focus: "MEANING_TO_FORM",
      },
    ],
    allowedContextIds: [HOME_BREAKFAST_FRAME_ID],
    runtimeCapabilities: runtime,
    loadLexeme: bundledSceneLexemeLoader,
    runtimeContextId,
    authoredRuntime,
  };
}

function resolvePlanTargets(
  plan: LearningExperiencePlan,
): ResolvedTargetSnapshot[] {
  return plan.targets.map((target) => {
    const binding = findBundledLexemeBinding(target.sense.lexemeId);
    const bundled = binding
      ? bundledSceneLexemeLoader(binding.canonicalKey)
      : null;
    const projected = bundled ? requireLearnerLexicalForm(bundled) : null;
    return {
      targetId: target.id,
      sense: target.sense,
      displayForm:
        bundled != null
          ? (projected?.answerForm ?? "")
          : (findProfile(PLANNER_SENSE_PROFILES, target.sense)?.displayForm ?? ""),
      focus: target.focus,
    };
  });
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
  if (extra.length > 0 || "hintCount" in input) {
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
  const textOk =
    input.action.kind === "TEXT_INPUT" &&
    actionKeys.every((key) => key === "kind" || key === "value") &&
    !("hintCount" in input.action) &&
    typeof input.action.value === "string" &&
    input.action.value.trim().length > 0;
  const choiceOk =
    input.action.kind === "CHOICE" &&
    actionKeys.every((key) => key === "kind" || key === "optionId") &&
    !("hintCount" in input.action) &&
    typeof input.action.optionId === "string" &&
    input.action.optionId.trim().length > 0;
  if (!textOk && !choiceOk) {
    return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_SUBMIT_REJECTED, {
      message: CONTEXT_LAB_SUBMIT_REJECTED_MESSAGE,
      recoverable: true,
    });
  }
  return null;
}

function resetIssuedRun(run: ExperienceRun): ExperienceRun {
  return {
    ...run,
    status: "READY",
    currentStepIndex: 0,
    stepRuns: run.stepRuns.map((step) => ({
      stepId: step.stepId,
      status: "PENDING",
    })),
    updatedAt: run.createdAt,
  };
}

function isProbeSubmissionPhase(phase: MealProbeOrchestration["phase"]): boolean {
  return phase === "PROBE_TASK_ISSUED" || phase === "PROBE_FEEDBACK_RECORDED";
}

function toStudentAction(
  input: SubmitContextLabFrozenTaskInput,
  occurredAt: string,
): StudentAction | null {
  if (input.action.kind === "TEXT_INPUT") {
    return {
      kind: "TEXT_INPUT",
      value: input.action.value,
      taskId: input.taskId,
      occurredAt,
      responseTimeMs: boundResponseTimeMs(input.responseTimeMs),
      hintCount: 0,
    };
  }
  if (input.action.kind === "CHOICE") {
    return {
      kind: "CHOICE",
      optionId: input.action.optionId,
      taskId: input.taskId,
      occurredAt,
      responseTimeMs: boundResponseTimeMs(input.responseTimeMs),
      hintCount: 0,
    };
  }
  return null;
}

function planModeOf(run: ExperienceRun): "BUILD" | "STRENGTHEN" | undefined {
  return run.planSnapshot.plan.mode === "STRENGTHEN" ||
    run.planSnapshot.plan.mode === "BUILD"
    ? run.planSnapshot.plan.mode
    : undefined;
}

function strengthenProfileForRun(
  run: ExperienceRun,
  pack?: ContextualSceneContentPack,
): MealLexicalStrengthenProfile | null {
  const sense = run.planSnapshot.plan.targets[0]?.sense;
  return sense ? mealProfileForTarget(sense, pack) : null;
}

function buildProfileForRun(
  run: ExperienceRun,
  pack?: ContextualSceneContentPack,
): MealLexicalBuildProfile | null {
  const sense = run.planSnapshot.plan.targets[0]?.sense;
  return sense ? mealBuildProfileForTarget(sense, pack) : null;
}

function authoredRuntimeFromContent(
  content?: ContextLabContentSnapshot,
): PlannerAuthoredRuntime | undefined {
  if (!content) {
    return undefined;
  }
  return {
    pack: content.pack,
    frames: content.context.frames,
    skeleton: content.context.skeleton,
  };
}

function frozenHintCountForRecord(
  record: ContextLabRunRecord,
  pack?: ContextualSceneContentPack,
): number | null {
  if (record.experienceRun.planSnapshot.plan.mode !== "STRENGTHEN") {
    return 0;
  }
  const profile = strengthenProfileForRun(record.experienceRun, pack);
  const current = record.experienceRun.planSnapshot.plan.steps[
    record.experienceRun.currentStepIndex
  ];
  if (!profile || !current) {
    return null;
  }
  const derived = deriveFrozenHintCountFromSupportExposure({
    target: profile.target,
    planId: record.experienceRun.planSnapshot.plan.id,
    verificationStepId: current.id,
    stepIds: record.experienceRun.planSnapshot.plan.steps.map((step) => step.id),
    exposures: record.probe?.supportExposures ?? [],
  });
  return derived.ok ? derived.hintCount : null;
}

function recordSupportExposureOnProbe(input: {
  probe: MealProbeOrchestration | null;
  step?: ExperienceStepSpec;
  planId: string;
  shownAt: string;
}): MealProbeOrchestration | null {
  if (
    !input.probe ||
    (input.probe.experienceMode !== "STRENGTHEN" &&
      input.probe.experienceMode !== "BUILD") ||
    !input.step
  ) {
    return input.probe;
  }
  const next = supportExposuresForStrengthenStep({
    step: input.step,
    planId: input.planId,
    shownAt: input.shownAt,
  });
  return {
    ...input.probe,
    supportExposures: mergeSupportExposures(
      input.probe.supportExposures ?? [],
      next,
    ),
  };
}

function completeExperienceAfterEvidence(input: {
  probe: MealProbeOrchestration | null;
  experienceRun: ExperienceRun;
  pack?: ContextualSceneContentPack;
}): MealProbeOrchestration | { screen: ContextLabCurrentScreen } | null {
  const misaligned = rejectInvalidExperienceQueue({
    probe: input.probe,
    experienceRun: input.experienceRun,
  });
  if (misaligned) {
    return { screen: misaligned };
  }
  if (!input.probe) {
    return input.probe;
  }
  if (input.probe.experienceMode === "BUILD") {
    return completeBuildAfterEvidence({
      probe: input.probe,
      plan: input.experienceRun.planSnapshot.plan,
      pack: input.pack,
    });
  }
  if (input.probe.experienceMode !== "STRENGTHEN") {
    return input.probe;
  }
  const queue = requireStrengthenQueue(input.probe);
  if (!queue.ok) {
    return {
      screen: errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_ACK_REJECTED, {
        recoverable: false,
        detail: queue.reason,
      }),
    };
  }
  const profile = mealProfileForTarget(
    input.experienceRun.planSnapshot.plan.targets[0]?.sense ?? {
      lexemeId: "",
      senseId: "",
    },
    input.pack,
  );
  if (!profile) {
    return {
      screen: errorScreen(CONTEXT_LAB_ERROR_CODES.PLANNER_FAILURE, {
        detail: "STRENGTHEN_TARGET_IDENTITY_MISMATCH",
      }),
    };
  }
  const marked = markStrengthenQueueItemCompleted(queue.queue, profile.target);
  if (!marked.ok) {
    return {
      screen: errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_ACK_REJECTED, {
        recoverable: false,
        detail: marked.reason,
      }),
    };
  }
  const remaining = currentStrengthenQueueItem(marked.queue);
  return {
    ...input.probe,
    phase: remaining ? "STRENGTHEN_ITEM_RECORDED" : "STRENGTHEN_QUEUE_COMPLETED",
    strengthenQueue: marked.queue,
  };
}

function completeBuildAfterEvidence(input: {
  probe: MealProbeOrchestration;
  plan: LearningExperiencePlan;
  pack?: ContextualSceneContentPack;
}): MealProbeOrchestration | { screen: ContextLabCurrentScreen } {
  const queue = requireBuildQueue(input.probe);
  if (!queue.ok) {
    return {
      screen: errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_ACK_REJECTED, {
        recoverable: false,
        detail: queue.reason,
      }),
    };
  }
  const profile = mealBuildProfileForTarget(
    input.plan.targets[0]?.sense ?? { lexemeId: "", senseId: "" },
    input.pack,
  );
  if (!profile) {
    return {
      screen: errorScreen(CONTEXT_LAB_ERROR_CODES.PLANNER_FAILURE, {
        detail: "MEAL_TARGET_PROFILE_UNRESOLVED",
      }),
    };
  }
  const marked = markBuildQueueItemCompleted(queue.queue, profile.target);
  if (!marked.ok) {
    return {
      screen: errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_ACK_REJECTED, {
        recoverable: false,
        detail: marked.reason,
      }),
    };
  }
  const remaining = currentBuildQueueItem(marked.queue);
  return {
    ...input.probe,
    phase: remaining ? "BUILD_ITEM_RECORDED" : "BUILD_QUEUE_COMPLETED",
    buildQueue: marked.queue,
  };
}

function experienceRecordedCopy(
  probe: MealProbeOrchestration | null,
  run: ExperienceRun,
  pack?: ContextualSceneContentPack,
): {
  recordedMessage?: string;
  continueAvailable?: boolean;
  continueLabel?: string;
  queueCompleteMessage?: string;
} {
  if (!probe) {
    return {};
  }
  if (probe.experienceMode === "BUILD") {
    const completed = probe.buildQueue?.completed.at(-1);
    const profile = completed
      ? mealBuildProfileForTarget(completed, pack)
      : buildProfileForRun(run, pack);
    const remaining = probe.buildQueue
      ? currentBuildQueueItem(probe.buildQueue)
      : null;
    const otherAvailable = remainingStrengthenCount(probe) > 0;
    return {
      recordedMessage: profile
        ? `“${profile.displayLabel}”的这次建立已记录。`
        : CONTEXT_LAB_BUILD_QUEUE_COMPLETE_MESSAGE,
      continueAvailable: remaining !== null || otherAvailable,
      continueLabel: remaining
        ? CONTEXT_LAB_BUILD_NEXT_LABEL
        : otherAvailable
          ? CONTEXT_LAB_RETURN_TO_SUMMARY_LABEL
          : undefined,
      queueCompleteMessage: remaining
        ? undefined
        : CONTEXT_LAB_BUILD_QUEUE_COMPLETE_MESSAGE,
    };
  }
  if (probe.experienceMode !== "STRENGTHEN") {
    return {};
  }
  const completed = probe.strengthenQueue?.completed.at(-1);
  const profile = completed
    ? mealProfileForTarget(completed, pack)
    : strengthenProfileForRun(run, pack);
  const remaining = probe.strengthenQueue
    ? currentStrengthenQueueItem(probe.strengthenQueue)
    : null;
  const otherAvailable = remainingBuildCount(probe) > 0;
  return {
    recordedMessage: profile
      ? `“${profile.displayLabel}”的这次强化已记录。`
      : CONTEXT_LAB_STRENGTHEN_QUEUE_COMPLETE_MESSAGE,
    continueAvailable: remaining !== null || otherAvailable,
    continueLabel: remaining
      ? CONTEXT_LAB_STRENGTHEN_NEXT_LABEL
      : otherAvailable
        ? CONTEXT_LAB_RETURN_TO_SUMMARY_LABEL
        : undefined,
    queueCompleteMessage: remaining
      ? undefined
      : CONTEXT_LAB_STRENGTHEN_QUEUE_COMPLETE_MESSAGE,
  };
}

function rejectInvalidExperienceQueue(
  record: Pick<ContextLabRunRecord, "probe" | "experienceRun">,
  options?: {
    code?: (typeof CONTEXT_LAB_ERROR_CODES)[keyof typeof CONTEXT_LAB_ERROR_CODES];
    message?: string;
  },
): ContextLabCurrentScreen | null {
  const result = validateActiveExperienceQueue({
    probe: record.probe,
    experienceRun: record.experienceRun,
  });
  if (result.ok) {
    return null;
  }
  return errorScreen(options?.code ?? CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_ACK_REJECTED, {
    recoverable: false,
    message: options?.message,
    detail: result.reason,
  });
}

function rejectMalformedContinue(input: {
  runId: string;
  revision: number;
  intent?: ContextLabHandoffIntent;
}): ContextLabCurrentScreen | null {
  const extra = Object.keys(input).filter(
    (key) => key !== "runId" && key !== "revision" && key !== "intent",
  );
  if (extra.length > 0) {
    return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_ACK_REJECTED, {
      recoverable: true,
    });
  }
  if (
    input.intent !== undefined &&
    input.intent !== "START_BUILD" &&
    input.intent !== "START_STRENGTHEN"
  ) {
    return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_ACK_REJECTED, {
      recoverable: true,
    });
  }
  return null;
}

function displayFormForTarget(
  target: { lexemeId: string; senseId: string },
  pack?: Parameters<typeof mealProfileForTarget>[1],
): string {
  return mealProfileForTarget(target, pack)?.displayForm ?? "";
}

function defaultMealPlanningIdentity() {
  const listed = listMealStrengthenIdentities();
  return listed.ok ? listed.identities[0] ?? null : null;
}

function persistErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") {
    return "unknown persistence error";
  }
  const code = "code" in error ? String(error.code) : "";
  const message = "message" in error ? String(error.message) : "";
  return [code, message].filter(Boolean).join(" ");
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
