export type GameSessionErrorCode =
  | "SESSION_START_FAILED"
  | "NO_LEARNING_NEEDS"
  | "TASK_GENERATION_FAILED"
  | "GAME_CANNOT_RENDER_TASK"
  | "TASK_ALREADY_COMPLETED"
  | "TASK_NOT_FOUND"
  | "SESSION_NOT_FOUND"
  | "SESSION_COMPLETED"
  | "NETWORK_ERROR";

export class GameSessionError extends Error {
  readonly code: GameSessionErrorCode;
  readonly details: Record<string, unknown>;

  constructor(
    code: GameSessionErrorCode,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "GameSessionError";
    this.code = code;
    this.details = details;
  }
}

export const GAME_SESSION_USER_MESSAGES: Record<GameSessionErrorCode, string> =
  {
    SESSION_START_FAILED: "闯关没能开始，请稍后再试。",
    NO_LEARNING_NEEDS: "暂时没有需要练习的单词。",
    TASK_GENERATION_FAILED: "这一轮题目没能准备好，请稍后再试。",
    GAME_CANNOT_RENDER_TASK: "这道题暂时无法在单词闯关中显示。",
    TASK_ALREADY_COMPLETED: "这道题已经提交过了。",
    TASK_NOT_FOUND: "找不到这道题，请重新开始闯关。",
    SESSION_NOT_FOUND: "找不到这一轮闯关，请重新开始。",
    SESSION_COMPLETED: "这一轮已经完成。",
    NETWORK_ERROR: "网络好像出了点问题，请再试一次。",
  };
