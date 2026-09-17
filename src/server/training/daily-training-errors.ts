import {
  GAME_SESSION_USER_MESSAGES,
  type GameSessionErrorCode,
} from "@/server/game-session/ranger-trial-errors";

export const DAILY_TRAINING_USER_MESSAGES: Record<GameSessionErrorCode, string> =
  {
    ...GAME_SESSION_USER_MESSAGES,
    SESSION_START_FAILED: "暂时没能准备好今天的训练，请稍后再试。",
    NO_PLAYABLE_NEEDS: "暂时没有需要练习的单词。",
    TASK_GENERATION_FAILED: "暂时没能准备好今天的训练，请稍后再试。",
    GAME_CANNOT_RENDER_TASK: "这一题暂时无法显示，请稍后再试。",
    NO_COMPATIBLE_RENDERER: "这一题暂时无法显示，请稍后再试。",
    TASK_NOT_FOUND: "找不到这道题，请重新开始今天的训练。",
    SESSION_NOT_FOUND: "找不到这一轮训练，请重新开始。",
    SESSION_COMPLETED: "这一轮已经完成。",
    NETWORK_ERROR: "暂时没能准备好今天的训练，请稍后再试。",
  };
