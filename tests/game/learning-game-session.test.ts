import { describe, expect, it } from "vitest";
import {
  MATCHING_GAME_ID,
  MATCHING_GAME_TYPE,
  RANGER_TRIAL_GAME_ID,
  RANGER_TRIAL_GAME_TYPE,
  WORD_BUBBLE_GAME_ID,
  WORD_BUBBLE_GAME_TYPE,
} from "@/server/auth/v1-user";
import { LearningGameSessionController } from "@/server/game-session/learning-game-session-controller";
import { InMemoryGameSessionStore } from "@/server/game-session/in-memory-game-session-store";
import { RANGER_TRIAL_GAME_DEFINITION } from "@/server/game-session/ranger-trial-capability";
import { WORD_BUBBLE_GAME_DEFINITION } from "@/server/game-session/word-bubble-capability";
import { MATCHING_GAME_DEFINITION } from "@/server/game-session/matching-capability";
import { GameSessionError } from "@/server/game-session/ranger-trial-errors";
import {
  createMatchingWorld,
  createRangerTrialWorld,
  createWordBubbleWorld,
} from "./helpers";

describe("generic learning game session controller", () => {
  it("persists Ranger Trial, Word Bubble, and Matching with distinct game types and ids", async () => {
    const ranger = createRangerTrialWorld();
    const bubble = createWordBubbleWorld();
    const matching = createMatchingWorld();
    const rangerStarted = await ranger.controller.start();
    const bubbleStarted = await bubble.controller.start();
    const matchingStarted = await matching.controller.start();
    expect(rangerStarted.task.responseContract.kind === "CHOICE" || rangerStarted.task.responseContract.kind === "TEXT_INPUT").toBe(
      true,
    );
    expect(bubbleStarted.task.responseContract.kind).toBe("CHOICE");
    expect(matchingStarted.task.responseContract.kind).toBe("CHOICE");

    await ranger.controller.submit({
      sessionId: rangerStarted.session.sessionId,
      taskId: rangerStarted.task.id,
      intent:
        rangerStarted.task.responseContract.kind === "CHOICE"
          ? {
              kind: "CHOICE",
              optionId: rangerStarted.task.responseContract.options[0].id,
            }
          : { kind: "TEXT_INPUT", value: "x" },
      responseTimeMs: 300,
    });
    await bubble.controller.submit({
      sessionId: bubbleStarted.session.sessionId,
      taskId: bubbleStarted.task.id,
      intent: {
        kind: "CHOICE",
        optionId:
          bubbleStarted.task.responseContract.kind === "CHOICE"
            ? bubbleStarted.task.responseContract.options[0].id
            : "missing",
      },
      responseTimeMs: 300,
    });
    await matching.controller.submit({
      sessionId: matchingStarted.session.sessionId,
      taskId: matchingStarted.task.id,
      intent: {
        kind: "CHOICE",
        optionId:
          matchingStarted.task.responseContract.kind === "CHOICE"
            ? matchingStarted.task.responseContract.options[0].id
            : "missing",
      },
      responseTimeMs: 300,
    });

    expect(ranger.learning.listEvidenceForUser(ranger.userId)[0].gameId).toBe(
      RANGER_TRIAL_GAME_ID,
    );
    expect(bubble.learning.listEvidenceForUser(bubble.userId)[0].gameId).toBe(
      WORD_BUBBLE_GAME_ID,
    );
    expect(matching.learning.listEvidenceForUser(matching.userId)[0].gameId).toBe(
      MATCHING_GAME_ID,
    );
  });

  it("does not resume a session from a different game type", async () => {
    const shared = new Map();
    const rangerStore = new InMemoryGameSessionStore(
      RANGER_TRIAL_GAME_TYPE,
      shared,
    );
    const bubbleStore = new InMemoryGameSessionStore(
      WORD_BUBBLE_GAME_TYPE,
      shared,
    );
    const rangerWorld = createRangerTrialWorld();
    const rangerController = new LearningGameSessionController({
      ...rangerWorld,
      definition: RANGER_TRIAL_GAME_DEFINITION,
      sessions: rangerStore,
    });
    const started = await rangerController.start();
    const bubbleController = new LearningGameSessionController({
      ...rangerWorld,
      definition: WORD_BUBBLE_GAME_DEFINITION,
      sessions: bubbleStore,
      userId: rangerWorld.userId,
    });
    await expect(bubbleController.resume(started.session.sessionId)).rejects.toMatchObject({
      code: "SESSION_NOT_FOUND",
    });
    const matchingStore = new InMemoryGameSessionStore(
      MATCHING_GAME_TYPE,
      shared,
    );
    const matchingController = new LearningGameSessionController({
      ...rangerWorld,
      definition: MATCHING_GAME_DEFINITION,
      sessions: matchingStore,
      userId: rangerWorld.userId,
    });
    await expect(matchingController.resume(started.session.sessionId)).rejects.toMatchObject({
      code: "SESSION_NOT_FOUND",
    });
  });

  it("uses the same revision CAS: create at 0, save increments, stale save conflicts", async () => {
    const ranger = createRangerTrialWorld();
    const started = await ranger.controller.start();
    const first = await ranger.sessions.get(started.session.sessionId);
    expect(first?.revision).toBe(0);
    await ranger.controller.submit({
      sessionId: started.session.sessionId,
      taskId: started.task.id,
      intent:
        started.task.responseContract.kind === "CHOICE"
          ? {
              kind: "CHOICE",
              optionId: started.task.responseContract.options[0].id,
            }
          : { kind: "TEXT_INPUT", value: "x" },
      responseTimeMs: 200,
    });
    const afterSubmit = await ranger.sessions.get(started.session.sessionId);
    expect(afterSubmit?.revision).toBeGreaterThan(0);
    await expect(ranger.sessions.save(first!)).rejects.toBeInstanceOf(
      GameSessionError,
    );
    await expect(ranger.sessions.save(first!)).rejects.toMatchObject({
      code: "SESSION_CONFLICT",
    });
  });
});
