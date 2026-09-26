import { V1_PLACEHOLDER_USER_ID } from "@/server/auth/v1-user";

export const PROGRESS_TEST_CLEANUP_RPC = "cleanup_progress_test_user";

/** FK-safe table cleanup after the hygiene RPC. Evidence before tasks. */
export const PROGRESS_TEST_CLEANUP_DELETE_ORDER = [
  "student_lexeme_weaknesses",
  "student_lexeme_skill_states",
  "learning_evidence",
  "student_lexeme_models",
  "learning_tasks",
  "game_sessions",
] as const;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PostgrestErrorLike = {
  message: string;
  code?: string;
} | null;

export type ProgressTestCleanupClient = {
  rpc: (
    fn: string,
    args: { target_user: string },
  ) => PromiseLike<{ error: PostgrestErrorLike }>;
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string,
      ) => PromiseLike<{
        data: Array<{ id: string }> | null;
        error: PostgrestErrorLike;
      }>;
    };
    delete: () => {
      eq: (
        column: string,
        value: string,
      ) => PromiseLike<{ error: PostgrestErrorLike }>;
      in: (
        column: string,
        values: string[],
      ) => PromiseLike<{ error: PostgrestErrorLike }>;
    };
  };
};

export function assertSafeProgressTestUserId(userId: string): string {
  if (!userId || userId === V1_PLACEHOLDER_USER_ID) {
    throw new Error(
      "Refusing progress-test cleanup for V1_PLACEHOLDER_USER_ID. Cleanup is restricted to the randomized test user.",
    );
  }
  if (!UUID_RE.test(userId)) {
    throw new Error(
      `Refusing progress-test cleanup for invalid user id: ${userId}`,
    );
  }
  return userId;
}

function isMissingRpcError(error: NonNullable<PostgrestErrorLike>): boolean {
  return (
    error.code === "PGRST202" ||
    /could not find the function|does not exist|schema cache/i.test(
      error.message,
    )
  );
}

function isAppendOnlyError(error: NonNullable<PostgrestErrorLike>): boolean {
  return /append-only/i.test(error.message);
}

export async function cleanupProgressTestUser(
  client: ProgressTestCleanupClient,
  userId: string,
): Promise<void> {
  const safeUserId = assertSafeProgressTestUserId(userId);
  const rpc = await client.rpc(PROGRESS_TEST_CLEANUP_RPC, {
    target_user: safeUserId,
  });
  if (!rpc.error) {
    return;
  }
  if (!isMissingRpcError(rpc.error)) {
    throw new Error(
      `Progress test cleanup RPC failed: ${rpc.error.message}`,
    );
  }
  await cleanupProgressTestUserByTableDeletes(client, safeUserId);
}

export async function cleanupProgressTestUserByTableDeletes(
  client: ProgressTestCleanupClient,
  userId: string,
): Promise<void> {
  const safeUserId = assertSafeProgressTestUserId(userId);
  const errors: string[] = [];

  const models = await client
    .from("student_lexeme_models")
    .select("id")
    .eq("user_id", safeUserId);
  if (models.error) {
    errors.push(`select student_lexeme_models: ${models.error.message}`);
  }
  const modelIds = (models.data ?? []).map((row) => row.id);

  if (modelIds.length > 0) {
    const weaknesses = await client
      .from("student_lexeme_weaknesses")
      .delete()
      .in("student_lexeme_model_id", modelIds);
    if (weaknesses.error) {
      errors.push(
        `delete student_lexeme_weaknesses: ${weaknesses.error.message}`,
      );
    }
    const skills = await client
      .from("student_lexeme_skill_states")
      .delete()
      .in("student_lexeme_model_id", modelIds);
    if (skills.error) {
      errors.push(
        `delete student_lexeme_skill_states: ${skills.error.message}`,
      );
    }
  }

  const evidence = await client
    .from("learning_evidence")
    .delete()
    .eq("user_id", safeUserId);
  if (evidence.error) {
    if (isAppendOnlyError(evidence.error)) {
      errors.push(
        "delete learning_evidence: table is append-only. Apply supabase/migrations_archive/pre_dedicated_baseline/202609170004_cleanup_progress_test_user.sql so cleanup_progress_test_user can remove the randomized test user.",
      );
    } else {
      errors.push(`delete learning_evidence: ${evidence.error.message}`);
    }
  }

  const leftoverModels = await client
    .from("student_lexeme_models")
    .delete()
    .eq("user_id", safeUserId);
  if (leftoverModels.error) {
    errors.push(
      `delete student_lexeme_models: ${leftoverModels.error.message}`,
    );
  }

  const tasks = await client
    .from("learning_tasks")
    .delete()
    .eq("user_id", safeUserId);
  if (tasks.error) {
    errors.push(`delete learning_tasks: ${tasks.error.message}`);
  }

  const sessions = await client
    .from("game_sessions")
    .delete()
    .eq("user_id", safeUserId);
  if (sessions.error) {
    errors.push(`delete game_sessions: ${sessions.error.message}`);
  }

  if (errors.length > 0) {
    throw new Error(`Progress test cleanup failed:\n${errors.join("\n")}`);
  }
}
