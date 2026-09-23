import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  MEAL_SCENE_EXPANSION_BATCH_01_CUP_PROMOTION,
  MEAL_SCENE_EXPANSION_BATCH_02_PLATE_PROMOTION,
  registryEntryFor,
} from "@/contextual-learning/candidate-v0/content";
import { validateExperimentPromotion } from "@/contextual-learning/candidate-v0/content/validate-experiment-promotion";
import { FileContentReviewRepository } from "@/server/contextual-content-review/file-content-review-repository";
import { FileContextualContentBatchPromotionRepository } from "@/server/contextual-content-promotion/file-promotion-repository";
import { FileContextualContentReleaseRepository } from "@/server/contextual-content-release/file-release-repository";
import { resolveContextualReviewRoot } from "@/server/contextual-content-review/review-artifact-path";
import { contextualPromotionRoot } from "@/server/contextual-content-promotion/promotion-artifact-path";
import { contextualReleaseRoot } from "@/server/contextual-content-release/release-artifact-path";
import { isContextualContentReleaseWriteEnabled } from "@/server/contextual-content-release/gates";
import { isContextualContentReviewWriteEnabled } from "@/server/contextual-content-review/gates";
import { isContextualContentPromotionWriteEnabled } from "@/server/contextual-content-promotion/gates";
import {
  HUMAN_WORKSPACE_PATHS,
  cleanupContextualContentTestWorkspace,
  createContextualContentTestWorkspace,
  humanWorkspaceRoots,
  inventoryHumanArtifacts,
  seedOrdinaryE2EFixtures,
  seedSyntheticApprovedReviews,
  sha256File,
  snapshotHumanArtifact,
  writeSyntheticStalePromotion,
  type ContextualContentTestWorkspace,
} from "./index";

const REAL_RELEASE_WRITE_ENV = {
  CONTEXTUAL_CONTENT_REVIEW_WRITE_ENABLED: "0",
  CONTEXTUAL_CONTENT_PROMOTION_WRITE_ENABLED: "0",
  CONTEXTUAL_CONTENT_RELEASE_WRITE_ENABLED: "0",
  CONTEXTUAL_CONTENT_REVIEW_ENABLED: "1",
  CONTEXTUAL_CONTENT_PROMOTION_ENABLED: "1",
  CONTEXTUAL_CONTENT_RELEASE_ENABLED: "1",
};

const workspaces: ContextualContentTestWorkspace[] = [];

afterEach(() => {
  while (workspaces.length > 0) {
    const workspace = workspaces.pop();
    if (workspace) {
      cleanupContextualContentTestWorkspace(workspace);
    }
  }
});

describe("contextual content test workspace isolation", () => {
  it("seeds and writes only inside the temp root", () => {
    const workspace = createContextualContentTestWorkspace("isolation-write");
    workspaces.push(workspace);
    seedSyntheticApprovedReviews(workspace, ["cup"]);
    writeSyntheticStalePromotion(workspace);
    const review = new FileContentReviewRepository((reviewKey) =>
      path.join(workspace.reviewRoot, reviewKey, "human-review.record.json"),
    );
    expect(review).toBeInstanceOf(FileContentReviewRepository);
    expect(existsSync(path.join(workspace.reviewRoot, "meal-expansion-batch-01-cup", "human-review.record.json"))).toBe(
      true,
    );
    expect(existsSync(path.join(humanWorkspaceRoots().review, "meal-expansion-batch-01-cup", ".not-written-by-test"))).toBe(
      false,
    );
    expect(resolveContextualReviewRoot(workspace.env)).toBe(workspace.reviewRoot);
    expect(contextualPromotionRoot(workspace.env)).toBe(workspace.promotionRoot);
    expect(contextualReleaseRoot(workspace.env)).toBe(workspace.releaseRoot);
    expect(new FileContextualContentBatchPromotionRepository().artifactRoot).not.toBe(
      workspace.promotionRoot,
    );
    expect(new FileContextualContentReleaseRepository()).toBeInstanceOf(
      FileContextualContentReleaseRepository,
    );
  });

  it("keeps a protected-workspace sentinel unchanged through temp writes and cleanup", () => {
    const protectedWorkspace = createContextualContentTestWorkspace("isolation-protected");
    const workspace = createContextualContentTestWorkspace("isolation-sentinel");
    workspaces.push(protectedWorkspace, workspace);
    const sentinel = path.join(
      protectedWorkspace.reviewRoot,
      ".wordranger-synthetic-isolation-sentinel",
    );
    const payload = `SYNTHETIC_TEST_ONLY ${Date.now()}\n`;
    writeFileSync(sentinel, payload);
    const before = sha256File(sentinel);
    seedSyntheticApprovedReviews(workspace, ["knife", "bread", "water"]);
    writeSyntheticStalePromotion(workspace);
    cleanupContextualContentTestWorkspace(workspace);
    expect(sha256File(sentinel)).toBe(before);
    expect(readFileSync(sentinel, "utf8")).toBe(payload);
    expect(existsSync(protectedWorkspace.root)).toBe(true);
    expect(
      existsSync(path.join(humanWorkspaceRoots().review, ".wordranger-synthetic-isolation-sentinel")),
    ).toBe(false);
  });

  it("does not change the real batch-03 promotion snapshot while writing temp fixtures", () => {
    const before = snapshotHumanArtifact(HUMAN_WORKSPACE_PATHS.batch03Promotion);
    const workspace = createContextualContentTestWorkspace("isolation-real-promotion");
    workspaces.push(workspace);
    seedOrdinaryE2EFixtures(workspace);
    seedSyntheticApprovedReviews(workspace, ["knife", "bread", "water"]);
    writeSyntheticStalePromotion(workspace);
    expect(existsSync(path.join(workspace.promotionRoot, "meal-scene-v0__meal-scene-expansion-batch-03.json"))).toBe(
      true,
    );
    cleanupContextualContentTestWorkspace(workspace);
    expect(snapshotHumanArtifact(HUMAN_WORKSPACE_PATHS.batch03Promotion)).toEqual(before);
  });

  it("inventories the real human workspace without creating files", () => {
    const before = inventoryHumanArtifacts();
    const after = inventoryHumanArtifacts();
    expect(after).toEqual(before);
    expect(snapshotHumanArtifact(HUMAN_WORKSPACE_PATHS.batch03Promotion)).toEqual(
      snapshotHumanArtifact(HUMAN_WORKSPACE_PATHS.batch03Promotion),
    );
    expect(
      existsSync(path.join(humanWorkspaceRoots().review, ".wordranger-synthetic-isolation-sentinel")),
    ).toBe(false);
  });

  it("refuses write-enabled repositories under real-release configuration", () => {
    expect(isContextualContentReviewWriteEnabled(REAL_RELEASE_WRITE_ENV)).toBe(false);
    expect(isContextualContentPromotionWriteEnabled(REAL_RELEASE_WRITE_ENV)).toBe(false);
    expect(isContextualContentReleaseWriteEnabled(REAL_RELEASE_WRITE_ENV)).toBe(false);
  });

  it("seeds synthetic cup/plate artifacts that satisfy experiment promotion checks", () => {
    const workspace = createContextualContentTestWorkspace("isolation-promotion-basis");
    workspaces.push(workspace);
    seedOrdinaryE2EFixtures(workspace);
    for (const [reviewKey, packId, attestation] of [
      [
        "meal-expansion-batch-01-cup",
        "meal-scene-expansion-batch-01",
        MEAL_SCENE_EXPANSION_BATCH_01_CUP_PROMOTION,
      ],
      [
        "meal-expansion-batch-02-plate",
        "meal-scene-expansion-batch-02",
        MEAL_SCENE_EXPANSION_BATCH_02_PLATE_PROMOTION,
      ],
    ] as const) {
      const dir = path.join(workspace.reviewRoot, reviewKey);
      const entry = registryEntryFor(packId);
      expect(entry?.promotion).toBeTruthy();
      const result = validateExperimentPromotion({
        entry: entry!,
        expectedAttestation: attestation,
        artifacts: {
          reviewRecord: JSON.parse(readFileSync(path.join(dir, "human-review.record.json"), "utf8")),
          manifest: JSON.parse(readFileSync(path.join(dir, "REVIEW_MANIFEST.json"), "utf8")),
          humanMarkdown: readFileSync(path.join(dir, "HUMAN_REVIEW.md"), "utf8"),
          packetMarkdown: readFileSync(path.join(dir, "REVIEW_PACKET.md"), "utf8"),
        },
      });
      expect(result).toEqual({ ok: true });
    }
  });
});
