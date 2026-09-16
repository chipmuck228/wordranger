import {
  GAME_SESSION_USER_MESSAGES,
  GameSessionError,
  type GameSessionErrorCode,
} from "./ranger-trial-errors";

export type GameSessionClientResult<T> =
  | ({ ok: true } & T)
  | { ok: false; code: GameSessionErrorCode; message: string };

export function gameSessionFail(
  error: unknown,
  logLabel: string,
  messages: Record<GameSessionErrorCode, string> = GAME_SESSION_USER_MESSAGES,
): GameSessionClientResult<never> {
  if (error instanceof GameSessionError) {
    console.error(`[${logLabel}]`, error.code, error.details);
    return {
      ok: false,
      code: error.code,
      message: messages[error.code],
    };
  }
  console.error(`[${logLabel}]`, error);
  return {
    ok: false,
    code: "SESSION_START_FAILED",
    message: messages.SESSION_START_FAILED,
  };
}
