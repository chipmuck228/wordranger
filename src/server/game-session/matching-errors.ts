import {
  GAME_SESSION_USER_MESSAGES,
  type GameSessionErrorCode,
} from "./ranger-trial-errors";

export const MATCHING_USER_MESSAGES: Record<GameSessionErrorCode, string> = {
  ...GAME_SESSION_USER_MESSAGES,
  SESSION_START_FAILED: "连连看没能开始，请稍后再试。",
  NO_PLAYABLE_NEEDS: "这一轮暂时没有适合连连看的练习。",
  GAME_CANNOT_RENDER_TASK: "这道题暂时无法在连连看中显示。",
  TASK_NOT_FOUND: "找不到这道题，请重新开始连连看。",
  SESSION_NOT_FOUND: "找不到这一轮连连看，请重新开始。",
  SESSION_COMPLETED: "这一轮连连看已经完成。",
};
