import { z } from "zod";
import { PromptMode } from "@/domain/learning/evidence.types";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { WeaknessType } from "@/domain/learning/weakness.types";
import {
  RANGER_TRIAL_GAME_TYPE,
  RANGER_TRIAL_STATE_VERSION,
} from "@/server/auth/v1-user";
import { GameSessionError } from "./ranger-trial-errors";
import type {
  RangerTrialSessionPhase,
  RangerTrialSessionRecord,
} from "./ranger-trial-session.types";

const needReasonSchema = z.enum([
  "NEW_WORD",
  "WEAKNESS",
  "REVIEW_DUE",
  "STAGE_PROGRESS",
  "FADING",
  "USER_MARKED",
]);

const phaseSchema = z.enum([
  "awaiting_action",
  "awaiting_continue",
  "completed",
  "failed",
]);

const persistedStateSchema = z.object({
  stateVersion: z.literal(RANGER_TRIAL_STATE_VERSION),
  planId: z.string().min(1),
  createdAt: z.string().min(1),
  needs: z.array(
    z.object({
      id: z.string().min(1),
      lexemeId: z.string().min(1),
      targetSkill: z.enum(VocabularySkill),
      priority: z.number(),
      reason: needReasonSchema,
      supportingReasons: z.array(needReasonSchema).optional(),
      weaknessFocus: z
        .object({
          weaknessId: z.string(),
          type: z.enum(WeaknessType),
          relatedLexemeId: z.string().optional(),
        })
        .optional(),
      preferredPromptModes: z.array(z.enum(PromptMode)),
      avoidRecentTaskTypes: z.array(z.string()),
    }),
  ),
  currentNeedIndex: z.number().int().nonnegative(),
  currentTaskId: z.string().nullable(),
  phase: phaseSchema,
  completed: z.number().int().nonnegative(),
  stats: z.object({
    attempted: z.number().int().nonnegative(),
    correct: z.number().int().nonnegative(),
    incorrect: z.number().int().nonnegative(),
  }),
  lastFeedback: z
    .object({
      status: z.enum([
        "CORRECT",
        "ASSISTED",
        "INCORRECT",
        "SKIPPED",
        "TIMEOUT",
      ]),
      message: z.string(),
      continueAvailable: z.boolean(),
      correction: z.object({ text: z.string() }).optional(),
    })
    .nullable(),
  lastCompletedTaskId: z.string().nullable(),
  generationFailures: z.array(
    z.object({
      needId: z.string(),
      lexemeId: z.string(),
      skill: z.string(),
      code: z.string(),
      reason: z.string(),
    }),
  ),
  recentTasks: z.array(
    z.object({
      taskId: z.string(),
      taskType: z.string(),
      lexemeId: z.string(),
    }),
  ),
});

export type PersistedRangerTrialState = z.infer<typeof persistedStateSchema>;

export function sessionStatusFromPhase(
  phase: RangerTrialSessionPhase,
): "active" | "completed" | "failed" {
  if (phase === "completed") {
    return "completed";
  }
  if (phase === "failed") {
    return "failed";
  }
  return "active";
}

export function serializeRangerTrialState(
  record: RangerTrialSessionRecord,
): PersistedRangerTrialState {
  return {
    stateVersion: RANGER_TRIAL_STATE_VERSION,
    planId: record.planId,
    createdAt: record.createdAt,
    needs: record.needs,
    currentNeedIndex: record.currentNeedIndex,
    currentTaskId: record.currentTaskId,
    phase: record.phase,
    completed: record.completed,
    stats: record.stats,
    lastFeedback: record.lastFeedback,
    lastCompletedTaskId: record.lastCompletedTaskId,
    generationFailures: record.generationFailures,
    recentTasks: record.recentTasks,
  };
}

export function parseRangerTrialSessionRecord(input: {
  sessionId: string;
  userId: string;
  gameType: string;
  expectedUserId?: string;
  state: unknown;
  revision: number;
}): RangerTrialSessionRecord {
  if (input.gameType !== RANGER_TRIAL_GAME_TYPE) {
    throw new GameSessionError(
      "SESSION_NOT_FOUND",
      "Session game type does not match Ranger Trial",
    );
  }
  if (input.expectedUserId && input.userId !== input.expectedUserId) {
    throw new GameSessionError(
      "SESSION_NOT_FOUND",
      "Session does not belong to the current user",
    );
  }
  const parsed = persistedStateSchema.safeParse(input.state);
  if (!parsed.success) {
    throw new GameSessionError(
      "SESSION_NOT_FOUND",
      "Session state is not a valid Ranger Trial v1 record",
    );
  }
  const state = parsed.data;
  if (state.currentNeedIndex > state.needs.length) {
    throw new GameSessionError(
      "SESSION_NOT_FOUND",
      "Session need index is out of range",
    );
  }
  if (
    !Number.isInteger(input.revision) ||
    input.revision < 0
  ) {
    throw new GameSessionError(
      "SESSION_NOT_FOUND",
      "Session revision is not a valid concurrency token",
    );
  }
  return {
    sessionId: input.sessionId,
    userId: input.userId,
    planId: state.planId,
    createdAt: state.createdAt,
    needs: state.needs,
    currentNeedIndex: state.currentNeedIndex,
    currentTaskId: state.currentTaskId,
    phase: state.phase,
    completed: state.completed,
    stats: state.stats,
    lastFeedback: state.lastFeedback,
    lastCompletedTaskId: state.lastCompletedTaskId,
    generationFailures: state.generationFailures,
    recentTasks: state.recentTasks,
    revision: input.revision,
  };
}

export function assertNoAnswerKeyFields(value: unknown): void {
  const json = JSON.stringify(value);
  for (const field of [
    "answerKey",
    "correctOptionIds",
    "optionLexemeIds",
    "expectedAnswer",
    "semanticAcceptedTexts",
    "exactAcceptedTexts",
  ]) {
    if (json.includes(`"${field}"`)) {
      throw new GameSessionError(
        "SESSION_START_FAILED",
        "Refusing to persist answer-key fields in game session state",
      );
    }
  }
}
