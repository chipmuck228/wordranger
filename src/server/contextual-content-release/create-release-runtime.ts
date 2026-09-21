import "server-only";

import { FileContextualContentReleaseRepository } from "./file-release-repository";
import { InMemoryContextualContentReleaseRepository } from "./in-memory-release-repository";
import type { ContextualContentReleaseRepository } from "./release-repository";
import { resolveContextualReleaseRuntimeMode } from "./runtime-mode";

let memoryRepository: InMemoryContextualContentReleaseRepository | null = null;

export function createContextualReleaseRepository(
  env: Record<string, string | undefined> = process.env,
): ContextualContentReleaseRepository {
  const mode = resolveContextualReleaseRuntimeMode(env);
  if (mode === "memory") {
    memoryRepository ??= new InMemoryContextualContentReleaseRepository();
    return memoryRepository;
  }
  return new FileContextualContentReleaseRepository();
}

export function resetMemoryContextualReleaseRepositoryForTests(): void {
  memoryRepository?.reset();
  memoryRepository = null;
}
