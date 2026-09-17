"use server";

import { createMatchingRuntime } from "@/server/runtime/create-matching-runtime";
import { GameSessionError } from "@/server/game-session/ranger-trial-errors";
import {
  gameSessionFail,
  type GameSessionClientResult,
} from "@/server/game-session/game-session-client-result";
import { MATCHING_USER_MESSAGES } from "@/server/game-session/matching-errors";
import type {
  ContinueGameSessionResult,
  ResumeGameSessionResult,
  StartGameSessionResult,
  StudentActionIntent,
  SubmitGameSessionResult,
} from "@/server/game-session/learning-game-session.types";

function controller() {
  return createMatchingRuntime().createController();
}

function fail(error: unknown): GameSessionClientResult<never> {
  return gameSessionFail(error, "matching", MATCHING_USER_MESSAGES);
}

export async function startMatchingSession(): Promise<
  GameSessionClientResult<StartGameSessionResult>
> {
  try {
    const value = await controller().start();
    return { ok: true, ...value };
  } catch (error) {
    return fail(error);
  }
}

export async function submitMatchingAction(input: {
  sessionId: string;
  taskId: string;
  intent: StudentActionIntent;
  responseTimeMs: number | null;
}): Promise<GameSessionClientResult<SubmitGameSessionResult>> {
  try {
    const value = await controller().submit(input);
    return { ok: true, ...value };
  } catch (error) {
    if (error instanceof GameSessionError) {
      return {
        ok: false,
        code: error.code,
        message: MATCHING_USER_MESSAGES[error.code],
      };
    }
    return fail(error);
  }
}

export async function continueMatchingSession(
  sessionId: string,
): Promise<GameSessionClientResult<ContinueGameSessionResult>> {
  try {
    const value = await controller().continue(sessionId);
    return { ok: true, ...value };
  } catch (error) {
    return fail(error);
  }
}

export async function resumeMatchingSession(
  sessionId: string,
): Promise<GameSessionClientResult<ResumeGameSessionResult>> {
  try {
    const value = await controller().resume(sessionId);
    return { ok: true, ...value };
  } catch (error) {
    if (error instanceof GameSessionError && error.code === "SESSION_NOT_FOUND") {
      return {
        ok: false,
        code: "SESSION_NOT_FOUND",
        message: MATCHING_USER_MESSAGES.SESSION_NOT_FOUND,
      };
    }
    return fail(error);
  }
}
