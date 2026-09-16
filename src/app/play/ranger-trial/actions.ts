"use server";

import { createRangerTrialRuntime } from "@/server/runtime/create-ranger-trial-runtime";
import {
  GAME_SESSION_USER_MESSAGES,
  GameSessionError,
  type GameSessionErrorCode,
} from "@/server/game-session/ranger-trial-errors";
import type {
  ContinueRangerTrialResult,
  ResumeRangerTrialResult,
  StartRangerTrialResult,
  StudentActionIntent,
  SubmitRangerTrialResult,
} from "@/server/game-session/ranger-trial-session.types";

function controller() {
  return createRangerTrialRuntime().createController();
}

export type RangerTrialClientResult<T> =
  | ({ ok: true } & T)
  | { ok: false; code: GameSessionErrorCode; message: string };

function fail(error: unknown): RangerTrialClientResult<never> {
  if (error instanceof GameSessionError) {
    console.error("[ranger-trial]", error.code, error.details);
    return {
      ok: false,
      code: error.code,
      message: GAME_SESSION_USER_MESSAGES[error.code],
    };
  }
  console.error("[ranger-trial]", error);
  return {
    ok: false,
    code: "SESSION_START_FAILED",
    message: GAME_SESSION_USER_MESSAGES.SESSION_START_FAILED,
  };
}

export async function startRangerTrialSession(): Promise<
  RangerTrialClientResult<StartRangerTrialResult>
> {
  try {
    const value = await controller().start();
    return { ok: true, ...value };
  } catch (error) {
    return fail(error);
  }
}

export async function submitRangerTrialAction(input: {
  sessionId: string;
  taskId: string;
  intent: StudentActionIntent;
  responseTimeMs: number | null;
}): Promise<RangerTrialClientResult<SubmitRangerTrialResult>> {
  try {
    const value = await controller().submit(input);
    return { ok: true, ...value };
  } catch (error) {
    if (error instanceof GameSessionError) {
      return {
        ok: false,
        code: error.code,
        message: GAME_SESSION_USER_MESSAGES[error.code],
      };
    }
    console.error("[ranger-trial]", error);
    return {
      ok: false,
      code: "NETWORK_ERROR",
      message: GAME_SESSION_USER_MESSAGES.NETWORK_ERROR,
    };
  }
}

export async function continueRangerTrialSession(
  sessionId: string,
): Promise<RangerTrialClientResult<ContinueRangerTrialResult>> {
  try {
    const value = await controller().continue(sessionId);
    return { ok: true, ...value };
  } catch (error) {
    return fail(error);
  }
}

export async function resumeRangerTrialSession(
  sessionId: string,
): Promise<RangerTrialClientResult<ResumeRangerTrialResult>> {
  try {
    const value = await controller().resume(sessionId);
    return { ok: true, ...value };
  } catch (error) {
    if (error instanceof GameSessionError && error.code === "SESSION_NOT_FOUND") {
      return {
        ok: false,
        code: "SESSION_NOT_FOUND",
        message: GAME_SESSION_USER_MESSAGES.SESSION_NOT_FOUND,
      };
    }
    return fail(error);
  }
}
