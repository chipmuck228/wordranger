import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const clients = [
  "src/app/play/ranger-trial/ranger-trial-play-client.tsx",
  "src/app/play/word-bubble/word-bubble-play-client.tsx",
  "src/app/play/matching/matching-play-client.tsx",
  "src/app/play/snake/snake-play-client.tsx",
];

describe("R6 shared client runtime error policy", () => {
  it("all four play clients bound start/submit/continue and share retry UX", () => {
    for (const relative of clients) {
      const text = readFileSync(path.join(process.cwd(), relative), "utf8");
      expect(text, relative).toContain("withClientGameTimeout");
      expect(text, relative).toContain("GameSessionErrorPanel");
      expect(text, relative).toContain("GAME_SESSION_USER_MESSAGES.NETWORK_ERROR");
      expect(text, relative).toContain("onRetry");
    }
  });

  it("Daily Training client bounds loading and uses student-facing retry copy", () => {
    const text = readFileSync(
      path.join(process.cwd(), "src/app/train/daily-training-play-client.tsx"),
      "utf8",
    );
    expect(text).toContain("withClientGameTimeout");
    expect(text).toContain("GameSessionErrorPanel");
    expect(text).toContain("DAILY_TRAINING_USER_MESSAGES.NETWORK_ERROR");
    expect(text).toContain("正在准备今天的训练…");
    expect(text).toContain("onRetry");
    expect(text).not.toContain("TaskEvaluator");
    expect(text).not.toContain("LearningRepository");
    expect(text).not.toContain("DefaultTaskGenerator");
    expect(text).not.toContain("TaskAnswerKey");
    expect(text).not.toContain("createClient");
  });

  it("TrainingRenderer reuses game components and stays off the server registry", () => {
    const text = readFileSync(
      path.join(process.cwd(), "src/components/training/TrainingRenderer.tsx"),
      "utf8",
    );
    expect(text).toContain("RangerTrial");
    expect(text).toContain("WordBubble");
    expect(text).toContain("MatchingGame");
    expect(text).toContain("SnakeGame");
    expect(text).not.toContain("renderer-registry");
    expect(text).not.toContain("TaskEvaluator");
    expect(text).not.toContain("DefaultTaskGenerator");
  });
});
