import {
  MATCHING_GAME_TYPE,
  RANGER_TRIAL_GAME_TYPE,
  SNAKE_GAME_TYPE,
  WORD_BUBBLE_GAME_TYPE,
} from "@/server/auth/v1-user";

export const TRAINING_RENDERER_COPY: Record<
  string,
  { label: string; instruction: string }
> = {
  [WORD_BUBBLE_GAME_TYPE]: {
    label: "单词泡泡",
    instruction: "点中正确的泡泡。",
  },
  [MATCHING_GAME_TYPE]: {
    label: "连连看",
    instruction: "先点左边，再找到右边最合适的一项。",
  },
  [SNAKE_GAME_TYPE]: {
    label: "贪食蛇",
    instruction: "控制小蛇，吃到正确答案。",
  },
  [RANGER_TRIAL_GAME_TYPE]: {
    label: "单词闯关",
    instruction: "选出或输入答案。",
  },
};
