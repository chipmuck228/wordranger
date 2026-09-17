"use server";

import { createDailyTrainingRuntime } from "@/server/runtime/create-daily-training-runtime";
import {
  GameSessionError,
  type GameSessionErrorCode,
} from "@/server/game-session/ranger-trial-errors";
import { DAILY_TRAINING_USER_MESSAGES } from "@/server/training/daily-training-errors";
import type {
  ContinueDailyTrainingResult,
  ResumeDailyTrainingResult,
  StartDailyTrainingResult,
  StudentActionIntent,
  SubmitDailyTrainingResult,
} from "@/server/training/daily-training.types";

function controller() {
  return createDailyTrainingRuntime().createController();
}

export type DailyTrainingClientResult<T> =
  | ({ ok: true } & T)
  | { ok: false; code: GameSessionErrorCode; message: string };

function fail(error: unknown): DailyTrainingClientResult<never> {
  if (error instanceof GameSessionError) {
    console.error("[daily-training]", error.code, error.details);
    return {
      ok: false,
      code: error.code,
      message: DAILY_TRAINING_USER_MESSAGES[error.code],
    };
  }
  console.error("[daily-training]", error);
  return {
    ok: false,
    code: "SESSION_START_FAILED",
    message: DAILY_TRAINING_USER_MESSAGES.SESSION_START_FAILED,
  };
}

export async function startDailyTrainingSession(): Promise<
  DailyTrainingClientResult<StartDailyTrainingResult>
> {
  try {
    const value = await controller().start();
    return { ok: true, ...value };
  } catch (error) {
    return fail(error);
  }
}

export async function submitDailyTrainingAction(input: {
  sessionId: string;
  taskId: string;
  intent: StudentActionIntent;
  responseTimeMs: number | null;
}): Promise<DailyTrainingClientResult<SubmitDailyTrainingResult>> {
  try {
    const value = await controller().submit(input);
    return { ok: true, ...value };
  } catch (error) {
    if (error instanceof GameSessionError) {
      return {
        ok: false,
        code: error.code,
        message: DAILY_TRAINING_USER_MESSAGES[error.code],
      };
    }
    console.error("[daily-training]", error);
    return {
      ok: false,
      code: "NETWORK_ERROR",
      message: DAILY_TRAINING_USER_MESSAGES.NETWORK_ERROR,
    };
  }
}

export async function continueDailyTrainingSession(
  sessionId: string,
): Promise<DailyTrainingClientResult<ContinueDailyTrainingResult>> {
  try {
    const value = await controller().continue(sessionId);
    return { ok: true, ...value };
  } catch (error) {
    return fail(error);
  }
}

export async function resumeDailyTrainingSession(
  sessionId: string,
): Promise<DailyTrainingClientResult<ResumeDailyTrainingResult>> {
  try {
    const value = await controller().resume(sessionId);
    return { ok: true, ...value };
  } catch (error) {
    if (error instanceof GameSessionError && error.code === "SESSION_NOT_FOUND") {
      return {
        ok: false,
        code: "SESSION_NOT_FOUND",
        message: DAILY_TRAINING_USER_MESSAGES.SESSION_NOT_FOUND,
      };
    }
    return fail(error);
  }
}
