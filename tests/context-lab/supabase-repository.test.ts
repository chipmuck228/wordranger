import { describe, expect, it } from "vitest";
import { V1_PLACEHOLDER_USER_ID } from "@/server/auth/v1-user";
import { CONTEXT_LAB_RUN_SCHEMA_VERSION } from "@/server/context-lab/context-lab-run.types";
import { SupabaseContextLabRunRepository } from "@/server/context-lab/supabase-context-lab-run-repository";
import { createMealLabHarness } from "./helpers";

function createFakeClient(seed?: Map<string, Record<string, unknown>>) {
  const rows = seed ?? new Map<string, Record<string, unknown>>();

  function matches(row: Record<string, unknown>, filters: Record<string, unknown>) {
    return Object.entries(filters).every(([column, value]) => row[column] === value);
  }

  function query(kind: "select" | "update", payload?: Record<string, unknown>) {
    const filters: Record<string, unknown> = {};
    const builder = {
      eq(column: string, value: unknown) {
        filters[column] = value;
        return builder;
      },
      select() {
        return builder;
      },
      async maybeSingle() {
        if (kind === "select") {
          const found = [...rows.values()].find((row) => matches(row, filters));
          return { data: found ?? null, error: null };
        }
        const existing = [...rows.values()].find((row) => matches(row, filters));
        if (!existing) {
          return { data: null, error: null };
        }
        const updated = { ...existing, ...payload };
        rows.set(String(existing.id), updated);
        return { data: { revision: updated.revision }, error: null };
      },
    };
    return builder;
  }

  return {
    rows,
    from(table: string) {
      if (table !== "context_lab_runs") {
        throw new Error(`unexpected table ${table}`);
      }
      return {
        insert: async (payload: Record<string, unknown>) => {
          const id = String(payload.id);
          if (rows.has(id)) {
            return { data: null, error: { code: "23505" } };
          }
          rows.set(id, { ...payload });
          return { data: payload, error: null };
        },
        update: (payload: Record<string, unknown>) => query("update", payload),
        select: () => query("select"),
      };
    },
  };
}

describe("Context Lab Supabase repository", () => {
  it("creates, loads, and CAS-updates with ownership filters", async () => {
    const { controller, repository } = createMealLabHarness();
    const screen = await controller.start();
    if (screen.kind !== "GUIDED") {
      throw new Error("guided");
    }
    const memory = await repository.get({
      runId: screen.handle.runId,
      userId: V1_PLACEHOLDER_USER_ID,
    });
    if (!memory) {
      throw new Error("seed run");
    }
    const client = createFakeClient();
    const store = new SupabaseContextLabRunRepository(
      client as never,
      V1_PLACEHOLDER_USER_ID,
    );
    await store.create(memory);
    const loaded = await store.get({
      runId: memory.id,
      userId: V1_PLACEHOLDER_USER_ID,
    });
    expect(loaded?.revision).toBe(0);
    expect(loaded?.experienceRun.status).toBe("GUIDED_ACTIVITY_ISSUED");

    const foreign = await store.get({
      runId: memory.id,
      userId: "00000000-0000-4000-8000-000000000099",
    });
    expect(foreign).toBeNull();

    const saved = await store.saveIfRevision({
      runId: memory.id,
      userId: V1_PLACEHOLDER_USER_ID,
      expectedRevision: 0,
      nextRun: memory.experienceRun,
      updatedAt: "2026-09-20T00:00:01.000Z",
    });
    expect(saved).toEqual({ ok: true, revision: 1 });

    const stale = await store.saveIfRevision({
      runId: memory.id,
      userId: V1_PLACEHOLDER_USER_ID,
      expectedRevision: 0,
      nextRun: memory.experienceRun,
      updatedAt: "2026-09-20T00:00:02.000Z",
    });
    expect(stale).toEqual({ ok: false, reason: "REVISION_CONFLICT" });
  });

  it("rejects unknown schema versions when reading", async () => {
    const client = createFakeClient(
      new Map([
        [
          "run-1",
          {
            id: "run-1",
            user_id: V1_PLACEHOLDER_USER_ID,
            schema_version: "candidate-v9",
            experience_id: "x",
            run_state: { schemaVersion: "candidate-v9" },
            revision: 0,
            created_at: "2026-09-20T00:00:00.000Z",
            updated_at: "2026-09-20T00:00:00.000Z",
          },
        ],
      ]),
    );
    const store = new SupabaseContextLabRunRepository(
      client as never,
      V1_PLACEHOLDER_USER_ID,
    );
    await expect(
      store.get({ runId: "run-1", userId: V1_PLACEHOLDER_USER_ID }),
    ).rejects.toThrow(/schema version/);
    expect(CONTEXT_LAB_RUN_SCHEMA_VERSION).toBe("candidate-v0");
  });
});
