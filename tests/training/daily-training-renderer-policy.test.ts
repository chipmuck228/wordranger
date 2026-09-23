import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  DIRECT_PRACTICE_PRESENTATION_TYPE,
  RANGER_TRIAL_GAME_ID,
  WORD_BUBBLE_GAME_TYPE,
} from "@/server/auth/v1-user";
import { selectDailyTrainingRenderer } from "@/server/training/daily-training-renderer-policy";
import {
  confusableChoiceTask,
  meaningChoiceTask,
  relationChoiceTask,
  spellingTask,
} from "../game/helpers";

describe("Daily Training renderer policy", () => {
  it("assigns DIRECT_PRACTICE for new sessions across current task types", () => {
    for (const task of [
      meaningChoiceTask(),
      relationChoiceTask(),
      confusableChoiceTask(),
      spellingTask(),
    ]) {
      const selected = selectDailyTrainingRenderer({ task });
      expect(selected.gameType).toBe(DIRECT_PRACTICE_PRESENTATION_TYPE);
      expect(selected.gameId).toBe(RANGER_TRIAL_GAME_ID);
      expect(selected.canRenderTask(task)).toBe(true);
    }
  });

  it("does not assign WordBubble or Matching for choice tasks", () => {
    expect(selectDailyTrainingRenderer({ task: meaningChoiceTask() }).gameType).not.toBe(
      "WORD_BUBBLE",
    );
    expect(selectDailyTrainingRenderer({ task: relationChoiceTask() }).gameType).not.toBe(
      "MATCHING",
    );
    expect(selectDailyTrainingRenderer({ task: confusableChoiceTask() }).gameType).not.toBe(
      "MATCHING",
    );
  });

  it("ignores recent-renderer streak", () => {
    const selected = selectDailyTrainingRenderer({
      task: meaningChoiceTask(),
      recentRendererTypes: [WORD_BUBBLE_GAME_TYPE, WORD_BUBBLE_GAME_TYPE],
    });
    expect(selected.gameType).toBe(DIRECT_PRACTICE_PRESENTATION_TYPE);
  });

  it("does not inspect AnswerKey", () => {
    const source = readFileSync(
      "src/server/training/daily-training-renderer-policy.ts",
      "utf8",
    );
    expect(source).not.toMatch(/AnswerKey|correctOptionIds|expectedAnswer|Math\.random/);
  });
});
