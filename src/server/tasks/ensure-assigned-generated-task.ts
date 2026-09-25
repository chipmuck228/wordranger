import "server-only";

import type { GeneratedLearningTask } from "@/domain/tasks/generated-learning-task";
import type { LearningTaskRepository } from "@/domain/tasks/learning-task-repository";
import type {
  SaveGeneratedTaskInput,
  TaskAssignment,
} from "@/domain/tasks/task-assignment";
import { assignedTasksMatch } from "./assigned-tasks-match";

export type EnsureAssignedGeneratedTaskResult =
  | { ok: true; reused: boolean }
  | { ok: false; reason: "CONFLICT" };

/**
 * Idempotent assignment onto the frozen LearningTaskRepository.
 * Duplicate identical rows are accepted. Conflicting rows are rejected.
 * Unique-race losers re-read the winner and verify compatibility.
 */
export async function ensureAssignedGeneratedTask(input: {
  tasks: LearningTaskRepository;
  task: GeneratedLearningTask;
  assignment: TaskAssignment;
}): Promise<EnsureAssignedGeneratedTaskResult> {
  const existing = await input.tasks.getTaskForEvaluation({
    taskId: input.task.publicTask.id,
    userId: input.assignment.userId,
    sessionId: input.assignment.sessionId,
  });
  if (existing) {
    return compatibleAssignment(existing.task, existing.assignment, input)
      ? { ok: true, reused: true }
      : { ok: false, reason: "CONFLICT" };
  }

  try {
    const payload: SaveGeneratedTaskInput = {
      task: input.task,
      assignment: input.assignment,
    };
    await input.tasks.saveGeneratedTask(payload);
    return { ok: true, reused: false };
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }
    const raced = await input.tasks.getTaskForEvaluation({
      taskId: input.task.publicTask.id,
      userId: input.assignment.userId,
      sessionId: input.assignment.sessionId,
    });
    if (raced && compatibleAssignment(raced.task, raced.assignment, input)) {
      return { ok: true, reused: true };
    }
    return { ok: false, reason: "CONFLICT" };
  }
}

function compatibleAssignment(
  task: GeneratedLearningTask,
  assignment: TaskAssignment,
  input: {
    task: GeneratedLearningTask;
    assignment: TaskAssignment;
  },
): boolean {
  return (
    task.publicTask.id === input.task.publicTask.id &&
    assignment.userId === input.assignment.userId &&
    assignment.sessionId === input.assignment.sessionId &&
    assignedTasksMatch(task, input.task)
  );
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const code = "code" in error ? String(error.code) : "";
  return code === "23505";
}
