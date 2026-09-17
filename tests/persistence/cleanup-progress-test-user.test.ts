import { describe, expect, it } from "vitest";
import { V1_PLACEHOLDER_USER_ID } from "@/server/auth/v1-user";
import {
  assertSafeProgressTestUserId,
  cleanupProgressTestUser,
  cleanupProgressTestUserByTableDeletes,
  PROGRESS_TEST_CLEANUP_DELETE_ORDER,
  PROGRESS_TEST_CLEANUP_RPC,
  type ProgressTestCleanupClient,
} from "./cleanup-progress-test-user";

const TEST_USER = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const OTHER_USER = "ffffffff-bbbb-4ccc-8ddd-eeeeeeeeeeee";

type DeleteCall = {
  op: "rpc" | "select" | "delete";
  table?: string;
  column?: string;
  value?: string | string[];
  fn?: string;
  args?: { target_user: string };
};

function createFakeClient(options?: {
  rpcError?: { message: string; code?: string } | null;
  tableErrors?: Record<string, { message: string }>;
  modelIds?: string[];
}): { client: ProgressTestCleanupClient; calls: DeleteCall[] } {
  const calls: DeleteCall[] = [];
  const tableErrors = options?.tableErrors ?? {};
  const rpcError =
    options?.rpcError === undefined
      ? { message: "Could not find the function", code: "PGRST202" }
      : options.rpcError;

  const client: ProgressTestCleanupClient = {
    rpc: async (fn, args) => {
      calls.push({ op: "rpc", fn, args });
      return { error: rpcError };
    },
    from(table: string) {
      return {
        select: () => ({
          eq: async (column: string, value: string) => {
            calls.push({ op: "select", table, column, value });
            return {
              data: (options?.modelIds ?? ["model-1"]).map((id) => ({ id })),
              error: tableErrors[`select:${table}`] ?? null,
            };
          },
        }),
        delete: () => ({
          eq: async (column: string, value: string) => {
            calls.push({ op: "delete", table, column, value });
            return { error: tableErrors[table] ?? null };
          },
          in: async (column: string, values: string[]) => {
            calls.push({ op: "delete", table, column, value: values });
            return { error: tableErrors[table] ?? null };
          },
        }),
      };
    },
  };

  return { client, calls };
}

describe("progress-test user cleanup", () => {
  it("restricts cleanup to a randomized UUID and refuses the placeholder student", () => {
    expect(assertSafeProgressTestUserId(TEST_USER)).toBe(TEST_USER);
    expect(() => assertSafeProgressTestUserId(V1_PLACEHOLDER_USER_ID)).toThrow(
      /randomized test user/,
    );
    expect(() => assertSafeProgressTestUserId("")).toThrow(/randomized test user/);
    expect(() => assertSafeProgressTestUserId("not-a-uuid")).toThrow(/invalid user id/);
  });

  it("deletes learning_evidence before learning_tasks in FK-safe order", () => {
    expect(PROGRESS_TEST_CLEANUP_DELETE_ORDER.indexOf("learning_evidence")).toBeLessThan(
      PROGRESS_TEST_CLEANUP_DELETE_ORDER.indexOf("learning_tasks"),
    );
    expect(
      PROGRESS_TEST_CLEANUP_DELETE_ORDER.indexOf("student_lexeme_weaknesses"),
    ).toBeLessThan(
      PROGRESS_TEST_CLEANUP_DELETE_ORDER.indexOf("student_lexeme_models"),
    );
    expect(
      PROGRESS_TEST_CLEANUP_DELETE_ORDER.indexOf("student_lexeme_skill_states"),
    ).toBeLessThan(
      PROGRESS_TEST_CLEANUP_DELETE_ORDER.indexOf("student_lexeme_models"),
    );
  });

  it("calls the hygiene RPC only for the generated test user", async () => {
    const { client, calls } = createFakeClient({ rpcError: null });
    await cleanupProgressTestUser(client, TEST_USER);
    expect(calls).toEqual([
      {
        op: "rpc",
        fn: PROGRESS_TEST_CLEANUP_RPC,
        args: { target_user: TEST_USER },
      },
    ]);
    expect(JSON.stringify(calls)).not.toContain(V1_PLACEHOLDER_USER_ID);
    expect(JSON.stringify(calls)).not.toContain(OTHER_USER);
  });

  it("refuses the placeholder even before any database call", async () => {
    const { client, calls } = createFakeClient({ rpcError: null });
    await expect(
      cleanupProgressTestUser(client, V1_PLACEHOLDER_USER_ID),
    ).rejects.toThrow(/randomized test user/);
    expect(calls).toEqual([]);
  });

  it("falls back to table deletes including learning_evidence for only the test user", async () => {
    const { client, calls } = createFakeClient({
      rpcError: {
        code: "PGRST202",
        message: "Could not find the function public.cleanup_progress_test_user",
      },
      modelIds: ["model-1"],
    });
    await cleanupProgressTestUser(client, TEST_USER);

    const deleteTables = calls
      .filter((call) => call.op === "delete")
      .map((call) => call.table);
    expect(deleteTables).toEqual([
      "student_lexeme_weaknesses",
      "student_lexeme_skill_states",
      "learning_evidence",
      "student_lexeme_models",
      "learning_tasks",
      "game_sessions",
    ]);
    expect(deleteTables.indexOf("learning_evidence")).toBeLessThan(
      deleteTables.indexOf("learning_tasks"),
    );

    for (const call of calls) {
      if (call.op === "rpc") {
        expect(call.args?.target_user).toBe(TEST_USER);
      }
      if (typeof call.value === "string") {
        expect(call.value).toBe(TEST_USER);
      }
    }
    expect(JSON.stringify(calls)).not.toContain(V1_PLACEHOLDER_USER_ID);
    expect(JSON.stringify(calls)).not.toContain(OTHER_USER);
  });

  it("reports cleanup errors instead of ignoring them", async () => {
    const { client } = createFakeClient({
      tableErrors: {
        learning_evidence: { message: "learning_evidence is append-only" },
        learning_tasks: { message: "fk violation" },
      },
    });
    await expect(
      cleanupProgressTestUserByTableDeletes(client, TEST_USER),
    ).rejects.toThrow(/learning_evidence[\s\S]*learning_tasks/);
  });

  it("does not fall through to table deletes when the RPC fails for another reason", async () => {
    const { client, calls } = createFakeClient({
      rpcError: { message: "permission denied for function", code: "42501" },
    });
    await expect(cleanupProgressTestUser(client, TEST_USER)).rejects.toThrow(
      /RPC failed: permission denied/,
    );
    expect(calls.filter((call) => call.op === "delete")).toEqual([]);
  });
});
