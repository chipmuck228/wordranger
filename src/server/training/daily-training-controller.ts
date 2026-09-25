import type { LearningRepository } from "@/domain/learning/learning-repository";
import type { LearningNeed } from "@/domain/learning/learning-need";
import type { LearningEvidence } from "@/domain/learning/evidence.types";
import { LearningDomainError } from "@/domain/learning/engine/math";
import { DefaultTaskGenerator } from "@/domain/tasks/default-task-generator";
import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import type { LearningTaskRepository } from "@/domain/tasks/learning-task-repository";
import type { RandomSource } from "@/domain/tasks/random-source";
import type { StudentAction } from "@/domain/tasks/student-action";
import type { TaskGenerator } from "@/domain/tasks/task-generator";
import { TaskProtocolError } from "@/domain/tasks/task-evaluator";
import type { VocabularyRepository } from "@/domain/vocabulary/vocabulary-repository";
import {
  DAILY_TRAINING_ORCHESTRATION_TYPE,
  DAILY_TRAINING_TASK_COUNT,
} from "@/server/auth/v1-user";
import {
  isAbortLike,
  isPersistenceTimeoutError,
  withPersistenceTimeout,
} from "@/lib/runtime/persistence-timeout";
import { planLearningSession } from "@/server/scheduler/plan-learning-session";
import type { LearningStateQueryRepository } from "@/server/scheduler/learning-state-query-repository";
import { submitTaskAction } from "@/server/tasks/submit-task-action";
import {
  toGameSubmissionFeedback,
  toGameSubmissionFeedbackFromOutcome,
} from "@/server/game-session/game-submission-feedback";
import { GameSessionError } from "@/server/game-session/ranger-trial-errors";
import {
  createSchedulerRandom,
  createTaskRandom,
} from "@/server/game-session/ranger-trial-seeds";
import type {
  GameSubmissionFeedback,
  StudentActionIntent,
} from "@/server/game-session/learning-game-session.types";
import type {
  ContinueDailyTrainingResult,
  DailyTrainingItem,
  DailyTrainingPublicSession,
  DailyTrainingSessionRecord,
  DailyTrainingSessionStore,
  ResumeDailyTrainingResult,
  StartDailyTrainingResult,
  SubmitDailyTrainingResult,
} from "./daily-training.types";
import {
  rendererByGameType,
  type TrainingRendererDefinition,
} from "./renderer-registry";
import {
  dailyTrainingPresentationType,
  selectDailyTrainingRenderer,
} from "./daily-training-renderer-policy";
import { selectRendererForTask } from "./renderer-selector";

/**
 * Product orchestrator for one Daily Training round.
 * Plans once, generates one task at a time, applies the Daily Training
 * direct-practice presentation policy, and submits through `submitTaskAction`
 * with Evidence.gameId RANGER_TRIAL for new items. In-progress items that
 * already store a game renderer keep that renderer until the item completes.
 * Start retry after a client timeout may still create a second session
 * (inherited limitation; not redesigned in Phase 09).
 */
const MAX_SESSION_CONFLICT_RETRIES = 1;

export interface DailyTrainingControllerDeps {
  userId: string;
  vocabulary: VocabularyRepository;
  query: LearningStateQueryRepository;
  tasks: LearningTaskRepository;
  learning: LearningRepository;
  sessions: DailyTrainingSessionStore;
  generator?: TaskGenerator;
  now?: () => string;
  createSessionId?: () => string;
  createId?: () => string;
  createEvidenceId?: () => string;
  createSchedulerRandom?: (sessionId: string) => RandomSource;
  createTaskRandom?: (sessionId: string, needId: string) => RandomSource;
  requestedNeedCount?: number;
  selectRenderer?: typeof selectRendererForTask;
}

function publicProgress(
  record: DailyTrainingSessionRecord,
): DailyTrainingPublicSession {
  const item = record.items[record.currentNeedIndex];
  return {
    sessionId: record.sessionId,
    planId: record.planId,
    current: Math.min(record.currentNeedIndex + 1, record.needs.length),
    total: record.needs.length,
    completed: record.completed,
    currentTaskId: record.currentTaskId,
    rendererGameType: dailyTrainingPresentationType(item?.rendererGameType),
  };
}

function isCorrectStatus(status: string): boolean {
  return status === "CORRECT" || status === "ASSISTED";
}

function persistFailure(error: unknown): never {
  if (error instanceof GameSessionError) {
    throw error;
  }
  throw new GameSessionError(
    "NETWORK_ERROR",
    "Could not persist the training session",
  );
}

function isTimeoutFailure(error: unknown): boolean {
  return isPersistenceTimeoutError(error) || isAbortLike(error);
}

function applySubmitOnce(
  record: DailyTrainingSessionRecord,
  taskId: string,
  feedback: GameSubmissionFeedback,
): boolean {
  if (record.lastCompletedTaskId === taskId) {
    record.phase = "awaiting_continue";
    if (!record.lastFeedback) {
      record.lastFeedback = feedback;
    }
    return false;
  }
  record.lastCompletedTaskId = taskId;
  record.lastFeedback = feedback;
  record.phase = "awaiting_continue";
  record.stats.attempted += 1;
  record.completed += 1;
  if (isCorrectStatus(feedback.status)) {
    record.stats.correct += 1;
  } else if (feedback.status === "INCORRECT") {
    record.stats.incorrect += 1;
  }
  const item = record.items.find((entry) => entry.taskId === taskId);
  if (item) {
    item.status = "COMPLETED";
  }
  if (
    feedback.status === "INCORRECT" &&
    item &&
    !record.attentionLexemeIds.includes(item.lexemeId)
  ) {
    record.attentionLexemeIds.push(item.lexemeId);
  }
  return true;
}

export class DailyTrainingController {
  private readonly generator: TaskGenerator;
  private readonly now: () => string;
  private readonly createSessionId: () => string;
  private readonly createId: () => string;
  private readonly createEvidenceId: () => string;
  private readonly schedulerRandom: (sessionId: string) => RandomSource;
  private readonly taskRandom: (sessionId: string, needId: string) => RandomSource;
  private readonly selectRenderer: typeof selectRendererForTask;
  private idSeq = 0;

  constructor(private readonly deps: DailyTrainingControllerDeps) {
    this.generator =
      deps.generator ?? new DefaultTaskGenerator(deps.vocabulary);
    this.now = deps.now ?? (() => new Date().toISOString());
    this.createSessionId =
      deps.createSessionId ?? (() => crypto.randomUUID());
    this.createId =
      deps.createId ??
      (() => {
        this.idSeq += 1;
        return `train-id-${this.idSeq}`;
      });
    this.createEvidenceId =
      deps.createEvidenceId ?? (() => crypto.randomUUID());
    this.schedulerRandom =
      deps.createSchedulerRandom ??
      ((sessionId) =>
        createSchedulerRandom(DAILY_TRAINING_ORCHESTRATION_TYPE, sessionId));
    this.taskRandom =
      deps.createTaskRandom ??
      ((sessionId, needId) =>
        createTaskRandom(DAILY_TRAINING_ORCHESTRATION_TYPE, sessionId, needId));
    this.selectRenderer = deps.selectRenderer ?? selectDailyTrainingRenderer;
  }

  private async bounded<T>(operation: Promise<T>): Promise<T> {
    try {
      return await withPersistenceTimeout(operation);
    } catch (error) {
      if (error instanceof GameSessionError) {
        throw error;
      }
      if (isTimeoutFailure(error)) {
        throw new GameSessionError(
          "NETWORK_ERROR",
          "Persistence operation timed out",
        );
      }
      throw error;
    }
  }

  async start(): Promise<StartDailyTrainingResult> {
    const now = this.now();
    const sessionId = this.createSessionId();
    try {
      const plan = await this.bounded(
        planLearningSession({
          userId: this.deps.userId,
          now,
          requestedNeedCount:
            this.deps.requestedNeedCount ?? DAILY_TRAINING_TASK_COUNT,
          createId: () => this.createId(),
          random: this.schedulerRandom(sessionId),
          vocabulary: this.deps.vocabulary,
          query: this.deps.query,
        }),
      );
      if (plan.needs.length === 0) {
        throw new GameSessionError(
          "NO_LEARNING_NEEDS",
          "Scheduler returned no usable learning needs",
        );
      }
      const items: DailyTrainingItem[] = plan.needs.map((need) => ({
        needId: need.id,
        lexemeId: need.lexemeId,
        targetSkill: need.targetSkill,
        taskId: null,
        rendererGameType: null,
        status: "PLANNED",
      }));
      const record: DailyTrainingSessionRecord = {
        sessionId,
        userId: this.deps.userId,
        planId: plan.id,
        createdAt: now,
        needs: plan.needs,
        items,
        currentNeedIndex: 0,
        currentTaskId: null,
        phase: "awaiting_action",
        completed: 0,
        stats: { attempted: 0, correct: 0, incorrect: 0 },
        lastFeedback: null,
        lastCompletedTaskId: null,
        generationFailures: [],
        recentTasks: [],
        recentRendererTypes: [],
        attentionLexemeIds: [],
        revision: 0,
      };
      await this.persistCreate(record);
      const prepared = await this.generateFromCurrentNeed(record, now);
      await this.persist(record);
      return {
        session: publicProgress(record),
        task: prepared.task,
        rendererGameType: prepared.renderer.gameType,
      };
    } catch (error) {
      if (error instanceof GameSessionError) {
        if (error.code === "SESSION_CONFLICT") {
          throw new GameSessionError(
            "SESSION_START_FAILED",
            "Session start failed",
          );
        }
        throw error;
      }
      if (isTimeoutFailure(error)) {
        throw new GameSessionError(
          "NETWORK_ERROR",
          "Persistence operation timed out",
        );
      }
      const cause =
        error && typeof error === "object" && "message" in error
          ? String((error as { message: unknown }).message)
          : String(error);
      throw new GameSessionError("SESSION_START_FAILED", "Session start failed", {
        cause,
      });
    }
  }

  async submit(input: {
    sessionId: string;
    taskId: string;
    intent: StudentActionIntent;
    responseTimeMs: number | null;
  }): Promise<SubmitDailyTrainingResult> {
    const record = await this.requireSession(input.sessionId);
    if (record.phase === "completed") {
      throw new GameSessionError("SESSION_COMPLETED", "Session already completed");
    }
    if (record.lastCompletedTaskId === input.taskId) {
      if (record.phase !== "awaiting_continue") {
        record.phase = "awaiting_continue";
        try {
          await this.persist(record);
        } catch (error) {
          if (!this.isConflict(error)) {
            throw error;
          }
        }
      }
      throw new GameSessionError(
        "TASK_ALREADY_COMPLETED",
        "Task already has terminal evidence",
        { taskId: input.taskId },
      );
    }
    if (record.currentTaskId !== input.taskId) {
      throw new GameSessionError(
        "TASK_NOT_FOUND",
        "Submitted task is not the current training task",
        { taskId: input.taskId, currentTaskId: record.currentTaskId },
      );
    }
    const item = record.items[record.currentNeedIndex];
    const renderer = item?.rendererGameType
      ? rendererByGameType(item.rendererGameType)
      : undefined;
    if (!renderer) {
      throw new GameSessionError(
        "NO_COMPATIBLE_RENDERER",
        "Current training item has no renderer",
      );
    }
    const action: StudentAction = {
      ...input.intent,
      taskId: input.taskId,
      occurredAt: this.now(),
      responseTimeMs: input.responseTimeMs,
      hintCount: 0,
    };
    try {
      const submitted = await this.bounded(
        submitTaskAction({
          taskId: input.taskId,
          action,
          userId: record.userId,
          sessionId: record.sessionId,
          gameId: renderer.gameId,
          evidenceId: this.createEvidenceId(),
          learningTaskRepository: this.deps.tasks,
          learningRepository: this.deps.learning,
          now: action.occurredAt,
          createId: () => this.createId(),
        }),
      );
      const feedback = toGameSubmissionFeedback(submitted.evaluation);
      applySubmitOnce(record, input.taskId, feedback);
      try {
        await this.persist(record);
      } catch (error) {
        if (this.isConflict(error)) {
          return this.recoverSubmitAfterConflict(input.sessionId, input.taskId);
        }
        throw error;
      }
      return {
        feedback,
        progress: publicProgress(record),
        stats: { ...record.stats },
      };
    } catch (error) {
      if (this.isAlreadyCompleted(error)) {
        return this.recoverCompletedSubmit(record, input.taskId);
      }
      if (this.isConflict(error)) {
        return this.recoverSubmitAfterConflict(input.sessionId, input.taskId);
      }
      if (error instanceof TaskProtocolError && error.code === "TASK_NOT_FOUND") {
        throw new GameSessionError("TASK_NOT_FOUND", error.message, {
          taskId: input.taskId,
        });
      }
      throw error;
    }
  }

  async continue(sessionId: string): Promise<ContinueDailyTrainingResult> {
    return this.continueWithRetry(sessionId, MAX_SESSION_CONFLICT_RETRIES);
  }

  async resume(sessionId: string): Promise<ResumeDailyTrainingResult> {
    const record = await this.requireSession(sessionId);
    if (record.phase === "completed") {
      return {
        completed: true,
        progress: publicProgress(record),
        stats: { ...record.stats },
        recapWords: await this.recapWords(record),
      };
    }
    if (record.phase === "awaiting_continue") {
      return this.resumeAwaitingContinue(record);
    }
    if (record.currentTaskId) {
      return this.resumeCurrentTask(record);
    }
    try {
      await this.persist(record);
      const prepared = await this.generateFromCurrentNeed(record, this.now());
      await this.persist(record);
      return {
        completed: false,
        progress: publicProgress(record),
        stats: { ...record.stats },
        task: prepared.task,
        rendererGameType: prepared.renderer.gameType,
      };
    } catch (error) {
      if (!this.isConflict(error)) {
        throw error;
      }
      const latest = await this.requireSession(sessionId);
      return this.resumeFromLatest(latest);
    }
  }

  private async persistCreate(record: DailyTrainingSessionRecord): Promise<void> {
    try {
      const saved = await this.bounded(this.deps.sessions.create(record));
      record.revision = saved.revision;
    } catch (error) {
      persistFailure(error);
    }
  }

  private async persist(record: DailyTrainingSessionRecord): Promise<void> {
    try {
      const saved = await this.bounded(this.deps.sessions.save(record));
      record.revision = saved.revision;
    } catch (error) {
      persistFailure(error);
    }
  }

  private isConflict(error: unknown): boolean {
    return error instanceof GameSessionError && error.code === "SESSION_CONFLICT";
  }

  private async continueWithRetry(
    sessionId: string,
    retriesLeft: number,
  ): Promise<ContinueDailyTrainingResult> {
    try {
      return await this.continueOnce(sessionId);
    } catch (error) {
      if (!this.isConflict(error)) {
        throw error;
      }
      const latest = await this.requireSession(sessionId);
      const resolved = await this.resolveContinueFromLatest(latest);
      if (resolved) {
        return resolved;
      }
      if (latest.phase === "awaiting_continue" && retriesLeft > 0) {
        return this.continueWithRetry(sessionId, retriesLeft - 1);
      }
      throw error;
    }
  }

  private async continueOnce(
    sessionId: string,
  ): Promise<ContinueDailyTrainingResult> {
    const record = await this.requireSession(sessionId);
    if (record.phase === "completed") {
      return {
        completed: true,
        progress: publicProgress(record),
        stats: { ...record.stats },
        recapWords: await this.recapWords(record),
      };
    }
    if (record.phase === "awaiting_action") {
      if (record.currentTaskId) {
        return this.continueCurrentTask(record);
      }
      await this.persist(record);
      const recovered = await this.generateFromCurrentNeed(record, this.now());
      await this.persist(record);
      return {
        completed: false,
        progress: publicProgress(record),
        stats: { ...record.stats },
        task: recovered.task,
        rendererGameType: recovered.renderer.gameType,
      };
    }
    if (record.phase !== "awaiting_continue") {
      throw new GameSessionError(
        "SESSION_START_FAILED",
        "Session is not ready to continue",
      );
    }
    record.currentNeedIndex += 1;
    record.currentTaskId = null;
    record.lastFeedback = null;
    if (record.currentNeedIndex >= record.needs.length) {
      record.phase = "completed";
      await this.persist(record);
      return {
        completed: true,
        progress: publicProgress(record),
        stats: { ...record.stats },
        recapWords: await this.recapWords(record),
      };
    }
    record.phase = "awaiting_action";
    await this.persist(record);
    const prepared = await this.generateFromCurrentNeed(record, this.now());
    await this.persist(record);
    return {
      completed: false,
      progress: publicProgress(record),
      stats: { ...record.stats },
      task: prepared.task,
      rendererGameType: prepared.renderer.gameType,
    };
  }

  private async resolveContinueFromLatest(
    latest: DailyTrainingSessionRecord,
  ): Promise<ContinueDailyTrainingResult | null> {
    if (latest.phase === "completed") {
      return {
        completed: true,
        progress: publicProgress(latest),
        stats: { ...latest.stats },
        recapWords: await this.recapWords(latest),
      };
    }
    if (latest.phase === "awaiting_action" && latest.currentTaskId) {
      return this.continueCurrentTask(latest);
    }
    return null;
  }

  private async continueCurrentTask(
    record: DailyTrainingSessionRecord,
  ): Promise<ContinueDailyTrainingResult> {
    if (!record.currentTaskId) {
      throw new GameSessionError("TASK_NOT_FOUND", "Current task missing");
    }
    const assigned = await this.bounded(
      this.deps.tasks.getTaskForEvaluation({
        taskId: record.currentTaskId,
        userId: record.userId,
        sessionId: record.sessionId,
      }),
    );
    if (!assigned) {
      throw new GameSessionError("TASK_NOT_FOUND", "Current task missing");
    }
    return {
      completed: false,
      progress: publicProgress(record),
      stats: { ...record.stats },
      task: assigned.task.publicTask,
      rendererGameType: publicProgress(record).rendererGameType ?? undefined,
    };
  }

  private async recoverSubmitAfterConflict(
    sessionId: string,
    taskId: string,
  ): Promise<SubmitDailyTrainingResult> {
    const latest = await this.requireSession(sessionId);
    if (latest.lastCompletedTaskId === taskId && latest.lastFeedback) {
      return {
        feedback: latest.lastFeedback,
        progress: publicProgress(latest),
        stats: { ...latest.stats },
      };
    }
    return this.recoverCompletedSubmit(latest, taskId);
  }

  private async resumeAwaitingContinue(
    record: DailyTrainingSessionRecord,
  ): Promise<ResumeDailyTrainingResult> {
    const current = record.currentTaskId
      ? await this.resumeCurrentTask(record)
      : null;
    return {
      completed: false,
      progress: publicProgress(record),
      stats: { ...record.stats },
      feedback: record.lastFeedback ?? undefined,
      task: current?.task,
      rendererGameType:
        current?.rendererGameType ??
        publicProgress(record).rendererGameType ??
        undefined,
    };
  }

  private async resumeCurrentTask(
    record: DailyTrainingSessionRecord,
  ): Promise<ResumeDailyTrainingResult> {
    if (!record.currentTaskId) {
      throw new GameSessionError("TASK_NOT_FOUND", "Active task was not found");
    }
    const assigned = await this.bounded(
      this.deps.tasks.getTaskForEvaluation({
        taskId: record.currentTaskId,
        userId: record.userId,
        sessionId: record.sessionId,
      }),
    );
    if (!assigned) {
      throw new GameSessionError("TASK_NOT_FOUND", "Active task was not found");
    }
    return {
      completed: false,
      progress: publicProgress(record),
      stats: { ...record.stats },
      task: assigned.task.publicTask,
      rendererGameType: publicProgress(record).rendererGameType ?? undefined,
    };
  }

  private async resumeFromLatest(
    latest: DailyTrainingSessionRecord,
  ): Promise<ResumeDailyTrainingResult> {
    if (latest.phase === "completed") {
      return {
        completed: true,
        progress: publicProgress(latest),
        stats: { ...latest.stats },
        recapWords: await this.recapWords(latest),
      };
    }
    if (latest.phase === "awaiting_continue") {
      return this.resumeAwaitingContinue(latest);
    }
    if (latest.currentTaskId) {
      return this.resumeCurrentTask(latest);
    }
    throw new GameSessionError(
      "SESSION_CONFLICT",
      "Session was updated by another request",
    );
  }

  private isAlreadyCompleted(error: unknown): boolean {
    return (
      (error instanceof TaskProtocolError &&
        error.code === "TASK_ALREADY_COMPLETED") ||
      (error instanceof LearningDomainError &&
        error.code === "DUPLICATE_TASK_EVIDENCE")
    );
  }

  private async recoverCompletedSubmit(
    record: DailyTrainingSessionRecord,
    taskId: string,
  ): Promise<SubmitDailyTrainingResult> {
    if (record.lastCompletedTaskId === taskId && record.lastFeedback) {
      record.phase = "awaiting_continue";
      try {
        await this.persist(record);
      } catch (error) {
        if (!this.isConflict(error)) {
          throw error;
        }
      }
      throw new GameSessionError(
        "TASK_ALREADY_COMPLETED",
        "Task already has terminal evidence",
        { taskId },
      );
    }
    const assigned = await this.bounded(
      this.deps.tasks.getTaskForEvaluation({
        taskId,
        userId: record.userId,
        sessionId: record.sessionId,
      }),
    );
    if (!assigned) {
      throw new GameSessionError("TASK_NOT_FOUND", "Completed task was not found");
    }
    const evidence = await this.findTaskEvidence(
      record.userId,
      assigned.task.publicTask.lexemeId,
      taskId,
    );
    if (!evidence) {
      throw new GameSessionError(
        "TASK_ALREADY_COMPLETED",
        "Task already has terminal evidence",
        { taskId },
      );
    }
    const feedback = toGameSubmissionFeedbackFromOutcome(
      evidence.outcome,
      evidence.expectedAnswer,
    );
    const applied = applySubmitOnce(record, taskId, feedback);
    try {
      await this.persist(record);
    } catch (error) {
      if (!this.isConflict(error)) {
        throw error;
      }
      const latest = await this.requireSession(record.sessionId);
      if (latest.lastCompletedTaskId === taskId && latest.lastFeedback) {
        if (!applied) {
          throw new GameSessionError(
            "TASK_ALREADY_COMPLETED",
            "Task already has terminal evidence",
            { taskId },
          );
        }
        return {
          feedback: latest.lastFeedback,
          progress: publicProgress(latest),
          stats: { ...latest.stats },
        };
      }
      throw error;
    }
    if (!applied) {
      throw new GameSessionError(
        "TASK_ALREADY_COMPLETED",
        "Task already has terminal evidence",
        { taskId },
      );
    }
    return {
      feedback,
      progress: publicProgress(record),
      stats: { ...record.stats },
    };
  }

  private async findTaskEvidence(
    userId: string,
    lexemeId: string,
    taskId: string,
  ): Promise<LearningEvidence | undefined> {
    const items = await this.bounded(
      this.deps.learning.getEvidenceForLexeme(userId, lexemeId),
    );
    return items.find((item) => item.taskId === taskId);
  }

  private async requireSession(
    sessionId: string,
  ): Promise<DailyTrainingSessionRecord> {
    let record: DailyTrainingSessionRecord | null;
    try {
      record = await this.bounded(this.deps.sessions.get(sessionId));
    } catch (error) {
      if (error instanceof GameSessionError) {
        throw error;
      }
      return persistFailure(error);
    }
    if (!record) {
      throw new GameSessionError(
        "SESSION_NOT_FOUND",
        `Session ${sessionId} was not found`,
      );
    }
    if (record.userId !== this.deps.userId) {
      throw new GameSessionError(
        "SESSION_NOT_FOUND",
        "Session does not belong to the current user",
      );
    }
    return record;
  }

  private async generateFromCurrentNeed(
    record: DailyTrainingSessionRecord,
    now: string,
  ): Promise<{ task: PublicLearningTask; renderer: TrainingRendererDefinition }> {
    const remaining = record.needs.length - record.currentNeedIndex;
    for (let attempt = 0; attempt < remaining; attempt += 1) {
      const need = record.needs[record.currentNeedIndex];
      if (!need) {
        break;
      }
      const generated = await this.tryGenerate(record, need, now);
      if (generated) {
        return generated;
      }
      const skipped = record.items[record.currentNeedIndex];
      if (skipped) {
        skipped.status = "SKIPPED";
      }
      record.currentNeedIndex += 1;
    }
    throw new GameSessionError(
      "TASK_GENERATION_FAILED",
      "No remaining planned need produced a playable task",
      { failures: record.generationFailures },
    );
  }

  private async tryGenerate(
    record: DailyTrainingSessionRecord,
    need: LearningNeed,
    now: string,
  ): Promise<{
    task: PublicLearningTask;
    renderer: TrainingRendererDefinition;
  } | null> {
    const generation = await this.generator.generate({
      need,
      desiredDifficulty: 0.45,
      recentTasks: record.recentTasks,
      now,
      createId: () => this.createId(),
      random: this.taskRandom(record.sessionId, need.id),
    });
    if (generation.status === "UNAVAILABLE") {
      record.generationFailures.push({
        needId: need.id,
        lexemeId: need.lexemeId,
        skill: need.targetSkill,
        code: generation.code,
        reason: generation.reason,
      });
      return null;
    }
    const publicTask = generation.value.publicTask;
    let renderer: TrainingRendererDefinition;
    try {
      renderer = this.selectRenderer({
        task: publicTask,
        recentRendererTypes: record.recentRendererTypes,
      });
    } catch (error) {
      if (
        error instanceof GameSessionError &&
        error.code === "NO_COMPATIBLE_RENDERER"
      ) {
        record.generationFailures.push({
          needId: need.id,
          lexemeId: need.lexemeId,
          skill: need.targetSkill,
          code: "NO_COMPATIBLE_RENDERER",
          reason: "NO_COMPATIBLE_RENDERER",
        });
        return null;
      }
      throw error;
    }
    await this.bounded(
      this.deps.tasks.saveGeneratedTask({
        task: generation.value,
        assignment: {
          userId: record.userId,
          sessionId: record.sessionId,
        },
      }),
    );
    const item = record.items[record.currentNeedIndex];
    if (item) {
      item.taskId = publicTask.id;
      item.rendererGameType = renderer.gameType;
      item.status = "READY";
    }
    record.currentTaskId = publicTask.id;
    record.phase = "awaiting_action";
    record.recentTasks.push({
      taskId: publicTask.id,
      taskType: publicTask.taskType,
      lexemeId: publicTask.lexemeId,
    });
    record.recentRendererTypes.push(renderer.gameType);
    return { task: publicTask, renderer };
  }

  private async recapWords(
    record: DailyTrainingSessionRecord,
  ): Promise<string[]> {
    const ids = record.attentionLexemeIds.slice(0, 3);
    const words: string[] = [];
    for (const lexemeId of ids) {
      const lexeme = await this.deps.vocabulary.getLexeme(lexemeId);
      const lemma = lexeme?.lemma?.trim() || lexeme?.display?.trim();
      if (lemma) {
        words.push(lemma);
      }
    }
    return words;
  }
}
