import "server-only";

import { FileContextualContentBatchPromotionRepository } from "./file-promotion-repository";
import { InMemoryContextualContentBatchPromotionRepository } from "./in-memory-promotion-repository";
import type { ContextualContentBatchPromotionRepository } from "./promotion-repository";

let memoryRepository: InMemoryContextualContentBatchPromotionRepository | null = null;

export function createContextualPromotionRepository(
  env: Record<string, string | undefined> = process.env,
): ContextualContentBatchPromotionRepository {
  if (env.CONTEXTUAL_PROMOTION_RUNTIME === "memory") {
    memoryRepository ??= new InMemoryContextualContentBatchPromotionRepository();
    return memoryRepository;
  }
  return new FileContextualContentBatchPromotionRepository();
}

export function resetMemoryContextualPromotionRepositoryForTests(): void {
  memoryRepository?.reset();
  memoryRepository = null;
}
