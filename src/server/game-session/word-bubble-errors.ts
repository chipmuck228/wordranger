import {
  GAME_SESSION_USER_MESSAGES,
  type GameSessionErrorCode,
} from "./ranger-trial-errors";

export const WORD_BUBBLE_USER_MESSAGES: Record<GameSessionErrorCode, string> = {
  ...GAME_SESSION_USER_MESSAGES,
  SESSION_START_FAILED: "泡泡练习没能开始，请稍后再试。",
  NO_PLAYABLE_NEEDS: "这一轮暂时没有适合单词泡泡的练习。",
  GAME_CANNOT_RENDER_TASK: "这道题暂时无法在单词泡泡中显示。",
  TASK_NOT_FOUND: "找不到这道题，请重新开始泡泡练习。",
  SESSION_NOT_FOUND: "找不到这一轮泡泡练习，请重新开始。",
  SESSION_COMPLETED: "这一轮泡泡练习已经完成。",
};
