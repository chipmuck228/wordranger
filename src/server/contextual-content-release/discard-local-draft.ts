import "server-only";

import { MEAL_MIGRATION_RELEASE_ID } from "@/contextual-learning/candidate-v0/release";
import { createContextualReleaseRepository } from "./create-release-runtime";
import { isContextualContentReleaseWriteEnabled } from "./gates";
import type { ContextualContentReleaseRepository } from "./release-repository";
import type { ReleaseSaveResult } from "./types";

export async function discardLocalReleaseDraft(input: {
  releaseId: string;
  revision: number;
  env?: Record<string, string | undefined>;
  repository?: ContextualContentReleaseRepository;
}): Promise<ReleaseSaveResult> {
  if (!isContextualContentReleaseWriteEnabled(input.env)) {
    return { ok: false, code: "RELEASE_WRITE_DISABLED", message: "Release writes are disabled." };
  }
  if (
    input.releaseId !== MEAL_MIGRATION_RELEASE_ID ||
    !Number.isInteger(input.revision) ||
    input.revision < 0
  ) {
    return { ok: false, code: "RELEASE_INVALID", message: "Discard accepts only releaseId and revision." };
  }
  const repository = input.repository ?? createContextualReleaseRepository(input.env);
  return repository.discard({
    releaseId: input.releaseId,
    expectedRevision: input.revision,
  });
}
