import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { FileContextualContentBatchPromotionRepository } from "./file-promotion-repository";
import { InMemoryContextualContentBatchPromotionRepository } from "./in-memory-promotion-repository";
import { contextualPromotionRoot } from "./promotion-artifact-path";
import type { ContextualContentBatchPromotionRepository } from "./promotion-repository";
import {
  ContextualPromotionRuntimeError,
  resolveContextualPromotionRuntimeMode,
} from "./runtime-mode";
import { SupabaseContextualContentBatchPromotionRepository } from "./supabase-promotion-repository";

let memoryRepository: InMemoryContextualContentBatchPromotionRepository | null = null;

export function createContextualPromotionRepository(
  env: Record<string, string | undefined> = process.env,
): ContextualContentBatchPromotionRepository {
  const mode = resolveContextualPromotionRuntimeMode(env);
  if (mode === "memory") {
    memoryRepository ??= new InMemoryContextualContentBatchPromotionRepository();
    return memoryRepository;
  }
  if (mode === "file") {
    return new FileContextualContentBatchPromotionRepository();
  }
  if (mode === "supabase") {
    const client = createSupabaseServiceRoleClient(env);
    if (!client) {
      throw new ContextualPromotionRuntimeError(
        "PROMOTION_RUNTIME_INVALID",
        "CONTEXTUAL_PROMOTION_RUNTIME=supabase requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Promotion does not fall back to file or memory.",
      );
    }
    return new SupabaseContextualContentBatchPromotionRepository(client);
  }
  throw new ContextualPromotionRuntimeError(
    "PROMOTION_RUNTIME_INVALID",
    "CONTEXTUAL_PROMOTION_RUNTIME must be set to memory, file, or supabase.",
  );
}

export function promotionFileArtifactRoot(): string {
  return contextualPromotionRoot();
}

export function resetMemoryContextualPromotionRepositoryForTests(): void {
  memoryRepository?.reset();
  memoryRepository = null;
}
