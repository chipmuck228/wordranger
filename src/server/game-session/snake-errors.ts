import {
  GAME_SESSION_USER_MESSAGES,
  type GameSessionErrorCode,
} from "./ranger-trial-errors";

export const SNAKE_USER_MESSAGES: Record<GameSessionErrorCode, string> = {
  ...GAME_SESSION_USER_MESSAGES,
  SESSION_START_FAILED: "贪食蛇没能开始，请稍后再试。",
  NO_PLAYABLE_NEEDS: "这一轮暂时没有适合贪食蛇的练习。",
  GAME_CANNOT_RENDER_TASK: "这道题暂时无法在贪食蛇中显示。",
  TASK_NOT_FOUND: "找不到这道题，请重新开始贪食蛇。",
  SESSION_NOT_FOUND: "找不到这一轮贪食蛇，请重新开始。",
  SESSION_COMPLETED: "这一轮贪食蛇已经完成。",
};
