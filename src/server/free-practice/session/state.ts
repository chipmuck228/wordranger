import "server-only";

import { z } from "zod";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { assertNoAnswerKeyFields } from "@/server/game-session/ranger-trial-session-state";
import {
  FREE_PRACTICE_LEGACY_SESSION_SCHEMA_VERSION,
  FREE_PRACTICE_SESSION_SCHEMA_VERSION,
} from "./constants";
import { FreePracticeSessionError } from "./errors";
import { forEachObjectKey } from "./inspect-object-keys";
import type {
  FreePracticeSessionRecord,
  FreePracticeSessionState,
} from "./types";

const FORBIDDEN_STATE_KEYS = new Set([
  "reason",
  "priority",
  "weaknessFocus",
  "supportingReasons",
  "preferredPromptModes",
  "avoidRecentTaskTypes",
  "LearningSessionPlan",
  "needs",
  "answerKey",
  "correctOptionIds",
  "exactAcceptedTexts",
  "semanticAcceptedTexts",
  "optionLexemeIds",
  "projection",
  "scheduler",
  "trace",
  "masteryStage",
  "weaknesses",
  "outcome",
  "evidence",
  "expectedAnswer",
  "correction",
  "userId",
  "learner",
  "snapshot",
  "compatibility",
]);

const itemSchema = z
  .object({
    id: z.string().min(1),
    lexemeId: z.string().min(1),
    targetSkill: z.enum(VocabularySkill),
    source: z.enum(["UNSEEN", "RECENTLY_INCORRECT"]),
  })
  .strict();

const feedbackSchema = z
  .object({
    taskId: z.string().min(1),
    correct: z.boolean(),
    message: z.string().min(1),
  })
  .strict();

const stateSchema = z
  .object({
    schemaVersion: z.literal(FREE_PRACTICE_SESSION_SCHEMA_VERSION),
    source: z.enum(["UNSEEN", "RECENTLY_INCORRECT"]),
    requestedCount: z.union([z.literal(5), z.literal(10)]),
    plannedCount: z.number().int().positive(),
    items: z.array(itemSchema).min(1),
    currentIndex: z.number().int().nonnegative(),
    assignedItemId: z.string().min(1).nullable(),
    currentTaskId: z.string().min(1).nullable(),
    phase: z.enum(["AWAITING_ACTION", "AWAITING_CONTINUE", "COMPLETED"]),
    attempted: z.number().int().nonnegative(),
    correct: z.number().int().nonnegative(),
    lastCompletedTaskId: z.string().min(1).nullable(),
    feedback: feedbackSchema.nullable(),
    createdAt: z.string().min(1),
    completedAt: z.string().min(1).nullable(),
  })
  .strict();

function rejectForbiddenFields(value: unknown): void {
  forEachObjectKey(value, (key) => {
    if (FORBIDDEN_STATE_KEYS.has(key)) {
      throw new FreePracticeSessionError(
        "INVALID_STATE",
        `Free Practice session state must not persist ${key}`,
      );
    }
  });
  assertNoAnswerKeyFields(value);
}

function assertItemUniqueness(items: FreePracticeSessionState["items"]): void {
  const ids = new Set<string>();
  const lexemes = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id)) {
      throw new FreePracticeSessionError(
        "INVALID_STATE",
        "Duplicate Free Practice item id",
      );
    }
    if (lexemes.has(item.lexemeId)) {
      throw new FreePracticeSessionError(
        "INVALID_STATE",
        "Duplicate Free Practice lexeme id",
      );
    }
    ids.add(item.id);
    lexemes.add(item.lexemeId);
  }
}

function assertAssignmentPair(state: FreePracticeSessionState): void {
  const assigned = state.assignedItemId;
  const taskId = state.currentTaskId;
  if ((assigned === null) !== (taskId === null)) {
    throw new FreePracticeSessionError(
      "INVALID_STATE",
      "assignedItemId and currentTaskId must be both null or both set",
    );
  }
  if (assigned === null) {
    return;
  }
  const current = state.items[state.currentIndex];
  if (!current || current.id !== assigned) {
    throw new FreePracticeSessionError(
      "INVALID_STATE",
      "assignedItemId must equal items[currentIndex].id",
    );
  }
}

function assertItemSources(state: FreePracticeSessionState): void {
  for (const item of state.items) {
    if (item.source !== state.source) {
      throw new FreePracticeSessionError(
        "INVALID_STATE",
        "Free Practice item source must match session source",
      );
    }
  }
}

function assertFeedbackSafe(state: FreePracticeSessionState): void {
  if (!state.feedback) {
    return;
  }
  if (state.feedback.message.includes("正确答案")) {
    throw new FreePracticeSessionError(
      "INVALID_STATE",
      "Free Practice feedback must not reveal the expected answer",
    );
  }
}

function assertPhaseInvariants(state: FreePracticeSessionState): void {
  if (
    state.correct < 0 ||
    state.attempted < 0 ||
    state.correct > state.attempted ||
    state.attempted > state.plannedCount
  ) {
    throw new FreePracticeSessionError(
      "INVALID_STATE",
      "correct/attempted/plannedCount invariant failed",
    );
  }

  if (state.phase === "AWAITING_ACTION") {
    if (state.feedback !== null || state.completedAt !== null) {
      throw new FreePracticeSessionError(
        "INVALID_STATE",
        "AWAITING_ACTION cannot carry feedback or completedAt",
      );
    }
    if (
      state.currentTaskId !== null &&
      state.lastCompletedTaskId === state.currentTaskId
    ) {
      throw new FreePracticeSessionError(
        "INVALID_STATE",
        "lastCompletedTaskId must not impersonate an unfinished task",
      );
    }
    if (state.attempted !== state.currentIndex) {
      throw new FreePracticeSessionError(
        "INVALID_STATE",
        "AWAITING_ACTION attempted must equal currentIndex",
      );
    }
    return;
  }

  if (state.phase === "AWAITING_CONTINUE") {
    if (
      state.assignedItemId === null ||
      state.currentTaskId === null ||
      state.lastCompletedTaskId !== state.currentTaskId ||
      state.feedback === null ||
      state.completedAt !== null
    ) {
      throw new FreePracticeSessionError(
        "INVALID_STATE",
        "AWAITING_CONTINUE requires the current task, matching lastCompletedTaskId, and safe feedback",
      );
    }
    if (state.feedback.taskId !== state.currentTaskId) {
      throw new FreePracticeSessionError(
        "INVALID_STATE",
        "feedback.taskId must match currentTaskId",
      );
    }
    if (state.attempted !== state.currentIndex + 1) {
      throw new FreePracticeSessionError(
        "INVALID_STATE",
        "AWAITING_CONTINUE attempted must include the current item",
      );
    }
    return;
  }

  if (
    state.attempted !== state.plannedCount ||
    state.currentIndex !== state.plannedCount - 1 ||
    state.assignedItemId === null ||
    state.currentTaskId === null ||
    state.lastCompletedTaskId !== state.currentTaskId ||
    state.feedback === null ||
    !state.completedAt
  ) {
    throw new FreePracticeSessionError(
      "INVALID_STATE",
      "COMPLETED requires full stats, last item, feedback, and completedAt",
    );
  }
  if (state.feedback.taskId !== state.currentTaskId) {
    throw new FreePracticeSessionError(
      "INVALID_STATE",
      "feedback.taskId must match currentTaskId",
    );
  }
}

function rejectLegacySchema(state: unknown): void {
  if (
    state &&
    typeof state === "object" &&
    "schemaVersion" in state &&
    (state as { schemaVersion?: unknown }).schemaVersion ===
      FREE_PRACTICE_LEGACY_SESSION_SCHEMA_VERSION
  ) {
    throw new FreePracticeSessionError(
      "INVALID_STATE",
      "Legacy fp-session-v1 is not accepted",
    );
  }
}

/**
 * Single state validator used by both write (serialize) and read (parse).
 * fp-session-v1 is rejected fail-closed. No invented feedback or stats.
 */
export function parseFreePracticeState(
  state: unknown,
): FreePracticeSessionState {
  rejectLegacySchema(state);
  rejectForbiddenFields(state);
  const parsed = stateSchema.safeParse(state);
  if (!parsed.success) {
    throw new FreePracticeSessionError(
      "INVALID_STATE",
      "Session state is not a valid Free Practice record",
    );
  }
  const next = parsed.data;
  if (next.plannedCount !== next.items.length) {
    throw new FreePracticeSessionError(
      "INVALID_STATE",
      "plannedCount must equal items.length",
    );
  }
  if (next.currentIndex >= next.items.length) {
    throw new FreePracticeSessionError(
      "INVALID_STATE",
      "currentIndex is out of range",
    );
  }
  assertItemUniqueness(next.items);
  assertItemSources(next);
  assertAssignmentPair(next);
  assertFeedbackSafe(next);
  assertPhaseInvariants(next);
  return next;
}

export function serializeFreePracticeState(
  record: FreePracticeSessionRecord,
): FreePracticeSessionState {
  return structuredClone(parseFreePracticeState(record.state));
}

export function parseFreePracticeRecord(input: {
  sessionId: string;
  userId: string;
  gameType: string;
  expectedGameType: string;
  expectedUserId: string;
  planId: string;
  state: unknown;
  revision: number;
}): FreePracticeSessionRecord {
  if (input.gameType !== input.expectedGameType) {
    throw new FreePracticeSessionError(
      "SESSION_NOT_FOUND",
      "Session is not a Free Practice session",
    );
  }
  if (input.userId !== input.expectedUserId) {
    throw new FreePracticeSessionError(
      "SESSION_NOT_FOUND",
      "Session does not belong to the current user",
    );
  }
  if (!Number.isInteger(input.revision) || input.revision < 0) {
    throw new FreePracticeSessionError(
      "INVALID_STATE",
      "Session revision is not a valid concurrency token",
    );
  }
  return {
    sessionId: input.sessionId,
    userId: input.userId,
    planId: input.planId,
    revision: input.revision,
    state: parseFreePracticeState(input.state),
  };
}
