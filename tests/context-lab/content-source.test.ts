import { describe, expect, it } from "vitest";
import { experimentalMealContextLabPack } from "@/contextual-learning/candidate-v0/content";
import { MEAL_RELEASE_SCENE_ID } from "@/contextual-learning/candidate-v0/release";
import {
  loadContextLabContent,
  resolveContextLabContentSourceMode,
} from "@/server/context-lab/context-lab-content-source";
import { CONTEXT_LAB_ERROR_CODES } from "@/components/context-lab/types";
import { createMealMigrationDraft } from "@/server/contextual-content-release/create-migration-draft";
import { InMemoryContextualContentReleaseRepository } from "@/server/contextual-content-release/in-memory-release-repository";
import { preflightContextualContentRelease } from "@/server/contextual-content-release/preflight-contextual-content-release";
import { publishContextualContentRelease } from "@/server/contextual-content-release/publish-contextual-content-release";
import { fileContentReviewRepository } from "@/server/contextual-content-review/file-content-review-repository";

const WRITE_ENV = {
  DEBUG_TOOLS_ENABLED: "1",
  CONTEXTUAL_CONTENT_RELEASE_ENABLED: "1",
  CONTEXTUAL_CONTENT_RELEASE_WRITE_ENABLED: "1",
  CONTEXTUAL_RELEASE_RUNTIME: "memory",
};

describe("Context Lab content source", () => {
  it("defaults unset CONTEXT_LAB_CONTENT_SOURCE to static", () => {
    expect(resolveContextLabContentSourceMode({})).toBe("static");
    expect(resolveContextLabContentSourceMode({ CONTEXT_LAB_CONTENT_SOURCE: "static" })).toBe(
      "static",
    );
    expect(
      resolveContextLabContentSourceMode({ CONTEXT_LAB_CONTENT_SOURCE: "active-release" }),
    ).toBe("active-release");
    expect(() =>
      resolveContextLabContentSourceMode({ CONTEXT_LAB_CONTENT_SOURCE: "latest" }),
    ).toThrow(/static or active-release/);
  });

  it("keeps static mode on the current six-word pack and ignores the pointer", async () => {
    const loaded = await loadContextLabContent({
      env: { CONTEXT_LAB_CONTENT_SOURCE: "static" },
    });
    expect(loaded.source).toBe("static");
    expect(loaded.pack.id).toBe(experimentalMealContextLabPack().id);
    expect(loaded.pack.lexemes).toHaveLength(6);
  });

  it("fail-closes active-release mode when there is no pointer", async () => {
    const repository = new InMemoryContextualContentReleaseRepository();
    await expect(
      loadContextLabContent({
        env: { ...WRITE_ENV, CONTEXT_LAB_CONTENT_SOURCE: "active-release" },
        repository,
      }),
    ).rejects.toMatchObject({
      code: CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_CONTENT_UNAVAILABLE,
    });
  });

  it("loads the active published release in active-release mode", async () => {
    const repository = new InMemoryContextualContentReleaseRepository();
    const created = await createMealMigrationDraft({
      env: WRITE_ENV,
      repository,
      reviewRepository: fileContentReviewRepository,
      now: "2026-09-22T00:00:00.000Z",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      throw new Error(created.message);
    }
    const preflight = await preflightContextualContentRelease({
      env: WRITE_ENV,
      repository,
      releaseId: created.record.releaseId,
      revision: created.record.revision,
    });
    expect(preflight.ok).toBe(true);
    if (!preflight.ok) {
      throw new Error(preflight.message);
    }
    const published = await publishContextualContentRelease({
      env: WRITE_ENV,
      repository,
      releaseId: preflight.record.releaseId,
      revision: preflight.record.revision,
    });
    expect(published.ok).toBe(true);
    if (!published.ok) {
      throw new Error(published.message);
    }
    const loaded = await loadContextLabContent({
      env: { ...WRITE_ENV, CONTEXT_LAB_CONTENT_SOURCE: "active-release" },
      repository,
    });
    expect(loaded.source).toBe("active-release");
    expect(loaded.releaseId).toBe(published.record.releaseId);
    expect(loaded.releaseFingerprint).toBe(published.record.releaseFingerprint);
    expect(loaded.pack.lexemes).toHaveLength(6);
    expect(loaded.pack).toEqual(published.record.packSnapshot);
    expect(MEAL_RELEASE_SCENE_ID).toBe(published.record.sceneId);
  });

  it("fail-closes a damaged pointer in active-release mode", async () => {
    const repository = new InMemoryContextualContentReleaseRepository();
    repository.replacePointerRaw({
      schemaVersion: "candidate-v0",
      kind: "CANDIDATE_V0_ACTIVE_RELEASE_POINTER",
      sceneId: MEAL_RELEASE_SCENE_ID,
      releaseId: "missing-release",
      releaseFingerprint: "0".repeat(64),
      revision: 0,
      activatedAt: "2026-09-22T00:00:00.000Z",
      activatedBy: "LOCAL_INTERNAL_RELEASER",
    });
    await expect(
      loadContextLabContent({
        env: { ...WRITE_ENV, CONTEXT_LAB_CONTENT_SOURCE: "active-release" },
        repository,
      }),
    ).rejects.toMatchObject({
      code: CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_CONTENT_UNAVAILABLE,
    });
  });
});
