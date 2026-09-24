import "server-only";

import { DefaultTaskGenerator } from "@/domain/tasks/default-task-generator";
import type { LearningTaskRepository } from "@/domain/tasks/learning-task-repository";
import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import type { TaskGenerator } from "@/domain/tasks/task-generator";
import type { VocabularyRepository } from "@/domain/vocabulary/vocabulary-repository";
import { resolveFreePracticeIdentity } from "@/server/free-practice/identity/resolve-free-practice-identity";
import type { ReadFreePracticeSession } from "@/server/free-practice/identity/types";
import { planFreePractice } from "@/server/free-practice/planning/plan-free-practice";
import type {
  FreePracticePlanReadPort,
  FreePracticeRequest,
} from "@/server/free-practice/planning/types";
import { createTaskRandom } from "@/server/game-session/ranger-trial-seeds";
import { ensureAssignedGeneratedTask } from "@/server/tasks/ensure-assigned-generated-task";
import {
  FREE_PRACTICE_ORCHESTRATION_TYPE,
  FREE_PRACTICE_SESSION_SCHEMA_VERSION,
} from "./constants";
import { createFreePracticeGenerationIds } from "./deterministic-ids";
import { FreePracticeSessionError } from "./errors";
import { toStartedOrResumed } from "./public-payload";
import { toTaskGenerationProjection } from "./to-task-generation-projection";
import type {
  FreePracticeSessionPublicResult,
  FreePracticeSessionRecord,
  FreePracticeSessionStore,
} from "./types";

export interface FreePracticeSessionControllerDeps {
  vocabulary: VocabularyRepository;
  read: FreePracticePlanReadPort;
  tasks: LearningTaskRepository;
  sessions: FreePracticeSessionStore;
  readSession: ReadFreePracticeSession;
  env?: Record<string, string | undefined>;
  generator?: TaskGenerator;
  now?: () => string;
  createSessionId?: () => string;
  createId?: () => string;
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

/**
 * Slice 3A session foundation. Plans once, pins items, issues the
 * current task, and resumes. Does not accept answers or write Evidence.
 */
export class FreePracticeSessionController {
  private readonly generator: TaskGenerator;
  private readonly now: () => string;
  private readonly createSessionId: () => string;
  private readonly createId: () => string;
  private idSeq = 0;

  constructor(private readonly deps: FreePracticeSessionControllerDeps) {
    this.generator =
      deps.generator ?? new DefaultTaskGenerator(deps.vocabulary);
    this.now = deps.now ?? (() => new Date().toISOString());
    this.createSessionId =
      deps.createSessionId ?? (() => crypto.randomUUID());
    this.createId =
      deps.createId ??
      (() => {
        this.idSeq += 1;
        return `fp-id-${this.idSeq}`;
      });
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
        status: "active",
        createdAt: now,
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
      const tasked = await this.ensureCurrentTask(record);
      return toStartedOrResumed("RESUMED", tasked.record, tasked.task);
    } catch (error) {
      if (
        error instanceof FreePracticeSessionError &&
        error.code === "SESSION_CONFLICT"
      ) {
        const latest = await this.deps.sessions.get(sessionId, identity.userId);
        if (!latest?.state.currentTaskId) {
          return { status: "CONFLICT" };
        }
        const task = await this.loadPublicTask(
          latest.state.currentTaskId,
          latest,
        );
        return toStartedOrResumed("RESUMED", latest, task);
      }
      if (
        error instanceof FreePracticeSessionError &&
        error.code === "SESSION_NOT_FOUND"
      ) {
        return { status: "NOT_FOUND" };
      }
      if (
        error instanceof FreePracticeSessionError &&
        error.code === "TASK_GENERATION_FAILED"
      ) {
        return { status: "UNAVAILABLE", reason: "TASK_GENERATION_FAILED" };
      }
      throw error;
    }
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

  private async loadPublicTask(
    taskId: string,
    record: FreePracticeSessionRecord,
  ): Promise<PublicLearningTask> {
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
      throw new FreePracticeSessionError(
        "SESSION_NOT_FOUND",
        "Assigned task is not available",
      );
    }
    return assigned.task.publicTask;
  }
}
