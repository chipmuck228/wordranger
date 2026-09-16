import type { GeneratedLearningTask } from "./generated-learning-task";

export interface TaskAssignment {
  userId: string;
  sessionId: string;
}

export interface SaveGeneratedTaskInput {
  task: GeneratedLearningTask;
  assignment: TaskAssignment;
}

export interface AssignedLearningTask {
  task: GeneratedLearningTask;
  assignment: TaskAssignment;
}

export function assertTaskAssignment(assignment: TaskAssignment): void {
  if (!assignment.userId.trim() || !assignment.sessionId.trim()) {
    throw new Error("Task assignment requires userId and sessionId");
  }
}
