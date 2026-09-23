import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { renderHumanReviewMarkdown } from "@/server/contextual-content-review/human-review-markdown";
import { currentContentFingerprint } from "@/server/contextual-content-review/project-review-packet";
import { CONTENT_REVIEW_TARGETS } from "@/server/contextual-content-review/review-target-registry";
import type { HumanContentReviewRecord } from "@/server/contextual-content-review/types";
import type { ContextualContentTestWorkspace } from "./create-workspace";
import { SYNTHETIC_TEST_NOTE, SYNTHETIC_TEST_PROMOTER } from "./invariants";

const BATCH_03_SLUGS = ["knife", "bread", "water"] as const;

export function workspaceReviewRecordPath(
  workspace: Pick<ContextualContentTestWorkspace, "reviewRoot">,
  reviewKey: string,
): string {
  return path.join(workspace.reviewRoot, reviewKey, "human-review.record.json");
}

export function workspacePromotionPath(
  workspace: Pick<ContextualContentTestWorkspace, "promotionRoot">,
  sceneId = "meal-scene-v0",
  packId = "meal-scene-expansion-batch-03",
): string {
  return path.join(workspace.promotionRoot, `${sceneId}__${packId}.json`);
}

function writeSyntheticReviewCompanionArtifacts(
  workspace: Pick<ContextualContentTestWorkspace, "reviewRoot">,
  spec: (typeof CONTENT_REVIEW_TARGETS)[number],
  record: HumanContentReviewRecord,
): void {
  const dir = path.dirname(workspaceReviewRecordPath(workspace, spec.reviewKey));
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "human-review.record.json"), `${JSON.stringify(record, null, 2)}\n`);
  writeFileSync(
    path.join(dir, "HUMAN_REVIEW.md"),
    renderHumanReviewMarkdown({
      fingerprint: record.contentFingerprint,
      record,
    }),
  );
  writeFileSync(
    path.join(dir, "REVIEW_MANIFEST.json"),
    `${JSON.stringify(
      {
        schemaVersion: "candidate-v0",
        kind: "SYNTHETIC_TEST_ONLY",
        packId: spec.packId,
        registryStatus: spec.expectedRegistryStatus,
        contentFingerprint: record.contentFingerprint,
        target: spec.target,
        reviewStatus: record.decision,
        staleState: "CURRENT",
        notice: SYNTHETIC_TEST_NOTE,
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    path.join(dir, "REVIEW_PACKET.md"),
    `# Review packet

SYNTHETIC_TEST_ONLY — not a human approval.

- Pack: \`${spec.packId}\`
- Registry status: \`${spec.expectedRegistryStatus}\`
- Target: \`${spec.target.lexemeId}\` / \`${spec.target.senseId}\`
- Content fingerprint: \`${record.contentFingerprint}\`
- Human review: ${record.decision}

${spec.expectedRegistryStatus}
`,
  );
}

export function seedSyntheticApprovedReviews(
  workspace: Pick<ContextualContentTestWorkspace, "reviewRoot">,
  slugs: readonly string[],
): void {
  for (const slug of slugs) {
    const spec = CONTENT_REVIEW_TARGETS.find((item) => item.targetSlug === slug);
    if (!spec) {
      throw new Error(`Unknown synthetic review slug ${slug}`);
    }
    const fingerprint = currentContentFingerprint(spec);
    if (!fingerprint) {
      throw new Error(`Missing fingerprint for ${slug}`);
    }
    writeSyntheticReviewCompanionArtifacts(workspace, spec, {
      schemaVersion: "candidate-v0",
      reviewKey: spec.reviewKey,
      packId: spec.packId,
      target: spec.target,
      contentFingerprint: fingerprint,
      decision: "APPROVED",
      notes: [SYNTHETIC_TEST_NOTE],
      reviewedAt: "2026-09-23T00:00:00.000Z",
      revision: 1,
      reviewer: "LOCAL_INTERNAL_REVIEWER",
    });
  }
}

export function seedOrdinaryE2EFixtures(
  workspace: ContextualContentTestWorkspace,
): void {
  seedSyntheticApprovedReviews(workspace, ["cup", "plate"]);
  clearSyntheticBatch03(workspace);
}

export function clearSyntheticBatch03(
  workspace: Pick<ContextualContentTestWorkspace, "reviewRoot" | "promotionRoot">,
): void {
  for (const slug of BATCH_03_SLUGS) {
    const spec = CONTENT_REVIEW_TARGETS.find((item) => item.targetSlug === slug);
    if (!spec) {
      continue;
    }
    rmSync(path.join(workspace.reviewRoot, spec.reviewKey), {
      recursive: true,
      force: true,
    });
  }
  rmSync(workspacePromotionPath(workspace), { force: true });
}

export function writeSyntheticStalePromotion(
  workspace: Pick<ContextualContentTestWorkspace, "promotionRoot">,
): string {
  const filePath = workspacePromotionPath(workspace);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(
    filePath,
    `${JSON.stringify(
      {
        schemaVersion: "candidate-v0",
        kind: "CONTEXTUAL_CONTENT_BATCH_PROMOTION",
        sceneId: "meal-scene-v0",
        packId: "meal-scene-expansion-batch-03",
        parentPackId: "meal-scene-expansion-batch-02",
        packFingerprint: "stale-pack",
        lineageFingerprint: "stale-lineage",
        targetApprovalBindings: [],
        decision: "PROMOTED",
        revision: 1,
        promotedAt: "2026-09-22T09:05:00.000Z",
        promotedBy: SYNTHETIC_TEST_PROMOTER,
      },
      null,
      2,
    )}\n`,
  );
  return filePath;
}
