import { describe, expect, it } from "vitest";
import { RangerTrialSessionController } from "@/server/game-session/ranger-trial-session";
import { GameSessionError } from "@/server/game-session/ranger-trial-errors";
import type {
  RangerTrialSessionRecord,
  RangerTrialSessionStore,
} from "@/server/game-session/ranger-trial-session.types";
import { sequentialIdFactory } from "../learning/helpers";
import { createRangerTrialWorld, RANGER_NOW } from "./helpers";

class FailNthSaveStore implements RangerTrialSessionStore {
  saves = 0;

  constructor(
    private readonly inner: RangerTrialSessionStore,
    private readonly failAt: number,
  ) {}

  async save(record: RangerTrialSessionRecord): Promise<void> {
    this.saves += 1;
    if (this.saves === this.failAt) {
      throw new GameSessionError(
        "NETWORK_ERROR",
        "simulated session save failure",
      );
    }
    await this.inner.save(record);
  }

  get(sessionId: string): Promise<RangerTrialSessionRecord | null> {
    return this.inner.get(sessionId);
  }
}

function choiceIntent(task: {
  responseContract: { kind: string; options?: Array<{ id: string }> };
}) {
  if (task.responseContract.kind !== "CHOICE" || !task.responseContract.options) {
    throw new Error("expected CHOICE");
  }
  return {
    kind: "CHOICE" as const,
    optionId: task.responseContract.options[0].id,
  };
}

describe("Ranger Trial cold-start simulation", () => {
  it("COLD1: start on controller A, resume on controller B", async () => {
    const world = createRangerTrialWorld();
    const started = await world.controller.start();
    const resumed = await world.createController().resume(started.session.sessionId);
    expect(resumed.task?.id).toBe(started.task.id);
    expect(resumed.progress.planId).toBe(started.session.planId);
  });

  it("COLD2: start on A, submit on B", async () => {
    const world = createRangerTrialWorld();
    const started = await world.controller.start();
    const submitted = await world.createController().submit({
      sessionId: started.session.sessionId,
      taskId: started.task.id,
      intent: choiceIntent(started.task),
      responseTimeMs: 400,
    });
    expect(submitted.feedback.status).toBeTruthy();
    expect(world.learning.listEvidenceForUser(world.userId)).toHaveLength(1);
    const record = await world.sessions.get(started.session.sessionId);
    expect(record?.phase).toBe("awaiting_continue");
  });

  it("COLD3: submit on A, continue on B", async () => {
    const world = createRangerTrialWorld();
    const started = await world.controller.start();
    await world.controller.submit({
      sessionId: started.session.sessionId,
      taskId: started.task.id,
      intent: choiceIntent(started.task),
      responseTimeMs: 400,
    });
    const continued = await world.createController().continue(
      started.session.sessionId,
    );
    expect(continued.completed).toBe(false);
    expect(continued.task).toBeTruthy();
    expect(continued.task!.id).not.toBe(started.task.id);
  });

  it("COLD4: submit on A, resume on B restores feedback", async () => {
    const world = createRangerTrialWorld();
    const started = await world.controller.start();
    const submitted = await world.controller.submit({
      sessionId: started.session.sessionId,
      taskId: started.task.id,
      intent: choiceIntent(started.task),
      responseTimeMs: 400,
    });
    const resumed = await world.createController().resume(started.session.sessionId);
    expect(resumed.feedback?.status).toBe(submitted.feedback.status);
    expect(resumed.feedback?.message).toBe(submitted.feedback.message);
    expect(resumed.task).toBeUndefined();
  });
});

describe("Ranger Trial idempotent submission", () => {
  it("IDEM1: same task submitted twice sequentially yields one Evidence", async () => {
    const world = createRangerTrialWorld();
    const started = await world.controller.start();
    const payload = {
      sessionId: started.session.sessionId,
      taskId: started.task.id,
      intent: choiceIntent(started.task),
      responseTimeMs: 400,
    };
    await world.controller.submit(payload);
    await expect(world.controller.submit(payload)).rejects.toMatchObject({
      code: "TASK_ALREADY_COMPLETED",
    });
    expect(world.learning.listEvidenceForUser(world.userId)).toHaveLength(1);
    const record = await world.sessions.get(started.session.sessionId);
    expect(record?.stats.attempted).toBe(1);
  });

  it("IDEM2: same task submitted through two controller instances yields one Evidence", async () => {
    const world = createRangerTrialWorld();
    const started = await world.controller.start();
    const payload = {
      sessionId: started.session.sessionId,
      taskId: started.task.id,
      intent: choiceIntent(started.task),
      responseTimeMs: 400,
    };
    await world.controller.submit(payload);
    await expect(world.createController().submit(payload)).rejects.toMatchObject({
      code: "TASK_ALREADY_COMPLETED",
    });
    expect(world.learning.listEvidenceForUser(world.userId)).toHaveLength(1);
    const record = await world.sessions.get(started.session.sessionId);
    expect(record?.stats.attempted).toBe(1);
  });

  it("IDEM3: evidence success then session-save failure recovers stats once", async () => {
    const world = createRangerTrialWorld();
    const started = await world.controller.start();
    const payload = {
      sessionId: started.session.sessionId,
      taskId: started.task.id,
      intent: choiceIntent(started.task),
      responseTimeMs: 400,
    };
    const controllerA = new RangerTrialSessionController({
      userId: world.userId,
      vocabulary: world.vocabulary,
      query: world.query,
      tasks: world.tasks,
      learning: world.learning,
      sessions: new FailNthSaveStore(world.sessions, 1),
      now: () => RANGER_NOW,
      createId: sequentialIdFactory("rid-fail"),
      createEvidenceId: sequentialIdFactory("ev-fail"),
      requestedNeedCount: 8,
    });
    await expect(controllerA.submit(payload)).rejects.toMatchObject({
      code: "NETWORK_ERROR",
    });
    expect(world.learning.listEvidenceForUser(world.userId)).toHaveLength(1);
    expect((await world.sessions.get(started.session.sessionId))?.stats.attempted).toBe(
      0,
    );

    const recovered = await world.createController().submit(payload);
    expect(recovered.stats.attempted).toBe(1);
    expect((await world.sessions.get(started.session.sessionId))?.phase).toBe(
      "awaiting_continue",
    );

    await expect(world.createController().submit(payload)).rejects.toMatchObject({
      code: "TASK_ALREADY_COMPLETED",
    });
    expect((await world.sessions.get(started.session.sessionId))?.stats.attempted).toBe(
      1,
    );
    expect(world.learning.listEvidenceForUser(world.userId)).toHaveLength(1);
  });

  it("IDEM4: continue twice does not skip two needs", async () => {
    const world = createRangerTrialWorld();
    const started = await world.controller.start();
    await world.controller.submit({
      sessionId: started.session.sessionId,
      taskId: started.task.id,
      intent: choiceIntent(started.task),
      responseTimeMs: 400,
    });
    const first = await world.controller.continue(started.session.sessionId);
    const second = await world.createController().continue(
      started.session.sessionId,
    );
    expect(first.task).toBeTruthy();
    expect(second.task?.id).toBe(first.task!.id);
    const record = await world.sessions.get(started.session.sessionId);
    expect(record?.currentNeedIndex).toBe(1);
  });

  it("concurrent submit attempts keep one Evidence and increment stats once", async () => {
    const world = createRangerTrialWorld();
    const started = await world.controller.start();
    const payload = {
      sessionId: started.session.sessionId,
      taskId: started.task.id,
      intent: choiceIntent(started.task),
      responseTimeMs: 400,
    };
    await Promise.allSettled([
      world.controller.submit(payload),
      world.createController().submit(payload),
    ]);
    expect(world.learning.listEvidenceForUser(world.userId)).toHaveLength(1);
    const record = await world.sessions.get(started.session.sessionId);
    expect(record?.stats.attempted).toBe(1);
  });
});
