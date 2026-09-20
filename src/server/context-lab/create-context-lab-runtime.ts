import "server-only";

import { CONTEXT_LAB_ERROR_CODES } from "@/components/context-lab/types";
import { V1_PLACEHOLDER_USER_ID } from "@/server/auth/v1-user";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { ContextLabError } from "./context-lab-errors";
import { resolveContextLabRuntimeMode } from "./context-lab-runtime-mode";
import { InMemoryContextLabRunRepository } from "./in-memory-context-lab-run-repository";
import { isContextLabEnabled } from "./is-context-lab-enabled";
import { MealContextLabController } from "./meal-context-lab-controller";
import { SupabaseContextLabRunRepository } from "./supabase-context-lab-run-repository";
import type { ContextLabRunRepository } from "./context-lab-run.types";

let memoryRepository: InMemoryContextLabRunRepository | null = null;

export interface ContextLabRuntime {
  mode: "memory" | "supabase";
  userId: string;
  repository: ContextLabRunRepository;
  createController(): MealContextLabController;
}

/**
 * Context Lab composition root.
 *
 * Memory is an explicit local/e2e fixture and may keep one in-process
 * repository so successive Server Actions share runs. Production/preview
 * must select supabase and never fall back to this Map.
 */
export function createContextLabRuntime(
  env: Record<string, string | undefined> = process.env,
  options: {
    repository?: ContextLabRunRepository;
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
  const repository =
    options.repository ?? createRepository(mode, userId);
  return {
    mode,
    userId,
    repository,
    createController() {
      return new MealContextLabController({
        repository,
        userId,
        enabled: true,
        now: options.now,
        createId: options.createId,
      });
    },
  };
}

export function resetMemoryContextLabRepositoryForTests(): void {
  memoryRepository?.reset();
  memoryRepository = null;
}

function createRepository(
  mode: "memory" | "supabase",
  userId: string,
): ContextLabRunRepository {
  if (mode === "memory") {
    memoryRepository ??= new InMemoryContextLabRunRepository();
    return memoryRepository;
  }
  const client = createSupabaseServiceRoleClient();
  if (!client) {
    throw new ContextLabError(
      CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_RUNTIME_INVALID,
      "CONTEXT_LAB_RUNTIME=supabase requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Context Lab does not fall back to memory or the anon key.",
      false,
    );
  }
  return new SupabaseContextLabRunRepository(client, userId);
}
