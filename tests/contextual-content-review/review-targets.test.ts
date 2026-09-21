import { describe, expect, it } from "vitest";
import { MEAL_EXPANSION_BATCH_01_CUP_APPROVED_FINGERPRINT } from "@/contextual-learning/candidate-v0/content";
import { MEAL_SCENE_EXPANSION_BATCH_02_PACK_ID } from "@/contextual-learning/candidate-v0/content";
import { getApprovedExperimentSceneContent } from "@/contextual-learning/candidate-v0/content";
import { registryStatusFor } from "@/contextual-learning/candidate-v0/content";
import { listContentReviewTargets } from "@/server/contextual-content-review/list-review-targets";
import { currentContentFingerprint, projectContentReviewPacket } from "@/server/contextual-content-review/project-review-packet";
import { safeReviewArtifactDirectory, safeReviewRecordPath } from "@/server/contextual-content-review/review-artifact-path";
import {
  CONTENT_REVIEW_TARGETS,
  findReviewTarget,
  reviewHref,
  reviewTargetByKey,
} from "@/server/contextual-content-review/review-target-registry";
import { saveContentReviewDecision } from "@/server/contextual-content-review/save-review-decision";
import {
  FileContentReviewRepository,
  fileContentReviewRepository,
} from "@/server/contextual-content-review/file-content-review-repository";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const cup = CONTENT_REVIEW_TARGETS.find((item) => item.targetSlug === "cup")!;
const plate = CONTENT_REVIEW_TARGETS.find((item) => item.targetSlug === "plate")!;

describe("generic content review targets", () => {
  it("keeps the cup URL and approved fingerprint", () => {
    expect(reviewHref(cup)).toBe("/debug/contextual-content-review/meal-expansion-batch-01/cup");
    expect(currentContentFingerprint(cup)).toBe(MEAL_EXPANSION_BATCH_01_CUP_APPROVED_FINGERPRINT);
    expect(findReviewTarget({ routePackId: "meal-expansion-batch-01", targetSlug: "cup" })?.reviewKey).toBe(
      cup.reviewKey,
    );
  });

  it("lists and reads the plate Candidate target", async () => {
    const listed = await listContentReviewTargets();
    expect(listed.map((item) => item.reviewKey)).toEqual([
      "meal-expansion-batch-01-cup",
      "meal-expansion-batch-02-plate",
    ]);
    const plateItem = listed.find((item) => item.reviewKey === plate.reviewKey)!;
    expect(plateItem.statusLabel).toBe("APPROVED");
    expect(plateItem.registryStatus).toBe("APPROVED_FOR_EXPERIMENT");
    const record = await fileContentReviewRepository.get(plate.reviewKey);
    const packet = projectContentReviewPacket({ spec: plate, record, writeEnabled: false });
    expect(packet?.pack.registryStatus).toBe("APPROVED_FOR_EXPERIMENT");
    expect(packet?.promotionScope).toBe("EXPERIMENT_ONLY");
    expect(packet?.reviewStatus).toBe("APPROVED");
    expect(packet?.reviewRevision).toBe(1);
    expect(packet?.target.senseId).toBe("plate#food-support");
    expect(packet?.target.meaningGloss).toBe("盘子");
    expect(packet?.target.meaningsZh).toContain("盘子");
    expect(packet?.target.meaningGloss).not.toBe("板");
    expect(packet?.frames.some((frame) =>
      frame.entities.some((entity) => entity.entityId === "home-plate"),
    )).toBe(true);
    expect(packet?.notices.some((item) => item.includes("机器验证通过不等于人工批准"))).toBe(true);
  });

  it("fails closed on unknown or traversing target input", () => {
    expect(findReviewTarget({ routePackId: "missing-pack", targetSlug: "cup" })).toBeNull();
    expect(findReviewTarget({ routePackId: "meal-expansion-batch-01", targetSlug: "missing" })).toBeNull();
    expect(findReviewTarget({ routePackId: "../etc", targetSlug: "passwd" })).toBeNull();
    expect(reviewTargetByKey("../etc/passwd")).toBeNull();
    expect(reviewTargetByKey("meal-expansion-batch-01-cup/../../secret")).toBeNull();
    expect(safeReviewArtifactDirectory("../etc/passwd")).toBeNull();
    expect(safeReviewRecordPath("not-a-registered-key")).toBeNull();
    expect(safeReviewArtifactDirectory(cup.reviewKey)).toContain(cup.artifactDirectory);
    expect(safeReviewArtifactDirectory(plate.reviewKey)).toContain(plate.artifactDirectory);
    expect(safeReviewArtifactDirectory(cup.reviewKey)).not.toBe(
      safeReviewArtifactDirectory(plate.reviewKey),
    );
  });

  it("does not promote plate when a review decision is saved", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "plate-review-"));
    const repository = new FileContentReviewRepository((reviewKey) =>
      path.join(dir, reviewKey, "human-review.record.json"),
    );
    const fingerprint = currentContentFingerprint(plate)!;
    const saved = await saveContentReviewDecision({
      fingerprint,
      revision: 0,
      decision: "APPROVED",
      notes: [],
      env: {
        DEBUG_TOOLS_ENABLED: "1",
        CONTEXTUAL_CONTENT_REVIEW_ENABLED: "1",
        CONTEXTUAL_CONTENT_REVIEW_WRITE_ENABLED: "1",
      },
      repository,
      syncMarkdown: false,
    });
    expect(saved.ok).toBe(true);
    expect(registryStatusFor(MEAL_SCENE_EXPANSION_BATCH_02_PACK_ID)).toBe(
      "APPROVED_FOR_EXPERIMENT",
    );
    expect(getApprovedExperimentSceneContent(MEAL_SCENE_EXPANSION_BATCH_02_PACK_ID).ok).toBe(
      true,
    );
  });
});
