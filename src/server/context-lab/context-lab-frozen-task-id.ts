import "server-only";

import { deterministicUuidV5 } from "@/server/tasks/deterministic-uuid";

/** Namespace for Context Lab frozen-task UUIDs. Not a game ID. */
const CONTEXT_LAB_TASK_NAMESPACE = "a11c07e1-0000-4000-8000-c07e171ab001";

/**
 * Deterministic learning-task UUID from immutable run + step identity.
 * Compatible with learning_tasks.id (uuid).
 */
export function contextLabFrozenTaskId(runId: string, stepId: string): string {
  return deterministicUuidV5(
    CONTEXT_LAB_TASK_NAMESPACE,
    `context-lab-frozen:${runId}:${stepId}`,
  );
}
