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
});
