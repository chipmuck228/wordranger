import "server-only";

import { CONTEXT_LAB_ERROR_CODES } from "@/components/context-lab/types";
import type { LearningRepository } from "@/domain/learning/learning-repository";
import type { LearningTaskRepository } from "@/domain/tasks/learning-task-repository";
import { V1_PLACEHOLDER_USER_ID } from "@/server/auth/v1-user";
import { InMemoryLearningRepository } from "@/server/learning/in-memory-learning-repository";
import { SupabaseLearningRepository } from "@/server/learning/supabase-learning-repository";
import { InMemoryLearningTaskRepository } from "@/server/tasks/in-memory-learning-task-repository";
import { SupabaseLearningTaskRepository } from "@/server/tasks/supabase-learning-task-repository";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { ContextLabError } from "./context-lab-errors";
import { resolveContextLabRuntimeMode } from "./context-lab-runtime-mode";
import { InMemoryContextLabRunRepository } from "./in-memory-context-lab-run-repository";
import { isContextLabEnabled } from "./is-context-lab-enabled";
import { MealContextLabController } from "./meal-context-lab-controller";
import { SupabaseContextLabRunRepository } from "./supabase-context-lab-run-repository";
import type { ContextLabRunRepository } from "./context-lab-run.types";

const MEMORY_STORE_KEY = Symbol.for("wordranger.context-lab.memory-stores");

interface MemoryContextLabStores {
  runs: InMemoryContextLabRunRepository;
  learningTasks: InMemoryLearningTaskRepository;
  learning: InMemoryLearningRepository;
}

export interface ContextLabRuntime {
  mode: "memory" | "supabase";
  userId: string;
  contextRuns: ContextLabRunRepository;
  learningTasks: LearningTaskRepository;
  learning: LearningRepository;
  createController(): MealContextLabController;
}

/**
 * Context Lab composition root.
 *
 * Memory is an explicit local/e2e fixture and may keep one in-process
 * trio so successive Server Actions share runs, tasks, and Evidence.
 * Production/preview must select supabase and never fall back to this Map.
 */
export function createContextLabRuntime(
  env: Record<string, string | undefined> = process.env,
  options: {
    repository?: ContextLabRunRepository;
    learningTasks?: LearningTaskRepository;
    learning?: LearningRepository;
    userId?: string;
    now?: () => string;
    createId?: () => string;
  } = {},
): ContextLabRuntime {
  if (!isContextLabEnabled(env)) {
    throw new ContextLabError(
      CONTEXT_LAB_ERROR_CODES.FEATURE_DISABLED,
      "Context Lab is disabled",
      false,
    );
  }
  const mode = resolveContextLabRuntimeMode(env);
  const userId = options.userId ?? V1_PLACEHOLDER_USER_ID;
  const deps = options.repository || options.learningTasks || options.learning
    ? createIsolatedDependencies(options)
    : createSharedDependencies(mode, userId);
  return {
    mode,
    userId,
    contextRuns: deps.contextRuns,
    learningTasks: deps.learningTasks,
    learning: deps.learning,
    createController() {
      return new MealContextLabController({
        repository: deps.contextRuns,
        learningTasks: deps.learningTasks,
        learning: deps.learning,
        userId,
        enabled: true,
        now: options.now,
        createId: options.createId,
      });
    },
  };
}

export function resetMemoryContextLabRepositoryForTests(): void {
  const stores = peekMemoryStores();
  stores?.runs.reset();
  stores?.learningTasks.reset();
  stores?.learning.reset();
}

export function getMemoryContextLabStoresForTests(): MemoryContextLabStores | null {
  return peekMemoryStores();
}

function peekMemoryStores(): MemoryContextLabStores | null {
  const holder = globalThis as Record<symbol, MemoryContextLabStores | undefined>;
  return holder[MEMORY_STORE_KEY] ?? null;
}

function sharedMemoryStores(): MemoryContextLabStores {
  const holder = globalThis as Record<symbol, MemoryContextLabStores | undefined>;
  holder[MEMORY_STORE_KEY] ??= {
    runs: new InMemoryContextLabRunRepository(),
    learningTasks: new InMemoryLearningTaskRepository(),
    learning: new InMemoryLearningRepository(),
  };
  return holder[MEMORY_STORE_KEY];
}

function createSharedDependencies(
  mode: "memory" | "supabase",
  userId: string,
): {
  contextRuns: ContextLabRunRepository;
  learningTasks: LearningTaskRepository;
  learning: LearningRepository;
} {
  if (mode === "memory") {
    const stores = sharedMemoryStores();
    return {
      contextRuns: stores.runs,
      learningTasks: stores.learningTasks,
      learning: stores.learning,
    };
  }
  return createSupabaseDependencies(userId);
}

function createIsolatedDependencies(
  options: {
    repository?: ContextLabRunRepository;
    learningTasks?: LearningTaskRepository;
    learning?: LearningRepository;
  },
): {
  contextRuns: ContextLabRunRepository;
  learningTasks: LearningTaskRepository;
  learning: LearningRepository;
} {
  return {
    contextRuns: options.repository ?? new InMemoryContextLabRunRepository(),
    learningTasks: options.learningTasks ?? new InMemoryLearningTaskRepository(),
    learning: options.learning ?? new InMemoryLearningRepository(),
  };
}

function createSupabaseDependencies(userId: string): {
  contextRuns: ContextLabRunRepository;
  learningTasks: LearningTaskRepository;
  learning: LearningRepository;
} {
  const client = createSupabaseServiceRoleClient();
  if (!client) {
    throw new ContextLabError(
      CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_RUNTIME_INVALID,
      "CONTEXT_LAB_RUNTIME=supabase requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Context Lab does not fall back to memory or the anon key.",
      false,
    );
  }
  return {
    contextRuns: new SupabaseContextLabRunRepository(client, userId),
    learningTasks: new SupabaseLearningTaskRepository(client),
    learning: new SupabaseLearningRepository(client),
  };
}
