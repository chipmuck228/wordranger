import { describe, expect, it } from "vitest";
import { InMemoryRangerTrialSessionStore } from "@/server/game-session/in-memory-ranger-trial-session-store";
import { createRangerTrialWorld } from "./helpers";

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

function fulfilledTasks(
  results: PromiseSettledResult<{ task?: { id: string } }>[],
) {
  return results
    .filter(
      (result): result is PromiseFulfilledResult<{ task?: { id: string } }> =>
        result.status === "fulfilled" && Boolean(result.value.task),
    )
    .map((result) => result.value.task!.id);
}

describe("Ranger Trial session concurrency", () => {
  it("CONC1: double continue advances once and does not return two current tasks", async () => {
    const world = createRangerTrialWorld();
    const started = await world.controller.start();
    await world.controller.submit({
      sessionId: started.session.sessionId,
      taskId: started.task.id,
      intent: choiceIntent(started.task),
      responseTimeMs: 400,
    });
    const tasksBefore = world.tasks.listTaskIds();
    const results = await Promise.allSettled([
      world.controller.continue(started.session.sessionId),
      world.createController().continue(started.session.sessionId),
    ]);
    const record = await world.sessions.get(started.session.sessionId);
    expect(record?.currentNeedIndex).toBe(1);
    expect(record?.currentTaskId).toBeTruthy();
    const returned = fulfilledTasks(results);
    expect(new Set(returned).size).toBeLessThanOrEqual(1);
    for (const taskId of returned) {
      expect(taskId).toBe(record?.currentTaskId);
    }
    const generatedAfterContinue = world.tasks
      .listTaskIds()
      .filter((id) => !tasksBefore.includes(id));
    expect(generatedAfterContinue).toHaveLength(1);
    expect(generatedAfterContinue[0]).toBe(record?.currentTaskId);
  });

  it("CONC2: concurrent submit keeps one Evidence and one stats increment", async () => {
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
    expect(record?.lastCompletedTaskId).toBe(started.task.id);
    expect(record?.phase).toBe("awaiting_continue");
    expect(record?.lastFeedback).toBeTruthy();
    expect(record?.revision).toBeGreaterThanOrEqual(1);
  });

  it("CONC3: submit/continue overlap ends in a valid session", async () => {
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
      world.createController().continue(started.session.sessionId),
    ]);
    const record = await world.sessions.get(started.session.sessionId);
    expect(world.learning.listEvidenceForUser(world.userId).length).toBeLessThanOrEqual(
      1,
    );
    expect(record).toBeTruthy();
    if (record?.phase === "awaiting_continue") {
      expect(record.currentNeedIndex).toBe(0);
      expect(record.currentTaskId).toBe(started.task.id);
      expect(record.lastCompletedTaskId).toBe(started.task.id);
    } else if (record?.phase === "awaiting_action") {
      expect(record.currentNeedIndex).toBeGreaterThanOrEqual(0);
      expect(record.currentNeedIndex).toBeLessThanOrEqual(1);
      expect(record.currentTaskId).toBeTruthy();
    } else {
      expect(record?.phase).toBe("completed");
    }
  });

  it("CONC4: double resume generation claims one current task", async () => {
    const world = createRangerTrialWorld();
    const started = await world.controller.start();
    const existing = await world.sessions.get(started.session.sessionId);
    expect(existing).toBeTruthy();
    await world.sessions.save({
      ...existing!,
      currentTaskId: null,
    });
    const tasksBefore = world.tasks.listTaskIds();
    const results = await Promise.allSettled([
      world.controller.resume(started.session.sessionId),
      world.createController().resume(started.session.sessionId),
    ]);
    const record = await world.sessions.get(started.session.sessionId);
    expect(record?.phase).toBe("awaiting_action");
    expect(record?.currentTaskId).toBeTruthy();
    const returned = fulfilledTasks(results);
    expect(new Set(returned).size).toBeLessThanOrEqual(1);
    for (const taskId of returned) {
      expect(taskId).toBe(record?.currentTaskId);
    }
    const generated = world.tasks
      .listTaskIds()
      .filter((id) => !tasksBefore.includes(id));
    expect(generated).toHaveLength(1);
    expect(generated[0]).toBe(record?.currentTaskId);
  });

  it("REV1: revision increases monotonically", async () => {
    const world = createRangerTrialWorld();
    const started = await world.controller.start();
    let record = await world.sessions.get(started.session.sessionId);
    expect(record?.revision).toBe(0);
    record = await world.sessions.save(record!);
    expect(record.revision).toBe(1);
    record = await world.sessions.save(record);
    expect(record.revision).toBe(2);
    record = await world.sessions.save(record);
    expect(record.revision).toBe(3);
    expect((await world.sessions.get(started.session.sessionId))?.revision).toBe(3);
  });

  it("REV2/REV3: stale in-memory save is rejected and winner remains", async () => {
    const store = new InMemoryRangerTrialSessionStore();
    const world = createRangerTrialWorld();
    const started = await world.controller.start();
    const base = await world.sessions.get(started.session.sessionId);
    expect(base).toBeTruthy();
    await store.create(base!);
    const readerA = await store.get(base!.sessionId);
    const readerB = await store.get(base!.sessionId);
    const savedA = await store.save({
      ...readerA!,
      currentTaskId: "task-a",
    });
    expect(savedA.revision).toBe((readerA?.revision ?? 0) + 1);
    await expect(
      store.save({
        ...readerB!,
        currentTaskId: "task-b",
      }),
    ).rejects.toMatchObject({ code: "SESSION_CONFLICT" });
    const stored = await store.get(base!.sessionId);
    expect(stored?.currentTaskId).toBe("task-a");
    expect(stored?.revision).toBe(savedA.revision);
  });
});
