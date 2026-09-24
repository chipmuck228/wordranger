import "server-only";

import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import { completionMessage } from "./feedback";
import { FREE_PRACTICE_PRESENTATION_GAME_TYPE } from "./constants";
import { forEachObjectKey } from "./inspect-object-keys";
import type {
  FreePracticePublicFeedback,
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
  "correction",
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

const TASK_SURFACE_FORBIDDEN_PUBLIC_KEYS = new Set([
  "reason",
  "NEW_WORD",
  "STAGE_PROGRESS",
]);

function isTaskSurfaceStatus(status: unknown): boolean {
  return (
    status === "STARTED" ||
    status === "RESUMED" ||
    status === "AWAITING_CONTINUE"
  );
}

export function assertSafePublicPayload(value: unknown): void {
  const status =
    value && typeof value === "object" && "status" in value
      ? (value as { status?: unknown }).status
      : undefined;
  const taskSurface = isTaskSurfaceStatus(status);
  forEachObjectKey(value, (key) => {
    if (ALWAYS_FORBIDDEN_PUBLIC_KEYS.has(key)) {
      throw new Error(`Public Free Practice payload must not include ${key}`);
    }
    if (taskSurface && TASK_SURFACE_FORBIDDEN_PUBLIC_KEYS.has(key)) {
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
    phase: record.state.phase,
    attempted: record.state.attempted,
    correct: record.state.correct,
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

export function toAwaitingContinue(
  record: FreePracticeSessionRecord,
  task: PublicLearningTask,
  feedback: FreePracticePublicFeedback,
): FreePracticeSessionPublicResult {
  const result: FreePracticeSessionPublicResult = {
    status: "AWAITING_CONTINUE",
    session: toPublicSession(record),
    task,
    feedback,
  };
  assertSafePublicPayload(result);
  return result;
}

export function toCompleted(
  record: FreePracticeSessionRecord,
): FreePracticeSessionPublicResult {
  if (!record.state.completedAt) {
    throw new Error("Completed Free Practice session is missing completedAt");
  }
  const result: FreePracticeSessionPublicResult = {
    status: "COMPLETED",
    session: toPublicSession(record),
    completedAt: record.state.completedAt,
    message: completionMessage(record.state.attempted, record.state.correct),
  };
  assertSafePublicPayload(result);
  return result;
}
