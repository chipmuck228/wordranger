import { describe, expect, it } from "vitest";
import { cloneFrozen } from "@/contextual-learning/candidate-v0/content/immutable";
import { MEAL_RELEASE_SCENE_ID } from "@/contextual-learning/candidate-v0/release";
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

async function validatedRelease(
  repository = new InMemoryContextualContentReleaseRepository(),
) {
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
    reviewRepository: fileContentReviewRepository,
    releaseId: created.record.releaseId,
    revision: created.record.revision,
    now: "2026-09-22T00:00:01.000Z",
  });
  expect(preflight.ok).toBe(true);
  if (!preflight.ok) {
    throw new Error(preflight.message);
  }
  return { repository, record: preflight.record };
}

describe("fingerprint-bound publish", () => {
  it("publishes a PREFLIGHT_VALIDATED release and makes it active", async () => {
    const { repository, record } = await validatedRelease();
    const published = await publishContextualContentRelease({
      env: WRITE_ENV,
      repository,
      reviewRepository: fileContentReviewRepository,
      releaseId: record.releaseId,
      revision: record.revision,
      now: "2026-09-22T00:00:02.000Z",
    });
    expect(published.ok).toBe(true);
    if (!published.ok) {
      throw new Error(published.message);
    }
    expect(published.record.status).toBe("PUBLISHED");
    expect(published.record.publishedAt).toBe("2026-09-22T00:00:02.000Z");
    expect(published.pointer.releaseId).toBe(record.releaseId);
    expect(published.pointer.releaseFingerprint).toBe(record.releaseFingerprint);
    const loaded = await repository.loadActiveRelease(MEAL_RELEASE_SCENE_ID);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) {
      throw new Error(loaded.message);
    }
    expect(loaded.release.status).toBe("PUBLISHED");
  });

  it("rejects DRAFT publish", async () => {
    const repository = new InMemoryContextualContentReleaseRepository();
    const created = await createMealMigrationDraft({
      env: WRITE_ENV,
      repository,
      now: "2026-09-22T00:00:00.000Z",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      throw new Error(created.message);
    }
    const published = await publishContextualContentRelease({
      env: WRITE_ENV,
      repository,
      releaseId: created.record.releaseId,
      revision: created.record.revision,
    });
    expect(published.ok).toBe(false);
    if (published.ok) {
      throw new Error("published");
    }
    expect(published.code).toBe("RELEASE_INVALID");
    expect(await repository.getActivePointer(MEAL_RELEASE_SCENE_ID)).toBeNull();
  });

  it("rejects a stale release revision", async () => {
    const { repository, record } = await validatedRelease();
    const published = await publishContextualContentRelease({
      env: WRITE_ENV,
      repository,
      releaseId: record.releaseId,
      revision: record.revision + 3,
    });
    expect(published).toMatchObject({ ok: false, code: "RELEASE_CONFLICT" });
  });

  it("lets only one concurrent same-release publish transition status", async () => {
    const { repository, record } = await validatedRelease();
    const [a, b] = await Promise.all([
      publishContextualContentRelease({
        env: WRITE_ENV,
        repository,
        releaseId: record.releaseId,
        revision: record.revision,
        now: "2026-09-22T00:00:02.000Z",
      }),
      publishContextualContentRelease({
        env: WRITE_ENV,
        repository,
        releaseId: record.releaseId,
        revision: record.revision,
        now: "2026-09-22T00:00:03.000Z",
      }),
    ]);
    const results = [a, b];
    const succeeded = results.filter((item) => item.ok);
    const conflicts = results.filter((item) => !item.ok && item.code === "RELEASE_CONFLICT");
    expect(succeeded.length + conflicts.length).toBe(2);
    expect(succeeded.length).toBeGreaterThanOrEqual(1);
    const stored = await repository.get(record.releaseId);
    expect(stored?.status).toBe("PUBLISHED");
    const pointer = await repository.getActivePointer(MEAL_RELEASE_SCENE_ID);
    expect(pointer?.releaseId).toBe(record.releaseId);
  });

  it("retries a successful publish idempotently", async () => {
    const { repository, record } = await validatedRelease();
    const first = await publishContextualContentRelease({
      env: WRITE_ENV,
      repository,
      releaseId: record.releaseId,
      revision: record.revision,
      now: "2026-09-22T00:00:02.000Z",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) {
      throw new Error(first.message);
    }
    const retry = await publishContextualContentRelease({
      env: WRITE_ENV,
      repository,
      releaseId: record.releaseId,
      revision: record.revision,
    });
    expect(retry.ok).toBe(true);
    if (!retry.ok) {
      throw new Error(retry.message);
    }
    expect(retry.idempotent).toBe(true);
    expect(retry.record.publishedAt).toBe(first.record.publishedAt);
  });

  it("does not lose pointer updates when two releases publish the same scene", async () => {
    const shared = new InMemoryContextualContentReleaseRepository();
    const first = await validatedRelease(shared);
    const publishedA = await publishContextualContentRelease({
      env: WRITE_ENV,
      repository: shared,
      releaseId: first.record.releaseId,
      revision: first.record.revision,
      now: "2026-09-22T00:00:02.000Z",
    });
    expect(publishedA.ok).toBe(true);
    const second = await validatedRelease(shared);
    const publishedB = await publishContextualContentRelease({
      env: WRITE_ENV,
      repository: shared,
      releaseId: second.record.releaseId,
      revision: second.record.revision,
      now: "2026-09-22T00:00:03.000Z",
    });
    expect(publishedB.ok).toBe(true);
    if (!publishedA.ok || !publishedB.ok) {
      throw new Error("publish failed");
    }
    const pointer = await shared.getActivePointer(MEAL_RELEASE_SCENE_ID);
    expect(pointer?.releaseId).toBe(second.record.releaseId);
    const previous = await shared.get(first.record.releaseId);
    expect(previous?.status).toBe("SUPERSEDED");
    expect(previous?.packSnapshot).toEqual(first.record.packSnapshot);
    expect(previous?.supersededByReleaseId).toBe(second.record.releaseId);
  });

  it("does not leave a half-published state when publish aborts before pointer commit", async () => {
    const { repository, record } = await validatedRelease();
    repository.failNextPublishAfterStatus();
    const published = await publishContextualContentRelease({
      env: WRITE_ENV,
      repository,
      releaseId: record.releaseId,
      revision: record.revision,
      now: "2026-09-22T00:00:02.000Z",
    });
    expect(published.ok).toBe(false);
    expect((await repository.get(record.releaseId))?.status).toBe("PREFLIGHT_VALIDATED");
    expect(await repository.getActivePointer(MEAL_RELEASE_SCENE_ID)).toBeNull();
  });

  it("fails closed when the pointer fingerprint does not match the release", async () => {
    const { repository, record } = await validatedRelease();
    await publishContextualContentRelease({
      env: WRITE_ENV,
      repository,
      releaseId: record.releaseId,
      revision: record.revision,
      now: "2026-09-22T00:00:02.000Z",
    });
    const pointer = await repository.getActivePointer(MEAL_RELEASE_SCENE_ID);
    expect(pointer).not.toBeNull();
    repository.replacePointerRaw({
      ...pointer!,
      releaseFingerprint: "0".repeat(64),
    });
    const loaded = await repository.loadActiveRelease(MEAL_RELEASE_SCENE_ID);
    expect(loaded.ok).toBe(false);
    if (loaded.ok) {
      throw new Error("loaded");
    }
    expect(loaded.code).toBe("RELEASE_POINTER_MISMATCH");
  });

  it("refuses a pointer that targets a non-PUBLISHED release", async () => {
    const { repository, record } = await validatedRelease();
    repository.replacePointerRaw({
      schemaVersion: "candidate-v0",
      kind: "CANDIDATE_V0_ACTIVE_RELEASE_POINTER",
      sceneId: MEAL_RELEASE_SCENE_ID,
      releaseId: record.releaseId,
      releaseFingerprint: record.releaseFingerprint,
      revision: 0,
      activatedAt: "2026-09-22T00:00:02.000Z",
      activatedBy: "LOCAL_INTERNAL_RELEASER",
    });
    const loaded = await repository.loadActiveRelease(MEAL_RELEASE_SCENE_ID);
    expect(loaded.ok).toBe(false);
  });

  it("keeps A immutable after B becomes active", async () => {
    const shared = new InMemoryContextualContentReleaseRepository();
    const first = await validatedRelease(shared);
    const publishedA = await publishContextualContentRelease({
      env: WRITE_ENV,
      repository: shared,
      releaseId: first.record.releaseId,
      revision: first.record.revision,
      now: "2026-09-22T00:00:02.000Z",
    });
    expect(publishedA.ok).toBe(true);
    if (!publishedA.ok) {
      throw new Error(publishedA.message);
    }
    const snapshot = cloneFrozen(publishedA.record.packSnapshot);
    const second = await validatedRelease(shared);
    await publishContextualContentRelease({
      env: WRITE_ENV,
      repository: shared,
      releaseId: second.record.releaseId,
      revision: second.record.revision,
      now: "2026-09-22T00:00:03.000Z",
    });
    const storedA = await shared.get(first.record.releaseId);
    expect(storedA?.packSnapshot).toEqual(snapshot);
    expect(storedA?.targetEntries).toEqual(publishedA.record.targetEntries);
    expect(storedA?.releaseFingerprint).toBe(publishedA.record.releaseFingerprint);
    expect((await shared.list()).map((item) => item.releaseId)).toContain(first.record.releaseId);
  });
});
