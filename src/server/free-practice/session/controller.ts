import "server-only";

import type { LearningRepository } from "@/domain/learning/learning-repository";
import { DefaultTaskGenerator } from "@/domain/tasks/default-task-generator";
import type { LearningTaskRepository } from "@/domain/tasks/learning-task-repository";
import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import type { StudentAction } from "@/domain/tasks/student-action";
import type { TaskGenerator } from "@/domain/tasks/task-generator";
import { TaskProtocolError } from "@/domain/tasks/task-evaluator";
import type { VocabularyRepository } from "@/domain/vocabulary/vocabulary-repository";
import { resolveFreePracticeIdentity } from "@/server/free-practice/identity/resolve-free-practice-identity";
import type { ReadFreePracticeSession } from "@/server/free-practice/identity/types";
import { planFreePractice } from "@/server/free-practice/planning/plan-free-practice";
import type {
  FreePracticePlanReadPort,
  FreePracticeRequest,
} from "@/server/free-practice/planning/types";
import { createTaskRandom } from "@/server/game-session/ranger-trial-seeds";
import type { StudentActionIntent } from "@/server/game-session/learning-game-session.types";
import { ensureAssignedGeneratedTask } from "@/server/tasks/ensure-assigned-generated-task";
import { submitTaskAction } from "@/server/tasks/submit-task-action";
import {
  FREE_PRACTICE_ORCHESTRATION_TYPE,
  FREE_PRACTICE_PRESENTATION_GAME_TYPE,
  FREE_PRACTICE_SESSION_SCHEMA_VERSION,
} from "./constants";
import { createFreePracticeGenerationIds } from "./deterministic-ids";
import { FreePracticeSessionError } from "./errors";
import {
  toFreePracticePublicFeedbackFromEvaluation,
  toFreePracticePublicFeedbackFromOutcome,
} from "./feedback";
import {
  toAwaitingContinue,
  toCompleted,
  toStartedOrResumed,
} from "./public-payload";
import { toTaskGenerationProjection } from "./to-task-generation-projection";
import type {
  FreePracticePublicFeedback,
  FreePracticeSessionPublicResult,
  FreePracticeSessionRecord,
  FreePracticeSessionStore,
} from "./types";

const MAX_SESSION_CONFLICT_RETRIES = 1;

const FORBIDDEN_CLIENT_INJECTION_KEYS = new Set([
  "userId",
  "outcome",
  "correct",
  "score",
  "evidence",
  "answerKey",
  "learningNeedId",
  "gameId",
  "hintCount",
  "assignedItemId",
  "nextIndex",
  "currentIndex",
  "items",
  "evaluation",
  "expectedAnswer",
  "ownership",
  "sessionOwnership",
]);

export interface FreePracticeSessionControllerDeps {
  vocabulary: VocabularyRepository;
  read: FreePracticePlanReadPort;
  tasks: LearningTaskRepository;
  sessions: FreePracticeSessionStore;
  learning: LearningRepository;
  readSession: ReadFreePracticeSession;
  env?: Record<string, string | undefined>;
  generator?: TaskGenerator;
  now?: () => string;
  createSessionId?: () => string;
  createId?: () => string;
  createEvidenceId?: () => string;
}

function requestFromPayload(payload: unknown): FreePracticeRequest | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const source = (payload as { source?: unknown }).source;
  const requestedCount = (payload as { requestedCount?: unknown })
    .requestedCount;
  if (
    (source !== "UNSEEN" && source !== "RECENTLY_INCORRECT") ||
    (requestedCount !== 5 && requestedCount !== 10)
  ) {
    return null;
  }
  return { source, requestedCount };
}

function hasForbiddenClientInjection(payload: unknown): boolean {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }
  return Object.keys(payload).some((key) =>
    FORBIDDEN_CLIENT_INJECTION_KEYS.has(key),
  );
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function readRevision(value: unknown): number | null {
  return Number.isInteger(value) && (value as number) >= 0
    ? (value as number)
    : null;
}

function readIntent(value: unknown): StudentActionIntent | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const kind = (value as { kind?: unknown }).kind;
  if (kind === "CHOICE") {
    const optionId = (value as { optionId?: unknown }).optionId;
    return typeof optionId === "string" && optionId.trim()
      ? { kind: "CHOICE", optionId }
      : null;
  }
  if (kind === "TEXT_INPUT") {
    const text = (value as { value?: unknown }).value;
    return typeof text === "string" ? { kind: "TEXT_INPUT", value: text } : null;
  }
  return null;
}

/**
 * Client responseTimeMs is untrusted telemetry only. It is never used
 * for scoring, authorization, or Evidence recovery.
 */
function readResponseTimeMs(value: unknown): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function intentMatchesTask(
  task: PublicLearningTask,
  intent: StudentActionIntent,
): boolean {
  if (intent.kind === "CHOICE") {
    return (
      task.responseContract.kind === "CHOICE" &&
      task.responseContract.options.some(
        (option) => option.id === intent.optionId,
      )
    );
  }
  return task.responseContract.kind === "TEXT_INPUT";
}

function applySubmitOnce(
  record: FreePracticeSessionRecord,
  taskId: string,
  feedback: FreePracticePublicFeedback,
): boolean {
  if (record.state.currentTaskId !== taskId) {
    return false;
  }
  if (record.state.lastCompletedTaskId === taskId) {
    record.state.phase = "AWAITING_CONTINUE";
    if (!record.state.feedback) {
      record.state.feedback = feedback;
    }
    return false;
  }
  record.state.lastCompletedTaskId = taskId;
  record.state.feedback = feedback;
  record.state.phase = "AWAITING_CONTINUE";
  record.state.attempted += 1;
  if (feedback.correct) {
    record.state.correct += 1;
  }
  return true;
}

/**
 * Slice 3B / 5A server-only orchestration. Answers enter the frozen
 * learning pipeline only through submitTaskAction.
 */
export class FreePracticeSessionController {
  private readonly generator: TaskGenerator;
  private readonly now: () => string;
  private readonly createSessionId: () => string;
  private readonly createId: () => string;
  private readonly createEvidenceId: () => string;

  constructor(private readonly deps: FreePracticeSessionControllerDeps) {
    this.generator =
      deps.generator ?? new DefaultTaskGenerator(deps.vocabulary);
    this.now = deps.now ?? (() => new Date().toISOString());
    this.createSessionId =
      deps.createSessionId ?? (() => crypto.randomUUID());
    this.createId = deps.createId ?? (() => crypto.randomUUID());
    this.createEvidenceId =
      deps.createEvidenceId ?? (() => crypto.randomUUID());
  }

  async start(
    untrustedClientPayload?: unknown,
  ): Promise<FreePracticeSessionPublicResult> {
    const identity = await this.resolveIdentity(untrustedClientPayload);
    if (identity.status === "UNAVAILABLE") {
      return { status: "UNAVAILABLE", reason: identity.reason };
    }
    const request = requestFromPayload(untrustedClientPayload);
    if (!request) {
      return { status: "INVALID", reason: "INVALID_REQUEST" };
    }
    const plan = await planFreePractice({
      userId: identity.userId,
      request,
      vocabulary: this.deps.vocabulary,
      read: this.deps.read,
      createId: () => this.createId(),
    });
    if (plan.status === "REJECTED") {
      return { status: "INVALID", reason: "INVALID_REQUEST" };
    }
    if (plan.status === "EMPTY") {
      return {
        status: "EMPTY",
        source: request.source,
        requestedCount: request.requestedCount,
        reason: "NO_ELIGIBLE_WORDS",
      };
    }
    const now = this.now();
    const sessionId = this.createSessionId();
    const record: FreePracticeSessionRecord = {
      sessionId,
      userId: identity.userId,
      planId: `fp-plan:${sessionId}`,
      revision: 0,
      state: {
        schemaVersion: FREE_PRACTICE_SESSION_SCHEMA_VERSION,
        source: request.source,
        requestedCount: request.requestedCount,
        plannedCount: plan.items.length,
        items: plan.items,
        currentIndex: 0,
        assignedItemId: null,
        currentTaskId: null,
        phase: "AWAITING_ACTION",
        attempted: 0,
        correct: 0,
        lastCompletedTaskId: null,
        feedback: null,
        createdAt: now,
        completedAt: null,
      },
    };
    const created = await this.deps.sessions.create(record);
    try {
      const tasked = await this.ensureCurrentTask(created);
      return toStartedOrResumed("STARTED", tasked.record, tasked.task);
    } catch (error) {
      if (
        error instanceof FreePracticeSessionError &&
        error.code === "TASK_GENERATION_FAILED"
      ) {
        return { status: "UNAVAILABLE", reason: "TASK_GENERATION_FAILED" };
      }
      throw error;
    }
  }

  async load(
    sessionId: string,
    untrustedClientPayload?: unknown,
  ): Promise<FreePracticeSessionPublicResult> {
    const identity = await this.resolveIdentity(untrustedClientPayload);
    if (identity.status === "UNAVAILABLE") {
      return { status: "UNAVAILABLE", reason: identity.reason };
    }
    if (!sessionId.trim()) {
      return { status: "NOT_FOUND" };
    }
    const record = await this.deps.sessions.get(sessionId, identity.userId);
    if (!record) {
      return { status: "NOT_FOUND" };
    }
    try {
      return await this.presentRecord(record, "RESUMED");
    } catch (error) {
      if (
        error instanceof FreePracticeSessionError &&
        error.code === "SESSION_CONFLICT"
      ) {
        const latest = await this.deps.sessions.get(sessionId, identity.userId);
        if (!latest) {
          return { status: "CONFLICT" };
        }
        return this.presentRecord(latest, "RESUMED");
      }
      return this.mapSessionError(error);
    }
  }

  async submit(
    untrustedClientPayload?: unknown,
  ): Promise<FreePracticeSessionPublicResult> {
    const identity = await this.resolveIdentity(untrustedClientPayload);
    if (identity.status === "UNAVAILABLE") {
      return { status: "UNAVAILABLE", reason: identity.reason };
    }
    if (hasForbiddenClientInjection(untrustedClientPayload)) {
      return { status: "INVALID", reason: "INVALID_REQUEST" };
    }
    if (!untrustedClientPayload || typeof untrustedClientPayload !== "object") {
      return { status: "INVALID", reason: "INVALID_REQUEST" };
    }
    const payload = untrustedClientPayload as Record<string, unknown>;
    const sessionId = readString(payload.sessionId);
    const taskId = readString(payload.taskId);
    const revision = readRevision(payload.revision);
    const intent = readIntent(payload.intent);
    if (!sessionId || !taskId || revision === null || !intent) {
      return { status: "INVALID", reason: "INVALID_REQUEST" };
    }
    const responseTimeMs = readResponseTimeMs(payload.responseTimeMs);
    const record = await this.deps.sessions.get(sessionId, identity.userId);
    if (!record) {
      return { status: "NOT_FOUND" };
    }
    const settled = await this.resolveSettledSubmit(record, taskId);
    if (settled) {
      return settled;
    }
    if (record.state.phase !== "AWAITING_ACTION") {
      return { status: "INVALID", reason: "INVALID_REQUEST" };
    }
    if (record.state.currentTaskId !== taskId) {
      return { status: "INVALID", reason: "INVALID_REQUEST" };
    }
    if (record.revision !== revision) {
      return this.recoverStaleSubmit(record, taskId);
    }
    let task: PublicLearningTask;
    try {
      task = await this.loadPublicTask(taskId, record);
    } catch (error) {
      return this.mapSessionError(error);
    }
    if (!intentMatchesTask(task, intent)) {
      return { status: "INVALID", reason: "INVALID_REQUEST" };
    }
    const action: StudentAction = {
      ...intent,
      taskId,
      occurredAt: this.now(),
      responseTimeMs,
      hintCount: 0,
    };
    try {
      const submitted = await submitTaskAction({
        taskId,
        action,
        userId: identity.userId,
        sessionId: record.sessionId,
        gameId: FREE_PRACTICE_PRESENTATION_GAME_TYPE,
        evidenceId: this.createEvidenceId(),
        learningTaskRepository: this.deps.tasks,
        learningRepository: this.deps.learning,
        now: action.occurredAt,
        createId: () => this.createId(),
      });
      const feedback = toFreePracticePublicFeedbackFromEvaluation(
        submitted.evaluation,
      );
      applySubmitOnce(record, taskId, feedback);
      try {
        const saved = await this.deps.sessions.save(record);
        return this.presentFeedback(saved, task);
      } catch (error) {
        if (this.isConflict(error)) {
          return this.recoverSubmitAfterConflict(sessionId, identity.userId, taskId);
        }
        throw error;
      }
    } catch (error) {
      if (this.isAlreadyCompleted(error) || this.isConflict(error)) {
        return this.recoverSubmitAfterConflict(sessionId, identity.userId, taskId);
      }
      if (error instanceof TaskProtocolError) {
        return { status: "INVALID", reason: "INVALID_REQUEST" };
      }
      throw error;
    }
  }

  async continue(
    untrustedClientPayload?: unknown,
  ): Promise<FreePracticeSessionPublicResult> {
    const identity = await this.resolveIdentity(untrustedClientPayload);
    if (identity.status === "UNAVAILABLE") {
      return { status: "UNAVAILABLE", reason: identity.reason };
    }
    if (hasForbiddenClientInjection(untrustedClientPayload)) {
      return { status: "INVALID", reason: "INVALID_REQUEST" };
    }
    if (!untrustedClientPayload || typeof untrustedClientPayload !== "object") {
      return { status: "INVALID", reason: "INVALID_REQUEST" };
    }
    const payload = untrustedClientPayload as Record<string, unknown>;
    const sessionId = readString(payload.sessionId);
    const taskId = readString(payload.taskId);
    const revision = readRevision(payload.revision);
    if (!sessionId || !taskId || revision === null) {
      return { status: "INVALID", reason: "INVALID_REQUEST" };
    }
    return this.continueWithRetry(
      sessionId,
      identity.userId,
      taskId,
      revision,
      MAX_SESSION_CONFLICT_RETRIES,
    );
  }

  private async continueWithRetry(
    sessionId: string,
    userId: string,
    taskId: string,
    revision: number,
    retriesLeft: number,
  ): Promise<FreePracticeSessionPublicResult> {
    try {
      return await this.continueOnce(sessionId, userId, taskId, revision);
    } catch (error) {
      if (!this.isConflict(error)) {
        return this.mapSessionError(error);
      }
      const latest = await this.deps.sessions.get(sessionId, userId);
      if (!latest) {
        return { status: "CONFLICT" };
      }
      const resolved = await this.resolveContinueFromLatest(latest, taskId);
      if (resolved) {
        return resolved;
      }
      if (latest.state.phase === "AWAITING_CONTINUE" && retriesLeft > 0) {
        return this.continueWithRetry(
          sessionId,
          userId,
          taskId,
          latest.revision,
          retriesLeft - 1,
        );
      }
      return { status: "CONFLICT" };
    }
  }

  private async continueOnce(
    sessionId: string,
    userId: string,
    taskId: string,
    revision: number,
  ): Promise<FreePracticeSessionPublicResult> {
    const record = await this.deps.sessions.get(sessionId, userId);
    if (!record) {
      return { status: "NOT_FOUND" };
    }
    if (record.state.phase === "COMPLETED") {
      return toCompleted(record);
    }
    if (record.state.phase === "AWAITING_ACTION") {
      const resolved = await this.resolveContinueFromLatest(record, taskId);
      return resolved ?? { status: "INVALID", reason: "INVALID_REQUEST" };
    }
    if (record.state.phase !== "AWAITING_CONTINUE") {
      return { status: "INVALID", reason: "INVALID_REQUEST" };
    }
    if (
      record.state.currentTaskId !== taskId ||
      record.state.lastCompletedTaskId !== taskId
    ) {
      return { status: "INVALID", reason: "INVALID_REQUEST" };
    }
    if (record.revision !== revision) {
      const resolved = await this.resolveContinueFromLatest(record, taskId);
      return resolved ?? { status: "CONFLICT" };
    }
    const nextIndex = record.state.currentIndex + 1;
    if (nextIndex >= record.state.plannedCount) {
      record.state.phase = "COMPLETED";
      record.state.completedAt = this.now();
      const saved = await this.deps.sessions.save(record);
      return toCompleted(saved);
    }
    record.state.currentIndex = nextIndex;
    record.state.assignedItemId = null;
    record.state.currentTaskId = null;
    record.state.feedback = null;
    record.state.phase = "AWAITING_ACTION";
    const advanced = await this.deps.sessions.save(record);
    const tasked = await this.ensureCurrentTask(advanced);
    return toStartedOrResumed("RESUMED", tasked.record, tasked.task);
  }

  private async resolveContinueFromLatest(
    latest: FreePracticeSessionRecord,
    taskId: string,
  ): Promise<FreePracticeSessionPublicResult | null> {
    if (latest.state.phase === "COMPLETED") {
      return toCompleted(latest);
    }
    if (
      latest.state.phase === "AWAITING_ACTION" &&
      latest.state.lastCompletedTaskId === taskId
    ) {
      const tasked = await this.ensureCurrentTask(latest);
      return toStartedOrResumed("RESUMED", tasked.record, tasked.task);
    }
    return null;
  }

  /**
   * Authoritative result for a submit that is no longer the open
   * current task. Does not rebuild old feedback onto a newer item
   * and does not mutate stats/index/task/revision.
   */
  private async resolveSettledSubmit(
    latest: FreePracticeSessionRecord,
    taskId: string,
  ): Promise<FreePracticeSessionPublicResult | null> {
    const { phase, currentTaskId, lastCompletedTaskId, feedback } =
      latest.state;
    if (
      phase === "AWAITING_CONTINUE" &&
      currentTaskId === taskId &&
      lastCompletedTaskId === taskId &&
      feedback
    ) {
      return this.presentFeedback(latest);
    }
    if (
      phase === "COMPLETED" &&
      (lastCompletedTaskId === taskId || currentTaskId === taskId)
    ) {
      return toCompleted(latest);
    }
    if (
      phase === "AWAITING_ACTION" &&
      lastCompletedTaskId === taskId &&
      currentTaskId !== taskId
    ) {
      if (!currentTaskId) {
        return { status: "CONFLICT" };
      }
      return this.presentRecord(latest, "RESUMED");
    }
    return null;
  }

  private async recoverStaleSubmit(
    record: FreePracticeSessionRecord,
    taskId: string,
  ): Promise<FreePracticeSessionPublicResult> {
    const settled = await this.resolveSettledSubmit(record, taskId);
    return settled ?? { status: "CONFLICT" };
  }

  private async recoverSubmitAfterConflict(
    sessionId: string,
    userId: string,
    taskId: string,
  ): Promise<FreePracticeSessionPublicResult> {
    const latest = await this.deps.sessions.get(sessionId, userId);
    if (!latest) {
      return { status: "CONFLICT" };
    }
    const settled = await this.resolveSettledSubmit(latest, taskId);
    if (settled) {
      return settled;
    }
    return this.recoverEvidenceIfCurrent(latest, taskId);
  }

  /**
   * Case E: Evidence exists, session CAS has not advanced, and the
   * assigned current task still matches. Never applied after continue.
   */
  private async recoverEvidenceIfCurrent(
    latest: FreePracticeSessionRecord,
    taskId: string,
  ): Promise<FreePracticeSessionPublicResult> {
    if (
      latest.state.phase !== "AWAITING_ACTION" ||
      latest.state.currentTaskId !== taskId
    ) {
      return { status: "CONFLICT" };
    }
    const assigned = await this.matchAssignedTask(taskId, latest);
    if (!assigned) {
      return { status: "NOT_FOUND" };
    }
    const evidence = (
      await this.deps.learning.getEvidenceForLexeme(
        latest.userId,
        assigned.task.publicTask.lexemeId,
      )
    ).find((item) => item.taskId === taskId);
    if (!evidence || latest.state.currentTaskId !== taskId) {
      return { status: "CONFLICT" };
    }
    const feedback = toFreePracticePublicFeedbackFromOutcome(
      taskId,
      evidence.outcome,
    );
    if (!applySubmitOnce(latest, taskId, feedback)) {
      const settled = await this.resolveSettledSubmit(latest, taskId);
      return settled ?? { status: "CONFLICT" };
    }
    try {
      const saved = await this.deps.sessions.save(latest);
      return this.presentFeedback(saved, assigned.task.publicTask);
    } catch (error) {
      if (!this.isConflict(error)) {
        throw error;
      }
      const newest = await this.deps.sessions.get(
        latest.sessionId,
        latest.userId,
      );
      if (!newest) {
        return { status: "CONFLICT" };
      }
      const settled = await this.resolveSettledSubmit(newest, taskId);
      return settled ?? { status: "CONFLICT" };
    }
  }

  private async presentRecord(
    record: FreePracticeSessionRecord,
    actionStatus: "STARTED" | "RESUMED",
  ): Promise<FreePracticeSessionPublicResult> {
    if (record.state.phase === "COMPLETED") {
      return toCompleted(record);
    }
    if (record.state.phase === "AWAITING_CONTINUE") {
      return this.presentFeedback(record);
    }
    const tasked = await this.ensureCurrentTask(record);
    return toStartedOrResumed(actionStatus, tasked.record, tasked.task);
  }

  private async presentFeedback(
    record: FreePracticeSessionRecord,
    knownTask?: PublicLearningTask,
  ): Promise<FreePracticeSessionPublicResult> {
    if (!record.state.feedback || !record.state.currentTaskId) {
      return { status: "INVALID", reason: "INVALID_REQUEST" };
    }
    const task =
      knownTask ??
      (await this.loadPublicTask(record.state.currentTaskId, record));
    return toAwaitingContinue(record, task, record.state.feedback);
  }

  private async resolveIdentity(untrustedClientPayload: unknown) {
    return resolveFreePracticeIdentity({
      untrustedClientPayload,
      env: this.deps.env,
      readSession: this.deps.readSession,
    });
  }

  private async ensureCurrentTask(
    record: FreePracticeSessionRecord,
  ): Promise<{ record: FreePracticeSessionRecord; task: PublicLearningTask }> {
    if (record.state.phase === "COMPLETED") {
      throw new FreePracticeSessionError(
        "INVALID_STATE",
        "Completed session cannot generate a task",
      );
    }
    if (record.state.currentTaskId) {
      const task = await this.loadPublicTask(record.state.currentTaskId, record);
      return { record, task };
    }
    const item = record.state.items[record.state.currentIndex];
    if (!item) {
      throw new FreePracticeSessionError(
        "TASK_GENERATION_FAILED",
        "No current Free Practice item",
      );
    }
    const projection = toTaskGenerationProjection(item);
    const generation = await this.generator.generate({
      need: projection,
      desiredDifficulty: 0.45,
      recentTasks: [],
      now: this.now(),
      createId: createFreePracticeGenerationIds(record.sessionId, item.id),
      random: createTaskRandom(
        FREE_PRACTICE_ORCHESTRATION_TYPE,
        record.sessionId,
        item.id,
      ),
    });
    if (generation.status === "UNAVAILABLE") {
      throw new FreePracticeSessionError(
        "TASK_GENERATION_FAILED",
        generation.reason,
      );
    }
    const assignment = {
      userId: record.userId,
      sessionId: record.sessionId,
    };
    const ensured = await ensureAssignedGeneratedTask({
      tasks: this.deps.tasks,
      task: generation.value,
      assignment,
    });
    if (!ensured.ok) {
      throw new FreePracticeSessionError(
        "SESSION_CONFLICT",
        "Task assignment conflict",
      );
    }
    const publicTask = generation.value.publicTask;
    const next: FreePracticeSessionRecord = {
      ...record,
      state: {
        ...record.state,
        currentTaskId: publicTask.id,
        assignedItemId: item.id,
      },
    };
    try {
      const saved = await this.deps.sessions.save(next);
      return { record: saved, task: publicTask };
    } catch (error) {
      if (
        error instanceof FreePracticeSessionError &&
        error.code === "SESSION_CONFLICT"
      ) {
        const latest = await this.deps.sessions.get(
          record.sessionId,
          record.userId,
        );
        if (latest?.state.currentTaskId) {
          const task = await this.loadPublicTask(
            latest.state.currentTaskId,
            latest,
          );
          return { record: latest, task };
        }
      }
      throw error;
    }
  }

  private async matchAssignedTask(
    taskId: string,
    record: FreePracticeSessionRecord,
  ) {
    const assigned = await this.deps.tasks.getTaskForEvaluation(taskId);
    const current = record.state.items[record.state.currentIndex];
    if (
      !assigned ||
      !current ||
      assigned.assignment.userId !== record.userId ||
      assigned.assignment.sessionId !== record.sessionId ||
      assigned.task.publicTask.learningNeedId !== record.state.assignedItemId ||
      assigned.task.publicTask.lexemeId !== current.lexemeId ||
      assigned.task.publicTask.targetSkill !== current.targetSkill
    ) {
      return null;
    }
    return assigned;
  }

  private async loadPublicTask(
    taskId: string,
    record: FreePracticeSessionRecord,
  ): Promise<PublicLearningTask> {
    const assigned = await this.matchAssignedTask(taskId, record);
    if (!assigned) {
      throw new FreePracticeSessionError(
        "SESSION_NOT_FOUND",
        "Assigned task is not available",
      );
    }
    return assigned.task.publicTask;
  }

  private isConflict(error: unknown): boolean {
    return (
      error instanceof FreePracticeSessionError &&
      error.code === "SESSION_CONFLICT"
    );
  }

  private isAlreadyCompleted(error: unknown): boolean {
    return (
      error instanceof TaskProtocolError &&
      error.code === "TASK_ALREADY_COMPLETED"
    );
  }

  private mapSessionError(error: unknown): FreePracticeSessionPublicResult {
    if (error instanceof FreePracticeSessionError) {
      if (error.code === "SESSION_CONFLICT") {
        return { status: "CONFLICT" };
      }
      if (error.code === "SESSION_NOT_FOUND") {
        return { status: "NOT_FOUND" };
      }
      if (error.code === "TASK_GENERATION_FAILED") {
        return { status: "UNAVAILABLE", reason: "TASK_GENERATION_FAILED" };
      }
      if (error.code === "INVALID_STATE") {
        return { status: "INVALID", reason: "INVALID_REQUEST" };
      }
    }
    throw error;
  }
}
