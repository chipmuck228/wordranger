import { z } from "zod";
import { PromptMode } from "@/domain/learning/evidence.types";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { WeaknessType } from "@/domain/learning/weakness.types";
import {
  DAILY_TRAINING_ORCHESTRATION_TYPE,
  GAME_SESSION_STATE_VERSION,
} from "@/server/auth/v1-user";
import { GameSessionError } from "@/server/game-session/ranger-trial-errors";
import {
  assertNoAnswerKeyFields,
  sessionStatusFromPhase,
} from "@/server/game-session/ranger-trial-session-state";
import type { DailyTrainingSessionRecord } from "./daily-training.types";

const needReasonSchema = z.enum([
  "NEW_WORD",
  "WEAKNESS",
  "REVIEW_DUE",
  "STAGE_PROGRESS",
  "FADING",
  "USER_MARKED",
]);

const persistedTrainingStateSchema = z.object({
  stateVersion: z.literal(GAME_SESSION_STATE_VERSION),
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
  items: z.array(
    z.object({
      needId: z.string().min(1),
      lexemeId: z.string().min(1),
      targetSkill: z.enum(VocabularySkill),
      taskId: z.string().nullable(),
      rendererGameType: z.string().nullable(),
      status: z.enum(["PLANNED", "READY", "COMPLETED", "SKIPPED"]),
    }),
  ),
  currentNeedIndex: z.number().int().nonnegative(),
  currentTaskId: z.string().nullable(),
  phase: z.enum([
    "awaiting_action",
    "awaiting_continue",
    "completed",
    "failed",
  ]),
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
  recentRendererTypes: z.array(z.string()),
  attentionLexemeIds: z.array(z.string()),
});

export type PersistedDailyTrainingState = z.infer<
  typeof persistedTrainingStateSchema
>;

export function serializeDailyTrainingState(
  record: DailyTrainingSessionRecord,
): PersistedDailyTrainingState {
  return {
    stateVersion: GAME_SESSION_STATE_VERSION,
    planId: record.planId,
    createdAt: record.createdAt,
    needs: record.needs,
    items: record.items,
    currentNeedIndex: record.currentNeedIndex,
    currentTaskId: record.currentTaskId,
    phase: record.phase,
    completed: record.completed,
    stats: record.stats,
    lastFeedback: record.lastFeedback,
    lastCompletedTaskId: record.lastCompletedTaskId,
    generationFailures: record.generationFailures,
    recentTasks: record.recentTasks,
    recentRendererTypes: record.recentRendererTypes,
    attentionLexemeIds: record.attentionLexemeIds,
  };
}

export function parseDailyTrainingRecord(input: {
  sessionId: string;
  userId: string;
  gameType: string;
  expectedUserId?: string;
  state: unknown;
  revision: number;
}): DailyTrainingSessionRecord {
  if (input.gameType !== DAILY_TRAINING_ORCHESTRATION_TYPE) {
    throw new GameSessionError(
      "SESSION_NOT_FOUND",
      "Session is not a Daily Training round",
    );
  }
  if (input.expectedUserId && input.userId !== input.expectedUserId) {
    throw new GameSessionError(
      "SESSION_NOT_FOUND",
      "Session does not belong to the current user",
    );
  }
  const parsed = persistedTrainingStateSchema.safeParse(input.state);
  if (!parsed.success) {
    throw new GameSessionError(
      "SESSION_NOT_FOUND",
      "Session state is not a valid Daily Training v1 record",
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
  const state = parsed.data;
  return {
    sessionId: input.sessionId,
    userId: input.userId,
    planId: state.planId,
    createdAt: state.createdAt,
    needs: state.needs,
    items: state.items,
    currentNeedIndex: state.currentNeedIndex,
    currentTaskId: state.currentTaskId,
    phase: state.phase,
    completed: state.completed,
    stats: state.stats,
    lastFeedback: state.lastFeedback,
    lastCompletedTaskId: state.lastCompletedTaskId,
    generationFailures: state.generationFailures,
    recentTasks: state.recentTasks,
    recentRendererTypes: state.recentRendererTypes,
    attentionLexemeIds: state.attentionLexemeIds,
    revision: input.revision,
  };
}

export { assertNoAnswerKeyFields, sessionStatusFromPhase };
