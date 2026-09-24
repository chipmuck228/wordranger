import "server-only";

import { z } from "zod";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { assertNoAnswerKeyFields } from "@/server/game-session/ranger-trial-session-state";
import { FREE_PRACTICE_SESSION_SCHEMA_VERSION } from "./constants";
import { FreePracticeSessionError } from "./errors";
import type {
  FreePracticeSessionRecord,
  FreePracticeSessionState,
} from "./types";

const FORBIDDEN_STATE_KEYS = [
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
];

const itemSchema = z
  .object({
    id: z.string().min(1),
    lexemeId: z.string().min(1),
    targetSkill: z.enum(VocabularySkill),
    source: z.enum(["UNSEEN", "RECENTLY_INCORRECT"]),
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
    status: z.literal("active"),
    createdAt: z.string().min(1),
  })
  .strict();

function rejectForbiddenFields(value: unknown): void {
  const json = JSON.stringify(value);
  for (const key of FORBIDDEN_STATE_KEYS) {
    if (json.includes(`"${key}"`)) {
      throw new FreePracticeSessionError(
        "INVALID_STATE",
        `Free Practice session state must not persist ${key}`,
      );
    }
  }
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

export function serializeFreePracticeState(
  record: FreePracticeSessionRecord,
): FreePracticeSessionState {
  rejectForbiddenFields(record.state);
  return structuredClone(record.state);
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
  rejectForbiddenFields(input.state);
  const parsed = stateSchema.safeParse(input.state);
  if (!parsed.success) {
    throw new FreePracticeSessionError(
      "INVALID_STATE",
      "Session state is not a valid Free Practice record",
    );
  }
  const state = parsed.data;
  if (state.plannedCount !== state.items.length) {
    throw new FreePracticeSessionError(
      "INVALID_STATE",
      "plannedCount must equal items.length",
    );
  }
  if (state.currentIndex >= state.items.length) {
    throw new FreePracticeSessionError(
      "INVALID_STATE",
      "currentIndex is out of range",
    );
  }
  assertItemUniqueness(state.items);
  if (
    state.assignedItemId &&
    !state.items.some((item) => item.id === state.assignedItemId)
  ) {
    throw new FreePracticeSessionError(
      "INVALID_STATE",
      "assignedItemId is not in the pinned plan",
    );
  }
  return {
    sessionId: input.sessionId,
    userId: input.userId,
    planId: input.planId,
    revision: input.revision,
    state,
  };
}
