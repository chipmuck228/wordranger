"use server";

import { createMealMigrationDraft } from "@/server/contextual-content-release/create-migration-draft";
import { discardLocalReleaseDraft } from "@/server/contextual-content-release/discard-local-draft";
import { isContextualContentReleaseWriteEnabled } from "@/server/contextual-content-release/gates";
import { preflightContextualContentRelease } from "@/server/contextual-content-release/preflight-contextual-content-release";
import { projectReleaseWorkspace } from "@/server/contextual-content-release/project-release-workspace";
import type { ReleaseWorkspace } from "@/server/contextual-content-release/types";

export async function createMigrationDraftAction(): Promise<{
  ok: boolean;
  message?: string;
  code?: string;
  workspace?: ReleaseWorkspace;
}> {
  if (!isContextualContentReleaseWriteEnabled()) {
    return { ok: false, code: "RELEASE_WRITE_DISABLED", message: "Release writes are disabled." };
  }
  const result = await createMealMigrationDraft();
  const workspace = await projectReleaseWorkspace();
  if (!result.ok) {
    return { ok: false, code: result.code, message: result.message, workspace };
  }
  return { ok: true, workspace };
}

export async function preflightReleaseAction(input: {
  releaseId: string;
  revision: number;
}): Promise<{
  ok: boolean;
  message?: string;
  code?: string;
  workspace?: ReleaseWorkspace;
}> {
  if (!isContextualContentReleaseWriteEnabled()) {
    return { ok: false, code: "RELEASE_WRITE_DISABLED", message: "Release writes are disabled." };
  }
  if (
    !input ||
    typeof input.releaseId !== "string" ||
    !Number.isInteger(input.revision) ||
    input.revision < 0
  ) {
    return { ok: false, code: "RELEASE_INVALID", message: "Invalid preflight payload." };
  }
  const result = await preflightContextualContentRelease({
    releaseId: input.releaseId,
    revision: input.revision,
  });
  const workspace = await projectReleaseWorkspace();
  if (!result.ok) {
    return {
      ok: false,
      code: result.code,
      message: result.message,
      workspace: {
        ...workspace,
        preflight: { ok: false, issues: result.issues },
        draft: result.record ?? workspace.draft,
      },
    };
  }
  return { ok: true, workspace };
}

export async function discardLocalDraftAction(input: {
  releaseId: string;
  revision: number;
}): Promise<{
  ok: boolean;
  message?: string;
  code?: string;
  workspace?: ReleaseWorkspace;
}> {
  if (!isContextualContentReleaseWriteEnabled()) {
    return { ok: false, code: "RELEASE_WRITE_DISABLED", message: "Release writes are disabled." };
  }
  if (
    !input ||
    typeof input.releaseId !== "string" ||
    !Number.isInteger(input.revision) ||
    input.revision < 0
  ) {
    return { ok: false, code: "RELEASE_INVALID", message: "Invalid discard payload." };
  }
  const result = await discardLocalReleaseDraft({
    releaseId: input.releaseId,
    revision: input.revision,
  });
  const workspace = await projectReleaseWorkspace();
  if (!result.ok) {
    return { ok: false, code: result.code, message: result.message, workspace };
  }
  return { ok: true, workspace };
}
