import "server-only";

import { MEAL_MIGRATION_RELEASE_ID, validateMealReleaseCapabilities } from "@/contextual-learning/candidate-v0/release";
import { isContextualContentReleaseWriteEnabled } from "./gates";
import {
  buildMealMigrationAuthority,
  manifestFromAuthority,
  uniquePackTargets,
  type ReleaseAssemblyOptions,
} from "./authority";
import type { ContextualContentReleaseRepository } from "./release-repository";
import { createContextualReleaseRepository } from "./create-release-runtime";
import type { ReleaseSaveResult } from "./types";
import { RELEASE_ACTOR_ID } from "./types";
import { draftCreationBlocked, inspectMealReleaseEligibility } from "./inspect-release-eligibility";

export async function createMealMigrationDraft(
  input: ReleaseAssemblyOptions & {
    env?: Record<string, string | undefined>;
    now?: string;
    repository?: ContextualContentReleaseRepository;
  } = {},
): Promise<ReleaseSaveResult> {
  if (!isContextualContentReleaseWriteEnabled(input.env)) {
    return {
      ok: false,
      code: "RELEASE_WRITE_DISABLED",
      message: "Release writes are disabled.",
    };
  }
  const eligibility = await inspectMealReleaseEligibility(input);
  const authority = await buildMealMigrationAuthority(input);
  const uniqueTargets = uniquePackTargets(authority.snapshot.pack);
  const capabilities = validateMealReleaseCapabilities({
    targets: uniqueTargets,
    capabilities: input.capabilities,
  });
  const issues = [...eligibility.issues, ...authority.issues, ...capabilities.issues];
  if (
    draftCreationBlocked(issues) ||
    uniqueTargets.length < 1 ||
    authority.targetEntries.length !== uniqueTargets.length ||
    authority.historicalApprovalBindings.length !== authority.targetEntries.length ||
    !capabilities.ok ||
    (!input.pack && !eligibility.eligibilityOk)
  ) {
    return {
      ok: false,
      code: "RELEASE_INVALID",
      message:
        issues[0]?.detail ??
        "Migration draft requires every pack target to have a unique valid approval chain.",
    };
  }
  const repository = input.repository ?? createContextualReleaseRepository(input.env);
  const releaseId = await nextMealReleaseId(repository);
  const record = manifestFromAuthority({
    authority,
    createdAt: input.now ?? new Date().toISOString(),
    createdBy: RELEASE_ACTOR_ID,
    releaseId,
  });
  return repository.create({ record });
}

async function nextMealReleaseId(
  repository: ContextualContentReleaseRepository,
): Promise<string> {
  const listed = await repository.list();
  if (!listed.some((item) => item.releaseId === MEAL_MIGRATION_RELEASE_ID)) {
    return MEAL_MIGRATION_RELEASE_ID;
  }
  const open = listed.find(
    (item) =>
      item.releaseId === MEAL_MIGRATION_RELEASE_ID &&
      (item.status === "DRAFT" || item.status === "PREFLIGHT_VALIDATED"),
  );
  if (open) {
    return MEAL_MIGRATION_RELEASE_ID;
  }
  let index = 2;
  while (listed.some((item) => item.releaseId === `meal-release-migration-v${index}`)) {
    index += 1;
  }
  return `meal-release-migration-v${index}`;
}
