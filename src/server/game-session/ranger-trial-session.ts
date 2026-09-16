import type { LearningRepository } from "@/domain/learning/learning-repository";
import type { LearningNeed } from "@/domain/learning/learning-need";
import { DefaultTaskGenerator } from "@/domain/tasks/default-task-generator";
import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import type { LearningTaskRepository } from "@/domain/tasks/learning-task-repository";
import {
  SeededRandomSource,
  type RandomSource,
} from "@/domain/tasks/random-source";
import type { StudentAction } from "@/domain/tasks/student-action";
import type { TaskGenerator } from "@/domain/tasks/task-generator";
import { TaskProtocolError } from "@/domain/tasks/task-evaluator";
import type { VocabularyRepository } from "@/domain/vocabulary/vocabulary-repository";
import { planLearningSession } from "@/server/scheduler/plan-learning-session";
import type { LearningStateQueryRepository } from "@/server/scheduler/learning-state-query-repository";
import { submitTaskAction } from "@/server/tasks/submit-task-action";
import { RANGER_TRIAL_GAME_ID } from "@/server/auth/v1-user";
import { assertRangerTrialCanRender } from "./can-game-render-task";
import { toGameSubmissionFeedback } from "./game-submission-feedback";
import { GameSessionError } from "./ranger-trial-errors";
import type { RangerTrialSessionStore } from "./ranger-trial-session.types";
import type {
  ContinueRangerTrialResult,
  RangerTrialPublicSession,
  RangerTrialSessionRecord,
  ResumeRangerTrialResult,
  StartRangerTrialResult,
  StudentActionIntent,
  SubmitRangerTrialResult,
} from "./ranger-trial-session.types";

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
  random?: RandomSource;
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

export class RangerTrialSessionController {
  private readonly generator: TaskGenerator;
  private readonly now: () => string;
  private readonly createSessionId: () => string;
  private readonly createId: () => string;
  private readonly createEvidenceId: () => string;
  private readonly random: RandomSource;
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
    this.random = deps.random ?? new SeededRandomSource("ranger-trial");
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
        random: this.random,
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
        generationFailures: [],
        recentTasks: [],
      };
      const task = await this.generateFromCurrentNeed(record, now);
      await this.deps.sessions.save(record);
      return { session: publicProgress(record), task };
    } catch (error) {
      if (error instanceof GameSessionError) {
        throw error;
      }
      throw new GameSessionError(
        "SESSION_START_FAILED",
        error instanceof Error ? error.message : "Session start failed",
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
      record.lastFeedback = feedback;
      record.phase = "awaiting_continue";
      record.stats.attempted += 1;
      record.completed += 1;
      if (isCorrectStatus(feedback.status)) {
        record.stats.correct += 1;
      } else if (feedback.status === "INCORRECT") {
        record.stats.incorrect += 1;
      }
      await this.deps.sessions.save(record);
      return {
        feedback,
        progress: publicProgress(record),
        stats: { ...record.stats },
      };
    } catch (error) {
      if (error instanceof TaskProtocolError) {
        if (error.code === "TASK_ALREADY_COMPLETED") {
          throw new GameSessionError(
            "TASK_ALREADY_COMPLETED",
            error.message,
            { taskId: input.taskId },
          );
        }
        if (error.code === "TASK_NOT_FOUND") {
          throw new GameSessionError("TASK_NOT_FOUND", error.message, {
            taskId: input.taskId,
          });
        }
      }
      throw error;
    }
  }

  async continue(sessionId: string): Promise<ContinueRangerTrialResult> {
    const record = await this.requireSession(sessionId);
    if (record.phase === "completed") {
      return {
        completed: true,
        progress: publicProgress(record),
        stats: { ...record.stats },
      };
    }
    if (record.phase !== "awaiting_continue") {
      if (record.phase === "awaiting_action" && record.currentTaskId) {
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
      await this.deps.sessions.save(record);
      return {
        completed: true,
        progress: publicProgress(record),
        stats: { ...record.stats },
      };
    }
    const now = this.now();
    const task = await this.generateFromCurrentNeed(record, now);
    await this.deps.sessions.save(record);
    return {
      completed: false,
      progress: publicProgress(record),
      stats: { ...record.stats },
      task,
    };
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
    if (!record.currentTaskId) {
      const task = await this.generateFromCurrentNeed(record, this.now());
      await this.deps.sessions.save(record);
      return {
        completed: false,
        progress: publicProgress(record),
        stats: { ...record.stats },
        task,
      };
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

  private async requireSession(
    sessionId: string,
  ): Promise<RangerTrialSessionRecord> {
    const record = await this.deps.sessions.get(sessionId);
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
      random: this.random,
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
