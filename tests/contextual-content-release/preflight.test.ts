import { describe, expect, it } from "vitest";
import {
  experimentalMealContextLabPack,
  listSceneContentRegistry,
  MEAL_SCENE_EXPANSION_BATCH_02_PACK_ID,
} from "@/contextual-learning/candidate-v0/content";
import { cloneFrozen } from "@/contextual-learning/candidate-v0/content/immutable";
import type { HumanContentReviewRecord } from "@/server/contextual-content-review/types";
import type { ContentReviewRepository } from "@/server/contextual-content-review/content-review-repository";
import { fileContentReviewRepository } from "@/server/contextual-content-review/file-content-review-repository";
import { createMealMigrationDraft } from "@/server/contextual-content-release/create-migration-draft";
import { InMemoryContextualContentReleaseRepository } from "@/server/contextual-content-release/in-memory-release-repository";
import { preflightContextualContentRelease } from "@/server/contextual-content-release/preflight-contextual-content-release";

const WRITE_ENV = {
  DEBUG_TOOLS_ENABLED: "1",
  CONTEXTUAL_CONTENT_RELEASE_ENABLED: "1",
  CONTEXTUAL_CONTENT_RELEASE_WRITE_ENABLED: "1",
  CONTEXTUAL_RELEASE_RUNTIME: "memory",
};

function reviewRepo(overrides: Partial<Record<string, HumanContentReviewRecord | null>> = {}): ContentReviewRepository {
  return {
    async get(reviewKey) {
      if (Object.prototype.hasOwnProperty.call(overrides, reviewKey)) {
        return overrides[reviewKey] ?? null;
      }
      return fileContentReviewRepository.get(reviewKey);
    },
    async saveIfRevision() {
      throw new Error("release preflight must not write reviews");
    },
    async commit() {
      throw new Error("release preflight must not write reviews");
    },
  };
}

async function createDraft(repository = new InMemoryContextualContentReleaseRepository()) {
  const created = await createMealMigrationDraft({
    env: WRITE_ENV,
    repository,
    reviewRepository: reviewRepo(),
    now: "2026-09-22T00:00:00.000Z",
  });
  expect(created.ok).toBe(true);
  if (!created.ok) {
    throw new Error(created.message);
  }
  return { repository, record: created.record };
}

describe("release preflight authority", () => {
  it("validates the current six-word snapshot with real cup/plate reviews and legacy four-word attestation", async () => {
    const { repository, record } = await createDraft();
    expect(record.targetEntries.map((item) => item.displayLabel)).toEqual([
      "汤",
      "碗",
      "勺子",
      "叉子",
      "杯子",
      "盘子",
    ]);
    expect(record.targetEntries.filter((item) => item.humanDecision === "LEGACY_BASELINE")).toHaveLength(4);
    expect(record.targetEntries.filter((item) => item.humanDecision === "APPROVED")).toHaveLength(2);
    const cup = record.targetEntries.find((item) => item.reviewKey === "meal-expansion-batch-01-cup");
    const plate = record.targetEntries.find((item) => item.reviewKey === "meal-expansion-batch-02-plate");
    expect(cup?.reviewRevision).toBe(1);
    expect(plate?.reviewRevision).toBe(1);
    expect(cup?.contentFingerprint).not.toBe(plate?.contentFingerprint);
    const cupRecord = await fileContentReviewRepository.get("meal-expansion-batch-01-cup");
    const plateRecord = await fileContentReviewRepository.get("meal-expansion-batch-02-plate");
    expect(cupRecord?.decision).toBe("APPROVED");
    expect(plateRecord?.decision).toBe("APPROVED");
    const result = await preflightContextualContentRelease({
      releaseId: record.releaseId,
      revision: record.revision,
      env: WRITE_ENV,
      repository,
      reviewRepository: reviewRepo(),
      now: "2026-09-22T00:00:01.000Z",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.message);
    }
    expect(result.record.status).toBe("PREFLIGHT_VALIDATED");
    expect(result.record.revision).toBe(1);
    const retry = await preflightContextualContentRelease({
      releaseId: record.releaseId,
      revision: result.record.revision,
      env: WRITE_ENV,
      repository,
      reviewRepository: reviewRepo(),
    });
    expect(retry.ok && retry.idempotent).toBe(true);
    expect(retry.ok && retry.record.revision).toBe(1);
  });

  it("does not forge human reviews for the legacy four words", async () => {
    const { record } = await createDraft();
    for (const entry of record.targetEntries.filter((item) => item.approvalBasis === "LEGACY_EXPERIMENT_BASELINE")) {
      expect(entry.humanDecision).toBe("LEGACY_BASELINE");
      expect(entry.reviewRevision).toBe(0);
      expect(entry.reviewKey.startsWith("legacy-meal-baseline-")).toBe(true);
    }
  });

  it("fails when cup or plate reviews are missing", async () => {
    const repository = new InMemoryContextualContentReleaseRepository();
    const missingCup = await createMealMigrationDraft({
      env: WRITE_ENV,
      repository,
      reviewRepository: reviewRepo({ "meal-expansion-batch-01-cup": null }),
    });
    expect(missingCup.ok).toBe(false);
    const missingPlate = await createMealMigrationDraft({
      env: WRITE_ENV,
      repository: new InMemoryContextualContentReleaseRepository(),
      reviewRepository: reviewRepo({ "meal-expansion-batch-02-plate": null }),
    });
    expect(missingPlate.ok).toBe(false);
  });

  it("fails when fingerprint, review revision, selected meaning, or context drift", async () => {
    const { repository, record } = await createDraft();
    const drifted = cloneFrozen({
      ...record,
      targetEntries: record.targetEntries.map((entry, index) =>
        index === 5
          ? {
              ...entry,
              contentFingerprint: "0".repeat(64),
              reviewRevision: entry.reviewRevision + 1,
              selectedMeaning: "板",
            }
          : entry,
      ),
      contextSnapshot: {
        ...record.contextSnapshot,
        frames: record.contextSnapshot.frames.map((frame, index) =>
          index === 0 ? { ...frame, title: `${frame.title} drifted` } : frame,
        ),
      },
    });
    repository.replaceRaw(drifted);
    const result = await preflightContextualContentRelease({
      releaseId: record.releaseId,
      revision: record.revision,
      env: WRITE_ENV,
      repository,
      reviewRepository: reviewRepo(),
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected failure");
    }
    const codes = result.issues.map((item) => item.code);
    expect(codes).toContain("RELEASE_FINGERPRINT_DRIFT");
    expect(codes).toContain("RELEASE_REVIEW_STALE");
    expect(codes).toContain("RELEASE_MEANING_INVALID");
    expect(codes).toContain("RELEASE_CONTEXT_MISMATCH");
  });

  it("does not mutate the live runtime or registry", async () => {
    const beforePack = experimentalMealContextLabPack().id;
    const beforeRegistry = JSON.stringify(listSceneContentRegistry());
    const { repository, record } = await createDraft();
    await preflightContextualContentRelease({
      releaseId: record.releaseId,
      revision: record.revision,
      env: WRITE_ENV,
      repository,
      reviewRepository: reviewRepo(),
    });
    expect(experimentalMealContextLabPack().id).toBe(beforePack);
    expect(experimentalMealContextLabPack().id).toBe(MEAL_SCENE_EXPANSION_BATCH_02_PACK_ID);
    expect(JSON.stringify(listSceneContentRegistry())).toBe(beforeRegistry);
  });
});
