import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID,
  experimentalMealContextLabPack,
  registryStatusFor,
} from "@/contextual-learning/candidate-v0/content";
import { listContentReviewBatches } from "@/server/contextual-content-review/list-review-batches";
import { listContentReviewTargets } from "@/server/contextual-content-review/list-review-targets";
import {
  currentContentFingerprint,
  projectContentReviewPacket,
} from "@/server/contextual-content-review/project-review-packet";
import {
  CONTENT_REVIEW_BLOCKED_CANDIDATES,
  CONTENT_REVIEW_TARGETS,
  uniqueReviewTarget,
} from "@/server/contextual-content-review/review-target-registry";
import { saveContentReviewDecision } from "@/server/contextual-content-review/save-review-decision";
import { FileContentReviewRepository } from "@/server/contextual-content-review/file-content-review-repository";
import { bundledSceneLexemeLoader } from "@/server/runtime/bundled-scene-lexeme-loader";

const knife = CONTENT_REVIEW_TARGETS.find((item) => item.targetSlug === "knife")!;
const bread = CONTENT_REVIEW_TARGETS.find((item) => item.targetSlug === "bread")!;
const water = CONTENT_REVIEW_TARGETS.find((item) => item.targetSlug === "water")!;

function tempRepository() {
  const dir = mkdtempSync(path.join(tmpdir(), "batch-03-review-"));
  return new FileContentReviewRepository((reviewKey) =>
    path.join(dir, reviewKey, "human-review.record.json"),
  );
}

describe("Meal expansion batch 03 review registration", () => {
  it("registers independent pending review keys without default APPROVED records", async () => {
    expect(knife.reviewKey).toBe("meal-expansion-batch-03-knife");
    expect(bread.reviewKey).toBe("meal-expansion-batch-03-bread");
    expect(water.reviewKey).toBe("meal-expansion-batch-03-water");
    expect(new Set(CONTENT_REVIEW_TARGETS.map((item) => item.reviewKey)).size).toBe(
      CONTENT_REVIEW_TARGETS.length,
    );
    expect(CONTENT_REVIEW_BLOCKED_CANDIDATES.map((item) => item.plannedLemma)).toEqual(["napkin"]);
    const listed = await listContentReviewTargets();
    const batch = (
      await listContentReviewBatches({
        env: { CONTEXTUAL_CONTENT_PROMOTION_ENABLED: "0" },
      })
    ).find(
      (item) => item.batchId === "meal-expansion-batch-03",
    )!;
    expect(batch.totalAuthored).toBe(3);
    expect(batch.pending).toBe(3);
    expect(batch.approved).toBe(0);
    expect(batch.rejected).toBe(0);
    expect(batch.stale).toBe(0);
    expect(batch.blocked).toBe(1);
    expect(batch.registryStatus).toBe("CANDIDATE");
    expect(batch.releaseEligibility).toBe("NONE");
    expect(batch.reviewCompleteUnpromoted).toBe(false);
    for (const spec of [knife, bread, water]) {
      const item = listed.find((entry) => entry.reviewKey === spec.reviewKey)!;
      expect(item.statusLabel).toBe("PENDING");
      expect(item.registryStatus).toBe("CANDIDATE");
      expect(item.contentFingerprint).toBe(currentContentFingerprint(spec));
      const packet = projectContentReviewPacket({ spec, writeEnabled: false });
      expect(packet?.reviewStatus).toBe("PENDING");
      expect(packet?.promotionScope).toBeUndefined();
      expect(packet?.pack.registryStatus).toBe("CANDIDATE");
      const bundled = bundledSceneLexemeLoader(packet!.target.canonicalKey);
      expect(packet?.target.lexemeId).toBe(bundled!.id);
      expect(packet?.target.meaningGloss).toBe(
        spec.targetSlug === "knife" ? "小刀" : spec.targetSlug === "bread" ? "面包" : "水",
      );
    }
  });

  it("binds approve/reject/stale decisions to one target fingerprint", async () => {
    const repository = tempRepository();
    const knifePrint = currentContentFingerprint(knife)!;
    const breadPrint = currentContentFingerprint(bread)!;
    const waterPrint = currentContentFingerprint(water)!;
    expect(new Set([knifePrint, breadPrint, waterPrint]).size).toBe(3);

    const approved = await saveContentReviewDecision({
      fingerprint: knifePrint,
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
    expect(approved.ok).toBe(true);
    if (!approved.ok) {
      throw new Error(approved.message);
    }
    expect(approved.record.reviewKey).toBe(knife.reviewKey);
    expect(approved.record.contentFingerprint).toBe(knifePrint);
    expect(approved.record.reviewer).toBe("LOCAL_INTERNAL_REVIEWER");
    expect(approved.record.packId).toBe(MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID);

    const rejected = await saveContentReviewDecision({
      fingerprint: breadPrint,
      revision: 0,
      decision: "REJECTED",
      notes: ["Contrast is too thin."],
      env: {
        DEBUG_TOOLS_ENABLED: "1",
        CONTEXTUAL_CONTENT_REVIEW_ENABLED: "1",
        CONTEXTUAL_CONTENT_REVIEW_WRITE_ENABLED: "1",
      },
      repository,
      syncMarkdown: false,
    });
    expect(rejected.ok).toBe(true);
    if (!rejected.ok) {
      throw new Error(rejected.message);
    }
    expect(rejected.record.reviewKey).toBe(bread.reviewKey);
    expect(rejected.record.decision).toBe("REJECTED");

    expect(await repository.get(water.reviewKey)).toBeNull();
    expect((await repository.get(knife.reviewKey))?.decision).toBe("APPROVED");
    expect(registryStatusFor(MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID)).toBe("CANDIDATE");
    expect(experimentalMealContextLabPack().lexemes).toHaveLength(6);

    const stalePacket = projectContentReviewPacket({
      spec: knife,
      record: { ...approved.record, contentFingerprint: "outdated" },
      writeEnabled: false,
    });
    expect(stalePacket?.staleState).toBe("STALE_REVIEW");
    expect(stalePacket?.reviewStatus).toBe("PENDING");
  });

  it("fail-closes duplicate review keys and client-owned identity fields", () => {
    expect(uniqueReviewTarget(CONTENT_REVIEW_TARGETS, knife.reviewKey)?.targetSlug).toBe("knife");
    expect(
      uniqueReviewTarget(
        [...CONTENT_REVIEW_TARGETS, { ...knife, packId: "other-pack" }],
        knife.reviewKey,
      ),
    ).toBeNull();
    const actions = readFileSync("src/app/debug/contextual-content-review/actions.ts", "utf8");
    const submit = actions.slice(
      actions.indexOf("export async function submitContentReviewDecision"),
      actions.indexOf("export async function promoteReviewedBatch"),
    );
    expect(submit).not.toContain("reviewKey");
    expect(submit).not.toContain("packId");
    expect(submit).not.toContain("userId");
    expect(submit).not.toContain("targetSlug");
    expect(submit).toContain("fingerprint");
    const promote = actions.slice(actions.indexOf("export async function promoteReviewedBatch"));
    expect(promote).toContain("packId");
    expect(promote).toContain("expectedRevision");
    expect(promote).not.toContain("userId");
    expect(promote).not.toContain("targetApprovalBindings");
    expect(promote).not.toContain("promotedBy");
  });
});
