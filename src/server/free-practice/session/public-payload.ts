import "server-only";

import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import { FREE_PRACTICE_PRESENTATION_GAME_TYPE } from "./constants";
import { forEachObjectKey } from "./inspect-object-keys";
import type {
  FreePracticePublicSession,
  FreePracticeSessionPublicResult,
  FreePracticeSessionRecord,
} from "./types";

const ALWAYS_FORBIDDEN_PUBLIC_KEYS = new Set([
  "userId",
  "answerKey",
  "correctOptionIds",
  "exactAcceptedTexts",
  "semanticAcceptedTexts",
  "optionLexemeIds",
  "expectedAnswer",
  "projection",
  "priority",
  "weaknessFocus",
  "LearningSessionPlan",
  "needs",
  "items",
  "evidence",
  "masteryStage",
  "weaknesses",
  "SUPABASE_SERVICE_ROLE_KEY",
]);

const STARTED_FORBIDDEN_PUBLIC_KEYS = new Set([
  "reason",
  "NEW_WORD",
  "STAGE_PROGRESS",
]);

export function assertSafePublicPayload(value: unknown): void {
  const status =
    value && typeof value === "object" && "status" in value
      ? (value as { status?: unknown }).status
      : undefined;
  const started = status === "STARTED" || status === "RESUMED";
  forEachObjectKey(value, (key) => {
    if (ALWAYS_FORBIDDEN_PUBLIC_KEYS.has(key)) {
      throw new Error(`Public Free Practice payload must not include ${key}`);
    }
    if (started && STARTED_FORBIDDEN_PUBLIC_KEYS.has(key)) {
      throw new Error(`Public Free Practice payload must not include ${key}`);
    }
  });
}

export function toPublicSession(
  record: FreePracticeSessionRecord,
): FreePracticePublicSession {
  return {
    sessionId: record.sessionId,
    revision: record.revision,
    source: record.state.source,
    requestedCount: record.state.requestedCount,
    plannedCount: record.state.plannedCount,
    current: record.state.currentIndex + 1,
    currentTaskId: record.state.currentTaskId,
    presentationGameType: FREE_PRACTICE_PRESENTATION_GAME_TYPE,
  };
}

export function toStartedOrResumed(
  status: "STARTED" | "RESUMED",
  record: FreePracticeSessionRecord,
  task: PublicLearningTask,
): FreePracticeSessionPublicResult {
  const result: FreePracticeSessionPublicResult = {
    status,
    session: toPublicSession(record),
    task,
  };
  assertSafePublicPayload(result);
  return result;
}
