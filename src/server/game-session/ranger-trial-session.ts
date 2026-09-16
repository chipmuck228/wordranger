import type { LearningRepository } from "@/domain/learning/learning-repository";
import type { LearningNeed } from "@/domain/learning/learning-need";
import type { LearningEvidence } from "@/domain/learning/evidence.types";
import { DefaultTaskGenerator } from "@/domain/tasks/default-task-generator";
import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import type { LearningTaskRepository } from "@/domain/tasks/learning-task-repository";
import type { RandomSource } from "@/domain/tasks/random-source";
import type { StudentAction } from "@/domain/tasks/student-action";
import type { TaskGenerator } from "@/domain/tasks/task-generator";
import { TaskProtocolError } from "@/domain/tasks/task-evaluator";
import { LearningDomainError } from "@/domain/learning/engine/math";
import type { VocabularyRepository } from "@/domain/vocabulary/vocabulary-repository";
import { planLearningSession } from "@/server/scheduler/plan-learning-session";
import type { LearningStateQueryRepository } from "@/server/scheduler/learning-state-query-repository";
import { submitTaskAction } from "@/server/tasks/submit-task-action";
import { RANGER_TRIAL_GAME_ID } from "@/server/auth/v1-user";
import { assertRangerTrialCanRender } from "./can-game-render-task";
import {
  toGameSubmissionFeedback,
  toGameSubmissionFeedbackFromOutcome,
} from "./game-submission-feedback";
import { GameSessionError } from "./ranger-trial-errors";
import { createSchedulerRandom, createTaskRandom } from "./ranger-trial-seeds";
import type { RangerTrialSessionStore } from "./ranger-trial-session.types";
import type {
  ContinueRangerTrialResult,
  GameSubmissionFeedback,
  RangerTrialPublicSession,
  RangerTrialSessionRecord,
  ResumeRangerTrialResult,
  StartRangerTrialResult,
  StudentActionIntent,
  SubmitRangerTrialResult,
} from "./ranger-trial-session.types";

const MAX_SESSION_CONFLICT_RETRIES = 1;

export interface RangerTrialSessionDeps {
  userId: string;
  vocabulary: VocabularyRepository;
  query: LearningStateQueryRepository;
  tasks: LearningTaskRepository;
  learning: LearningRepository;
  sessions: RangerTrialSessionStore;
  generator?: TaskGenerator;
  now?: () => string;
  createSessionId?: () => string;
  createId?: () => string;
  createEvidenceId?: () => string;
  createSchedulerRandom?: (sessionId: string) => RandomSource;
  createTaskRandom?: (sessionId: string, needId: string) => RandomSource;
  requestedNeedCount?: number;
}

function publicProgress(
  record: RangerTrialSessionRecord,
): RangerTrialPublicSession {
  return {
    sessionId: record.sessionId,
    planId: record.planId,
    current: Math.min(record.currentNeedIndex + 1, record.needs.length),
    total: record.needs.length,
    completed: record.completed,
    currentTaskId: record.currentTaskId,
  };
}

function isCorrectStatus(status: string): boolean {
  return status === "CORRECT" || status === "ASSISTED";
}

function submitResult(
  record: RangerTrialSessionRecord,
  feedback: GameSubmissionFeedback,
): SubmitRangerTrialResult {
  return {
    feedback,
    progress: publicProgress(record),
    stats: { ...record.stats },
  };
}

function applySubmitOnce(
  record: RangerTrialSessionRecord,
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
  return true;
}

function persistFailure(error: unknown): never {
  if (error instanceof GameSessionError) {
    throw error;
  }
  throw new GameSessionError(
    "NETWORK_ERROR",
    "Could not persist the game session",
  );
}

export class RangerTrialSessionController {
  private readonly generator: TaskGenerator;
  private readonly now: () => string;
  private readonly createSessionId: () => string;
  private readonly createId: () => string;
  private readonly createEvidenceId: () => string;
  private readonly schedulerRandom: (sessionId: string) => RandomSource;
  private readonly taskRandom: (sessionId: string, needId: string) => RandomSource;
  private idSeq = 0;

  constructor(private readonly deps: RangerTrialSessionDeps) {
    this.generator =
      deps.generator ?? new DefaultTaskGenerator(deps.vocabulary);
    this.now = deps.now ?? (() => new Date().toISOString());
    this.createSessionId =
      deps.createSessionId ?? (() => crypto.randomUUID());
    this.createId =
      deps.createId ??
      (() => {
        this.idSeq += 1;
        return `ranger-id-${this.idSeq}`;
      });
    this.createEvidenceId =
      deps.createEvidenceId ?? (() => crypto.randomUUID());
    this.schedulerRandom = deps.createSchedulerRandom ?? createSchedulerRandom;
    this.taskRandom = deps.createTaskRandom ?? createTaskRandom;
  }

  async start(): Promise<StartRangerTrialResult> {
    const now = this.now();
    const sessionId = this.createSessionId();
    try {
      const plan = await planLearningSession({
        userId: this.deps.userId,
        now,
        requestedNeedCount: this.deps.requestedNeedCount ?? 8,
        createId: () => this.createId(),
        random: this.schedulerRandom(sessionId),
        vocabulary: this.deps.vocabulary,
        query: this.deps.query,
      });
      if (plan.needs.length === 0) {
        throw new GameSessionError(
          "NO_LEARNING_NEEDS",
          "Scheduler returned no usable learning needs",
        );
      }
      const record: RangerTrialSessionRecord = {
        sessionId,
        userId: this.deps.userId,
        planId: plan.id,
        createdAt: now,
        needs: plan.needs,
        currentNeedIndex: 0,
        currentTaskId: null,
        phase: "awaiting_action",
        completed: 0,
        stats: { attempted: 0, correct: 0, incorrect: 0 },
        lastFeedback: null,
        lastCompletedTaskId: null,
        generationFailures: [],
        recentTasks: [],
        revision: 0,
      };
      const task = await this.generateFromCurrentNeed(record, now);
      await this.persistCreate(record);
      return { session: publicProgress(record), task };
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
      throw new GameSessionError(
        "SESSION_START_FAILED",
        "Session start failed",
      );
    }
  }

  async submit(input: {
    sessionId: string;
    taskId: string;
    intent: StudentActionIntent;
    responseTimeMs: number | null;
  }): Promise<SubmitRangerTrialResult> {
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
        "Submitted task is not the current Ranger Trial task",
        { taskId: input.taskId, currentTaskId: record.currentTaskId },
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
      const submitted = await submitTaskAction({
        taskId: input.taskId,
        action,
        userId: record.userId,
        sessionId: record.sessionId,
        gameId: RANGER_TRIAL_GAME_ID,
        evidenceId: this.createEvidenceId(),
        learningTaskRepository: this.deps.tasks,
        learningRepository: this.deps.learning,
        now: action.occurredAt,
        createId: () => this.createId(),
      });
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
      return submitResult(record, feedback);
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

  async continue(sessionId: string): Promise<ContinueRangerTrialResult> {
    return this.continueWithRetry(sessionId, MAX_SESSION_CONFLICT_RETRIES);
  }

  async resume(sessionId: string): Promise<ResumeRangerTrialResult> {
    const record = await this.requireSession(sessionId);
    if (record.phase === "completed") {
      return {
        completed: true,
        progress: publicProgress(record),
        stats: { ...record.stats },
      };
    }
    if (record.phase === "awaiting_continue") {
      return {
        completed: false,
        progress: publicProgress(record),
        stats: { ...record.stats },
        feedback: record.lastFeedback ?? undefined,
      };
    }
    if (record.currentTaskId) {
      return this.resumeCurrentTask(record);
    }
    try {
      await this.persist(record);
      const task = await this.generateFromCurrentNeed(record, this.now());
      await this.persist(record);
      return {
        completed: false,
        progress: publicProgress(record),
        stats: { ...record.stats },
        task,
      };
    } catch (error) {
      if (!this.isConflict(error)) {
        throw error;
      }
      const latest = await this.requireSession(sessionId);
      return this.resumeFromLatest(latest);
    }
  }

  private async persistCreate(record: RangerTrialSessionRecord): Promise<void> {
    try {
      const saved = await this.deps.sessions.create(record);
      record.revision = saved.revision;
    } catch (error) {
      persistFailure(error);
    }
  }

  private async persist(record: RangerTrialSessionRecord): Promise<void> {
    try {
      const saved = await this.deps.sessions.save(record);
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
  ): Promise<ContinueRangerTrialResult> {
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
  ): Promise<ContinueRangerTrialResult> {
    const record = await this.requireSession(sessionId);
    if (record.phase === "completed") {
      return {
        completed: true,
        progress: publicProgress(record),
        stats: { ...record.stats },
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
        task: recovered,
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
      };
    }
    record.phase = "awaiting_action";
    await this.persist(record);
    const task = await this.generateFromCurrentNeed(record, this.now());
    await this.persist(record);
    return {
      completed: false,
      progress: publicProgress(record),
      stats: { ...record.stats },
      task,
    };
  }

  private async resolveContinueFromLatest(
    latest: RangerTrialSessionRecord,
  ): Promise<ContinueRangerTrialResult | null> {
    if (latest.phase === "completed") {
      return {
        completed: true,
        progress: publicProgress(latest),
        stats: { ...latest.stats },
      };
    }
    if (latest.phase === "awaiting_action" && latest.currentTaskId) {
      return this.continueCurrentTask(latest);
    }
    return null;
  }

  private async continueCurrentTask(
    record: RangerTrialSessionRecord,
  ): Promise<ContinueRangerTrialResult> {
    if (!record.currentTaskId) {
      throw new GameSessionError("TASK_NOT_FOUND", "Current task missing");
    }
    const assigned = await this.deps.tasks.getTaskForEvaluation(
      record.currentTaskId,
    );
    if (!assigned) {
      throw new GameSessionError("TASK_NOT_FOUND", "Current task missing");
    }
    return {
      completed: false,
      progress: publicProgress(record),
      stats: { ...record.stats },
      task: assigned.task.publicTask,
    };
  }

  private async recoverSubmitAfterConflict(
    sessionId: string,
    taskId: string,
  ): Promise<SubmitRangerTrialResult> {
    const latest = await this.requireSession(sessionId);
    if (latest.lastCompletedTaskId === taskId && latest.lastFeedback) {
      return submitResult(latest, latest.lastFeedback);
    }
    return this.recoverCompletedSubmit(latest, taskId);
  }

  private async resumeCurrentTask(
    record: RangerTrialSessionRecord,
  ): Promise<ResumeRangerTrialResult> {
    if (!record.currentTaskId) {
      throw new GameSessionError("TASK_NOT_FOUND", "Active task was not found");
    }
    const assigned = await this.deps.tasks.getTaskForEvaluation(
      record.currentTaskId,
    );
    if (!assigned) {
      throw new GameSessionError("TASK_NOT_FOUND", "Active task was not found");
    }
    return {
      completed: false,
      progress: publicProgress(record),
      stats: { ...record.stats },
      task: assigned.task.publicTask,
    };
  }

  private async resumeFromLatest(
    latest: RangerTrialSessionRecord,
  ): Promise<ResumeRangerTrialResult> {
    if (latest.phase === "completed") {
      return {
        completed: true,
        progress: publicProgress(latest),
        stats: { ...latest.stats },
      };
    }
    if (latest.phase === "awaiting_continue") {
      return {
        completed: false,
        progress: publicProgress(latest),
        stats: { ...latest.stats },
        feedback: latest.lastFeedback ?? undefined,
      };
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
    record: RangerTrialSessionRecord,
    taskId: string,
  ): Promise<SubmitRangerTrialResult> {
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
    const assigned = await this.deps.tasks.getTaskForEvaluation(taskId);
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
        return submitResult(latest, latest.lastFeedback);
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
    return submitResult(record, feedback);
  }

  private async findTaskEvidence(
    userId: string,
    lexemeId: string,
    taskId: string,
  ): Promise<LearningEvidence | undefined> {
    const items = await this.deps.learning.getEvidenceForLexeme(userId, lexemeId);
    return items.find((item) => item.taskId === taskId);
  }

  private async requireSession(
    sessionId: string,
  ): Promise<RangerTrialSessionRecord> {
    let record: RangerTrialSessionRecord | null;
    try {
      record = await this.deps.sessions.get(sessionId);
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
    record: RangerTrialSessionRecord,
    now: string,
  ): Promise<PublicLearningTask> {
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
      record.currentNeedIndex += 1;
    }
    throw new GameSessionError(
      "TASK_GENERATION_FAILED",
      "No remaining planned need produced a playable task",
      { failures: record.generationFailures },
    );
  }

  private async tryGenerate(
    record: RangerTrialSessionRecord,
    need: LearningNeed,
    now: string,
  ): Promise<PublicLearningTask | null> {
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
    assertRangerTrialCanRender(generation.value.publicTask);
    await this.deps.tasks.saveGeneratedTask({
      task: generation.value,
      assignment: {
        userId: record.userId,
        sessionId: record.sessionId,
      },
    });
    record.currentTaskId = generation.value.publicTask.id;
    record.phase = "awaiting_action";
    record.recentTasks.push({
      taskId: generation.value.publicTask.id,
      taskType: generation.value.publicTask.taskType,
      lexemeId: generation.value.publicTask.lexemeId,
    });
    return generation.value.publicTask;
  }
}
