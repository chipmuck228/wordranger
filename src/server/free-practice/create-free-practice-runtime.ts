import "server-only";

import { DefaultTaskGenerator } from "@/domain/tasks/default-task-generator";
import { InMemoryLearningRepository } from "@/server/learning/in-memory-learning-repository";
import { createTestFreePracticeSessionReader } from "@/server/free-practice/identity/test-session-reader";
import { readFreePracticeSupabaseSession } from "@/server/free-practice/identity/supabase-session-reader";
import { isFreePracticeTestIdentityAllowed } from "@/server/free-practice/identity/runtime";
import type { ReadFreePracticeSession } from "@/server/free-practice/identity/types";
import { createFreePracticeMemoryVocabulary } from "@/server/free-practice/memory-vocabulary";
import { LearningBackedFreePracticePlanReadAdapter } from "@/server/free-practice/planning/learning-backed-plan-read-adapter";
import { SupabaseFreePracticePlanReadAdapter } from "@/server/free-practice/planning/supabase-plan-read-adapter";
import { FreePracticeSessionController } from "@/server/free-practice/session/controller";
import { InMemoryFreePracticeSessionStore } from "@/server/free-practice/session/in-memory-store";
import { SupabaseFreePracticeSessionStore } from "@/server/free-practice/session/supabase-store";
import { resolveFreePracticeRuntime } from "@/server/free-practice/runtime-policy";
import { SupabaseLearningRepository } from "@/server/learning/supabase-learning-repository";
import { bundledVocabularyRepository } from "@/server/runtime/bundled-vocabulary";
import { InMemoryLearningTaskRepository } from "@/server/tasks/in-memory-learning-task-repository";
import { SupabaseLearningTaskRepository } from "@/server/tasks/supabase-learning-task-repository";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const FREE_PRACTICE_MEMORY_TEST_USER_ID =
  "11111111-1111-4111-8111-111111111111";

export interface FreePracticeRuntime {
  createController(): FreePracticeSessionController;
}

export interface InMemoryFreePracticeRuntime extends FreePracticeRuntime {
  learning: InMemoryLearningRepository;
  tasks: InMemoryLearningTaskRepository;
  sessions: InMemoryFreePracticeSessionStore;
  userId: string;
}

const memoryRuntimeKey = "__wordrangerFreePracticeMemoryRuntime";

type FreePracticeGlobal = typeof globalThis & {
  [memoryRuntimeKey]?: InMemoryFreePracticeRuntime;
};

function memoryRuntimeSlot(): FreePracticeGlobal {
  return globalThis as FreePracticeGlobal;
}

function createIdentityReader(
  env: Record<string, string | undefined>,
): ReadFreePracticeSession {
  if (isFreePracticeTestIdentityAllowed(env)) {
    return createTestFreePracticeSessionReader({
      env,
      userId: FREE_PRACTICE_MEMORY_TEST_USER_ID,
      isAnonymous: true,
    });
  }
  return () => readFreePracticeSupabaseSession({ env });
}

function createMemoryRuntime(
  env: Record<string, string | undefined>,
): InMemoryFreePracticeRuntime {
  const vocabulary = createFreePracticeMemoryVocabulary();
  const learning = new InMemoryLearningRepository();
  const tasks = new InMemoryLearningTaskRepository();
  const sessions = new InMemoryFreePracticeSessionStore();
  const read = new LearningBackedFreePracticePlanReadAdapter(learning);
  const generator = new DefaultTaskGenerator(vocabulary);
  const readSession = createIdentityReader(env);
  const userId = FREE_PRACTICE_MEMORY_TEST_USER_ID;

  function createController(): FreePracticeSessionController {
    return new FreePracticeSessionController({
      vocabulary,
      read,
      tasks,
      sessions,
      learning,
      readSession,
      env,
      generator,
      createSessionId: () => crypto.randomUUID(),
      createId: () => crypto.randomUUID(),
      createEvidenceId: () => crypto.randomUUID(),
    });
  }

  return {
    learning,
    tasks,
    sessions,
    userId,
    createController,
  };
}

function createSupabaseRuntime(
  env: Record<string, string | undefined>,
): FreePracticeRuntime {
  const client = createSupabaseServerClient();
  if (!client) {
    throw new Error("Free Practice supabase runtime is not configured");
  }
  const vocabulary = bundledVocabularyRepository();
  const learning = new SupabaseLearningRepository(client);
  const tasks = new SupabaseLearningTaskRepository(client);
  const sessions = new SupabaseFreePracticeSessionStore(client);
  const read = new SupabaseFreePracticePlanReadAdapter(client);
  const generator = new DefaultTaskGenerator(vocabulary);
  const readSession = createIdentityReader(env);

  return {
    createController() {
      return new FreePracticeSessionController({
        vocabulary,
        read,
        tasks,
        sessions,
        learning,
        readSession,
        env,
        generator,
        createSessionId: () => crypto.randomUUID(),
        createId: () => crypto.randomUUID(),
        createEvidenceId: () => crypto.randomUUID(),
      });
    },
  };
}

export function createFreePracticeRuntime(
  env: Record<string, string | undefined> = process.env,
): FreePracticeRuntime {
  const decision = resolveFreePracticeRuntime(env);
  if (decision.status !== "READY") {
    throw new Error("Free Practice runtime is unavailable");
  }
  if (decision.mode === "memory") {
    const slot = memoryRuntimeSlot();
    slot[memoryRuntimeKey] ??= createMemoryRuntime(env);
    return slot[memoryRuntimeKey];
  }
  return createSupabaseRuntime(env);
}

export function getFreePracticeController(
  env: Record<string, string | undefined> = process.env,
): FreePracticeSessionController | null {
  try {
    return createFreePracticeRuntime(env).createController();
  } catch {
    return null;
  }
}

export function getMemoryFreePracticeRuntimeForTests(
  env: Record<string, string | undefined> = process.env,
): InMemoryFreePracticeRuntime | null {
  const decision = resolveFreePracticeRuntime(env);
  if (decision.status !== "READY" || decision.mode !== "memory") {
    return null;
  }
  const slot = memoryRuntimeSlot();
  slot[memoryRuntimeKey] ??= createMemoryRuntime(env);
  return slot[memoryRuntimeKey];
}

export function resetMemoryFreePracticeRuntimeForTests(): void {
  const runtime = memoryRuntimeSlot()[memoryRuntimeKey];
  if (runtime) {
    runtime.learning.reset();
    runtime.tasks.reset();
    runtime.sessions.reset();
  }
}

export function clearMemoryFreePracticeRuntimeForTests(): void {
  resetMemoryFreePracticeRuntimeForTests();
  delete memoryRuntimeSlot()[memoryRuntimeKey];
}
