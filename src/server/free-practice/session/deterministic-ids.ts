import "server-only";

import { deterministicUuidV5 } from "@/server/tasks/deterministic-uuid";

/** Namespace for Free Practice generation ids. Not Evidence.gameId. */
const FREE_PRACTICE_ID_NAMESPACE = "b22d18f2-0000-4000-8000-f4ee9417ce01";

/**
 * Deterministic createId for one session item. Task id and option ids
 * repeat for the same sessionId + FreePracticeItem.id.
 */
export function createFreePracticeGenerationIds(
  sessionId: string,
  itemId: string,
): () => string {
  let sequence = 0;
  return () => {
    sequence += 1;
    return deterministicUuidV5(
      FREE_PRACTICE_ID_NAMESPACE,
      `free-practice:${sessionId}:${itemId}:${sequence}`,
    );
  };
}
