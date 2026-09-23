import { describe, expect, it } from "vitest";
import { V1_PLACEHOLDER_USER_ID } from "@/server/auth/v1-user";
import { CONTEXT_LAB_ERROR_CODES } from "@/components/context-lab/types";
import { ContextLabError } from "@/server/context-lab/context-lab-errors";
import { CONTEXT_LAB_RUN_SCHEMA_VERSION } from "@/server/context-lab/context-lab-run.types";
import { InMemoryContextLabRunRepository } from "@/server/context-lab/in-memory-context-lab-run-repository";
import { createMealLabHarness, FORBIDDEN_CLIENT_FIELDS } from "./helpers";

const OTHER_USER = "00000000-0000-4000-8000-000000000099";

describe("Context Lab in-memory repository", () => {
  it("creates and loads a cloned run", async () => {
    const { repository, controller } = createMealLabHarness();
    const screen = await controller.start();
    expect(screen.kind).toBe("GUIDED");
    if (screen.kind !== "GUIDED") {
      throw new Error("start must issue guided");
    }
    const loaded = await repository.get({
      runId: screen.handle.runId,
      userId: V1_PLACEHOLDER_USER_ID,
    });
    expect(loaded?.revision).toBe(0);
    expect(loaded?.experienceRun.status).toBe("GUIDED_ACTIVITY_ISSUED");
    if (!loaded) {
      throw new Error("run must load");
    }
    loaded.experienceRun.status = "COMPLETED";
    const again = await repository.get({
      runId: screen.handle.runId,
      userId: V1_PLACEHOLDER_USER_ID,
    });
    expect(again?.experienceRun.status).toBe("GUIDED_ACTIVITY_ISSUED");
  });

  it("requires ownership", async () => {
    const { repository, controller } = createMealLabHarness();
    const screen = await controller.start();
    if (screen.kind === "ERROR") {
      throw new Error(screen.code);
    }
    const foreign = await repository.get({
      runId: screen.handle.runId,
      userId: OTHER_USER,
    });
    expect(foreign).toBeNull();
  });

  it("successful CAS increments revision once", async () => {
    const { repository, controller } = createMealLabHarness();
    const first = await controller.start();
    if (first.kind !== "GUIDED") {
      throw new Error("guided required");
    }
    const loaded = await repository.get({
      runId: first.handle.runId,
      userId: V1_PLACEHOLDER_USER_ID,
    });
    if (!loaded) {
      throw new Error("missing run");
    }
    const saved = await repository.saveIfRevision({
      runId: first.handle.runId,
      userId: V1_PLACEHOLDER_USER_ID,
      expectedRevision: 0,
      nextRun: loaded.experienceRun,
      updatedAt: "2026-09-20T00:00:01.000Z",
    });
    expect(saved).toEqual({ ok: true, revision: 1 });
    const after = await repository.get({
      runId: first.handle.runId,
      userId: V1_PLACEHOLDER_USER_ID,
    });
    expect(after?.revision).toBe(1);
  });

  it("stale revision fails", async () => {
    const { repository, controller } = createMealLabHarness();
    const first = await controller.start();
    if (first.kind !== "GUIDED") {
      throw new Error("guided required");
    }
    const loaded = await repository.get({
      runId: first.handle.runId,
      userId: V1_PLACEHOLDER_USER_ID,
    });
    if (!loaded) {
      throw new Error("missing run");
    }
    await repository.saveIfRevision({
      runId: first.handle.runId,
      userId: V1_PLACEHOLDER_USER_ID,
      expectedRevision: 0,
      nextRun: loaded.experienceRun,
      updatedAt: "2026-09-20T00:00:01.000Z",
    });
    const stale = await repository.saveIfRevision({
      runId: first.handle.runId,
      userId: V1_PLACEHOLDER_USER_ID,
      expectedRevision: 0,
      nextRun: loaded.experienceRun,
      updatedAt: "2026-09-20T00:00:02.000Z",
    });
    expect(stale).toEqual({ ok: false, reason: "REVISION_CONFLICT" });
  });

  it("concurrent same-revision saves produce one success", async () => {
    const { repository, controller } = createMealLabHarness();
    const first = await controller.start();
    if (first.kind !== "GUIDED") {
      throw new Error("guided required");
    }
    const loaded = await repository.get({
      runId: first.handle.runId,
      userId: V1_PLACEHOLDER_USER_ID,
    });
    if (!loaded) {
      throw new Error("missing run");
    }
    const [a, b] = await Promise.all([
      repository.saveIfRevision({
        runId: first.handle.runId,
        userId: V1_PLACEHOLDER_USER_ID,
        expectedRevision: 0,
        nextRun: loaded.experienceRun,
        updatedAt: "2026-09-20T00:00:01.000Z",
      }),
      repository.saveIfRevision({
        runId: first.handle.runId,
        userId: V1_PLACEHOLDER_USER_ID,
        expectedRevision: 0,
        nextRun: loaded.experienceRun,
        updatedAt: "2026-09-20T00:00:02.000Z",
      }),
    ]);
    const results = [a, b];
    expect(results.filter((item) => item.ok)).toHaveLength(1);
    expect(results.filter((item) => !item.ok && item.reason === "REVISION_CONFLICT")).toHaveLength(1);
    const after = await repository.get({
      runId: first.handle.runId,
      userId: V1_PLACEHOLDER_USER_ID,
    });
    expect(after?.revision).toBe(1);
  });

  it("missing run fails safely", async () => {
    const repository = new InMemoryContextLabRunRepository();
    const saved = await repository.saveIfRevision({
      runId: "00000000-0000-4000-8000-000000000123",
      userId: V1_PLACEHOLDER_USER_ID,
      expectedRevision: 0,
      nextRun: { id: "missing" } as never,
      updatedAt: "2026-09-20T00:00:01.000Z",
    });
    expect(saved).toEqual({ ok: false, reason: "NOT_FOUND" });
  });

  it("invalid stored schema version is rejected", async () => {
    const { repository, controller } = createMealLabHarness();
    const first = await controller.start();
    if (first.kind !== "GUIDED") {
      throw new Error("guided required");
    }
    const loaded = await repository.get({
      runId: first.handle.runId,
      userId: V1_PLACEHOLDER_USER_ID,
    });
    if (!loaded) {
      throw new Error("missing run");
    }
    repository.replaceRaw({
      ...loaded,
      schemaVersion: "candidate-v9" as typeof CONTEXT_LAB_RUN_SCHEMA_VERSION,
    });
    await expect(
      repository.get({
        runId: first.handle.runId,
        userId: V1_PLACEHOLDER_USER_ID,
      }),
    ).rejects.toBeInstanceOf(ContextLabError);
  });

  it("AnswerKey fields are never persisted", async () => {
    const { repository, controller } = createMealLabHarness();
    const first = await controller.start();
    if (first.kind !== "GUIDED") {
      throw new Error("guided required");
    }
    const loaded = await repository.get({
      runId: first.handle.runId,
      userId: V1_PLACEHOLDER_USER_ID,
    });
    const serialized = JSON.stringify(loaded);
    for (const field of FORBIDDEN_CLIENT_FIELDS) {
      expect(serialized).not.toContain(`"${field}"`);
    }
    await expect(
      repository.create({
        id: "00000000-0000-4000-8000-999999999999",
        userId: V1_PLACEHOLDER_USER_ID,
        schemaVersion: CONTEXT_LAB_RUN_SCHEMA_VERSION,
        experienceId: "x",
        revision: 0,
        createdAt: "2026-09-20T00:00:00.000Z",
        updatedAt: "2026-09-20T00:00:00.000Z",
        probe: null,
        releaseId: null,
        releaseFingerprint: null,
        experienceRun: {
          ...(loaded?.experienceRun as object),
          answerKey: { exactAcceptedTexts: ["spoon"] },
        } as never,
      }),
    ).rejects.toMatchObject({
      code: CONTEXT_LAB_ERROR_CODES.PLAN_VALIDATION_FAILURE,
    });
  });
});
