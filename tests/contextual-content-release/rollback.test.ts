import { describe, expect, it } from "vitest";
import {
  experimentalMealContextLabPack,
  MEAL_SCENE_EXPANSION_BATCH_01_PACK,
} from "@/contextual-learning/candidate-v0/content";
import {
  fingerprintsForManifest,
  MEAL_RELEASE_SCENE_ID,
} from "@/contextual-learning/candidate-v0/release";
import { buildMealMigrationAuthority, manifestFromAuthority } from "@/server/contextual-content-release/authority";
import { createMealMigrationDraft } from "@/server/contextual-content-release/create-migration-draft";
import {
  evaluateHistoricalReleaseIntegrity,
  evaluatePublishReadiness,
} from "@/server/contextual-content-release/evaluate-release-readiness";
import { InMemoryContextualContentReleaseRepository } from "@/server/contextual-content-release/in-memory-release-repository";
import { preflightContextualContentRelease } from "@/server/contextual-content-release/preflight-contextual-content-release";
import { publishContextualContentRelease } from "@/server/contextual-content-release/publish-contextual-content-release";
import { rollbackContextualContentActiveRelease } from "@/server/contextual-content-release/rollback-contextual-content-active-release";
import { fileContentReviewRepository } from "@/server/contextual-content-review/file-content-review-repository";
import type { ContextualSceneContentPack } from "@/contextual-learning/candidate-v0/content/types";

const WRITE_ENV = {
  DEBUG_TOOLS_ENABLED: "1",
  CONTEXTUAL_CONTENT_RELEASE_ENABLED: "1",
  CONTEXTUAL_CONTENT_RELEASE_WRITE_ENABLED: "1",
  CONTEXTUAL_RELEASE_RUNTIME: "memory",
};

async function publishNew(repository: InMemoryContextualContentReleaseRepository, now: string) {
  const created = await createMealMigrationDraft({
    env: WRITE_ENV,
    repository,
    reviewRepository: fileContentReviewRepository,
    now,
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
    now: `${now.slice(0, 19)}.001Z`,
  });
  expect(preflight.ok).toBe(true);
  if (!preflight.ok) {
    throw new Error(preflight.message);
  }
  const published = await publishContextualContentRelease({
    env: WRITE_ENV,
    repository,
    reviewRepository: fileContentReviewRepository,
    releaseId: preflight.record.releaseId,
    revision: preflight.record.revision,
    now: `${now.slice(0, 19)}.002Z`,
  });
  expect(published.ok).toBe(true);
  if (!published.ok) {
    throw new Error(published.message);
  }
  return published;
}

describe("active pointer rollback", () => {
  it("rolls B back to A without deleting B", async () => {
    const repository = new InMemoryContextualContentReleaseRepository();
    const a = await publishNew(repository, "2026-09-22T01:00:00.000Z");
    const b = await publishNew(repository, "2026-09-22T02:00:00.000Z");
    const rolled = await rollbackContextualContentActiveRelease({
      env: WRITE_ENV,
      repository,
      sceneId: MEAL_RELEASE_SCENE_ID,
      expectedPointerRevision: b.pointer.revision,
      targetReleaseId: a.record.releaseId,
      now: "2026-09-22T03:00:00.000Z",
    });
    expect(rolled.ok).toBe(true);
    if (!rolled.ok) {
      throw new Error(rolled.message);
    }
    expect(rolled.pointer.releaseId).toBe(a.record.releaseId);
    expect(rolled.target.status).toBe("PUBLISHED");
    expect(rolled.target.supersededAt).toBeNull();
    expect(rolled.target.supersededByReleaseId).toBeNull();
    const storedB = await repository.get(b.record.releaseId);
    expect(storedB).not.toBeNull();
    expect(storedB?.status).toBe("SUPERSEDED");
    expect(storedB?.supersededByReleaseId).toBe(a.record.releaseId);
    expect(storedB?.packSnapshot).toEqual(b.record.packSnapshot);
    const loaded = await repository.loadActiveRelease(MEAL_RELEASE_SCENE_ID);
    expect(loaded.ok && loaded.release.releaseId).toBe(a.record.releaseId);
  });

  it("rejects a stale pointer revision", async () => {
    const repository = new InMemoryContextualContentReleaseRepository();
    const a = await publishNew(repository, "2026-09-22T01:00:00.000Z");
    const b = await publishNew(repository, "2026-09-22T02:00:00.000Z");
    const rolled = await rollbackContextualContentActiveRelease({
      env: WRITE_ENV,
      repository,
      sceneId: MEAL_RELEASE_SCENE_ID,
      expectedPointerRevision: b.pointer.revision - 1,
      targetReleaseId: a.record.releaseId,
    });
    expect(rolled).toMatchObject({ ok: false, code: "RELEASE_CONFLICT" });
  });

  it("cannot roll back to a DRAFT", async () => {
    const repository = new InMemoryContextualContentReleaseRepository();
    await publishNew(repository, "2026-09-22T01:00:00.000Z");
    const draft = await createMealMigrationDraft({
      env: WRITE_ENV,
      repository,
      now: "2026-09-22T02:00:00.000Z",
    });
    expect(draft.ok).toBe(true);
    if (!draft.ok) {
      throw new Error(draft.message);
    }
    const pointer = await repository.getActivePointer(MEAL_RELEASE_SCENE_ID);
    const rolled = await rollbackContextualContentActiveRelease({
      env: WRITE_ENV,
      repository,
      sceneId: MEAL_RELEASE_SCENE_ID,
      expectedPointerRevision: pointer!.revision,
      targetReleaseId: draft.record.releaseId,
    });
    expect(rolled).toMatchObject({ ok: false, code: "RELEASE_NOT_PUBLISHED" });
  });

  it("cannot roll back to another scene", async () => {
    const repository = new InMemoryContextualContentReleaseRepository();
    const a = await publishNew(repository, "2026-09-22T01:00:00.000Z");
    const pointer = await repository.getActivePointer(MEAL_RELEASE_SCENE_ID);
    const rolled = await rollbackContextualContentActiveRelease({
      env: WRITE_ENV,
      repository,
      sceneId: "other-scene-v0",
      expectedPointerRevision: pointer!.revision,
      targetReleaseId: a.record.releaseId,
    });
    expect(rolled.ok).toBe(false);
  });

  it("cannot roll back to a fingerprint-damaged release", async () => {
    const repository = new InMemoryContextualContentReleaseRepository();
    const a = await publishNew(repository, "2026-09-22T01:00:00.000Z");
    await publishNew(repository, "2026-09-22T02:00:00.000Z");
    const damaged = await repository.get(a.record.releaseId);
    repository.replaceRaw({
      ...damaged!,
      releaseFingerprint: "0".repeat(64),
    });
    const pointer = await repository.getActivePointer(MEAL_RELEASE_SCENE_ID);
    const rolled = await rollbackContextualContentActiveRelease({
      env: WRITE_ENV,
      repository,
      sceneId: MEAL_RELEASE_SCENE_ID,
      expectedPointerRevision: pointer!.revision,
      targetReleaseId: a.record.releaseId,
    });
    expect(rolled.ok).toBe(false);
  });

  it("retries an already-active rollback idempotently", async () => {
    const repository = new InMemoryContextualContentReleaseRepository();
    const a = await publishNew(repository, "2026-09-22T01:00:00.000Z");
    const b = await publishNew(repository, "2026-09-22T02:00:00.000Z");
    const first = await rollbackContextualContentActiveRelease({
      env: WRITE_ENV,
      repository,
      sceneId: MEAL_RELEASE_SCENE_ID,
      expectedPointerRevision: b.pointer.revision,
      targetReleaseId: a.record.releaseId,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) {
      throw new Error(first.message);
    }
    const retry = await rollbackContextualContentActiveRelease({
      env: WRITE_ENV,
      repository,
      sceneId: MEAL_RELEASE_SCENE_ID,
      expectedPointerRevision: first.pointer.revision,
      targetReleaseId: a.record.releaseId,
    });
    expect(retry.ok).toBe(true);
    if (!retry.ok) {
      throw new Error(retry.message);
    }
    expect(retry.idempotent).toBe(true);
    expect(retry.pointer.releaseId).toBe(a.record.releaseId);
    expect(await repository.get(b.record.releaseId)).not.toBeNull();
  });

  it("rolls a different approved snapshot back while live authoring matches B", async () => {
    const repository = new InMemoryContextualContentReleaseRepository();
    const a = await publishFromPack({
      repository,
      pack: MEAL_SCENE_EXPANSION_BATCH_01_PACK,
      releaseId: "meal-release-historical-a",
      now: "2026-09-22T01:00:00.000Z",
    });
    const b = await publishFromPack({
      repository,
      pack: experimentalMealContextLabPack(),
      releaseId: "meal-release-historical-b",
      now: "2026-09-22T02:00:00.000Z",
    });
    expect(a.record.packSnapshot.id).not.toBe(b.record.packSnapshot.id);
    expect(a.record.releaseFingerprint).not.toBe(b.record.releaseFingerprint);
    expect(a.record.targetEntries).not.toHaveLength(b.record.targetEntries.length);
    expect((await repository.get(a.record.releaseId))?.status).toBe("SUPERSEDED");
    expect((await repository.getActivePointer(MEAL_RELEASE_SCENE_ID))?.releaseId).toBe(b.record.releaseId);

    const liveB = await evaluatePublishReadiness({
      existing: a.record,
      reviewRepository: fileContentReviewRepository,
      pack: experimentalMealContextLabPack(),
    });
    expect(liveB.some((item) => item.code === "RELEASE_PACK_MISMATCH" || item.code === "RELEASE_FINGERPRINT_DRIFT")).toBe(
      true,
    );
    const historical = await evaluateHistoricalReleaseIntegrity({ existing: (await repository.get(a.record.releaseId))! });
    expect(historical).toEqual([]);

    const rolled = await rollbackContextualContentActiveRelease({
      env: WRITE_ENV,
      repository,
      reviewRepository: fileContentReviewRepository,
      pack: experimentalMealContextLabPack(),
      sceneId: MEAL_RELEASE_SCENE_ID,
      expectedPointerRevision: b.pointer.revision,
      targetReleaseId: a.record.releaseId,
      now: "2026-09-22T03:00:00.000Z",
    });
    expect(rolled.ok).toBe(true);
    if (!rolled.ok) {
      throw new Error(rolled.message);
    }
    expect(rolled.pointer.releaseId).toBe(a.record.releaseId);
    const loaded = await repository.loadActiveRelease(MEAL_RELEASE_SCENE_ID);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) {
      throw new Error(loaded.message);
    }
    expect(loaded.release.releaseId).toBe(a.record.releaseId);
    expect(loaded.release.packSnapshot.id).toBe(MEAL_SCENE_EXPANSION_BATCH_01_PACK.id);
    expect(loaded.release.packSnapshot).toEqual(a.record.packSnapshot);
    expect(loaded.release.status).toBe("PUBLISHED");
    const storedB = await repository.get(b.record.releaseId);
    expect(storedB).not.toBeNull();
    expect(storedB?.status).toBe("SUPERSEDED");
    expect(storedB?.packSnapshot).toEqual(b.record.packSnapshot);
  });

  it("rejects rollback when the historical approval binding is stripped", async () => {
    const repository = new InMemoryContextualContentReleaseRepository();
    const a = await publishFromPack({
      repository,
      pack: MEAL_SCENE_EXPANSION_BATCH_01_PACK,
      releaseId: "meal-release-historical-a",
      now: "2026-09-22T01:00:00.000Z",
    });
    await publishFromPack({
      repository,
      pack: experimentalMealContextLabPack(),
      releaseId: "meal-release-historical-b",
      now: "2026-09-22T02:00:00.000Z",
    });
    const stored = await repository.get(a.record.releaseId);
    const unbound = {
      ...stored!,
      historicalApprovalBindings: [],
    };
    expect(fingerprintsForManifest(unbound).releaseFingerprint).toBe(stored!.releaseFingerprint);
    repository.replaceRaw(unbound);
    const pointer = await repository.getActivePointer(MEAL_RELEASE_SCENE_ID);
    const rolled = await rollbackContextualContentActiveRelease({
      env: WRITE_ENV,
      repository,
      sceneId: MEAL_RELEASE_SCENE_ID,
      expectedPointerRevision: pointer!.revision,
      targetReleaseId: a.record.releaseId,
    });
    expect(rolled.ok).toBe(false);
    if (rolled.ok) {
      throw new Error("rollback should reject missing historical approval bindings");
    }
    expect(rolled.message).toMatch(/approval binding/i);
  });
});

async function publishFromPack(input: {
  repository: InMemoryContextualContentReleaseRepository;
  pack: ContextualSceneContentPack;
  releaseId: string;
  now: string;
}) {
  const authority = await buildMealMigrationAuthority({
    pack: input.pack,
    reviewRepository: fileContentReviewRepository,
  });
  const record = manifestFromAuthority({
    authority,
    createdAt: input.now,
    releaseId: input.releaseId,
  });
  const created = await input.repository.create({ record });
  expect(created.ok).toBe(true);
  if (!created.ok) {
    throw new Error(created.message);
  }
  const preflight = await preflightContextualContentRelease({
    env: WRITE_ENV,
    repository: input.repository,
    reviewRepository: fileContentReviewRepository,
    pack: input.pack,
    releaseId: created.record.releaseId,
    revision: created.record.revision,
    now: `${input.now.slice(0, 19)}.001Z`,
  });
  expect(preflight.ok).toBe(true);
  if (!preflight.ok) {
    throw new Error(preflight.message);
  }
  const published = await publishContextualContentRelease({
    env: WRITE_ENV,
    repository: input.repository,
    reviewRepository: fileContentReviewRepository,
    pack: input.pack,
    releaseId: preflight.record.releaseId,
    revision: preflight.record.revision,
    now: `${input.now.slice(0, 19)}.002Z`,
  });
  expect(published.ok).toBe(true);
  if (!published.ok) {
    throw new Error(published.message);
  }
  return published;
}
