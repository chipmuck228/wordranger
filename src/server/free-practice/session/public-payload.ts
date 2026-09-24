import "server-only";

import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import { FREE_PRACTICE_PRESENTATION_GAME_TYPE } from "./constants";
import type {
  FreePracticePublicSession,
  FreePracticeSessionPublicResult,
  FreePracticeSessionRecord,
} from "./types";

const ALWAYS_FORBIDDEN_PUBLIC_KEYS = [
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
];

const STARTED_FORBIDDEN_PUBLIC_KEYS = ["reason", "NEW_WORD", "STAGE_PROGRESS"];

export function assertSafePublicPayload(value: unknown): void {
  const json = JSON.stringify(value);
  for (const key of ALWAYS_FORBIDDEN_PUBLIC_KEYS) {
    if (json.includes(`"${key}"`)) {
      throw new Error(`Public Free Practice payload must not include ${key}`);
    }
  }
  const status =
    value && typeof value === "object" && "status" in value
      ? (value as { status?: unknown }).status
      : undefined;
  if (status === "STARTED" || status === "RESUMED") {
    for (const key of STARTED_FORBIDDEN_PUBLIC_KEYS) {
      if (json.includes(key === "reason" ? `"${key}"` : key)) {
        throw new Error(`Public Free Practice payload must not include ${key}`);
      }
    }
  }
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
