import { describe, expect, it } from "vitest";
import {
  MEAL_SCENE_EXPANSION_BATCH_02_PACK,
  MEAL_SCENE_EXPANSION_BATCH_03_PACK,
  evaluateBatchPromotionReadiness,
  listSceneContentRegistry,
  registryEntryFor,
} from "@/contextual-learning/candidate-v0/content";
import { MEAL_SCENE_CLUSTER } from "@/contextual-learning/candidate-v0/memory-routing/scene-catalog";
import { MEAL_BATCH_03_FRAMES } from "@/contextual-learning/candidate-v0/fixtures/meal/meal-batch-03-contexts";
import { mealBatch03Skeleton } from "@/contextual-learning/candidate-v0/fixtures/meal/meal-batch-03-skeleton";
import { bundledSceneLexemeLoader } from "@/server/runtime/bundled-scene-lexeme-loader";
import { CONTENT_REVIEW_TARGETS } from "@/server/contextual-content-review/review-target-registry";
import { currentContentFingerprint } from "@/server/contextual-content-review/project-review-packet";

const authoredFrames = MEAL_BATCH_03_FRAMES.filter((item) => item.id !== "picnic-lunch-v0");
const reviewTargets = CONTENT_REVIEW_TARGETS.map((item) => ({
  reviewKey: item.reviewKey,
  packId: item.packId,
  target: item.target,
  sourceRefs: item.sourceRefs,
}));

function approvedRecords() {
  return CONTENT_REVIEW_TARGETS.filter((item) => item.packId === MEAL_SCENE_EXPANSION_BATCH_03_PACK.id).map(
    (spec) => ({
      reviewKey: spec.reviewKey,
      packId: spec.packId,
      target: spec.target,
      contentFingerprint: currentContentFingerprint(spec)!,
      decision: "APPROVED",
      revision: 1,
    }),
  );
}

function readiness(overrides: Partial<Parameters<typeof evaluateBatchPromotionReadiness>[0]> = {}) {
  return evaluateBatchPromotionReadiness({
    pack: MEAL_SCENE_EXPANSION_BATCH_03_PACK,
    registryEntry: registryEntryFor(MEAL_SCENE_EXPANSION_BATCH_03_PACK.id),
    reviewTargets,
    reviewRecords: [],
    parentPack: MEAL_SCENE_EXPANSION_BATCH_02_PACK,
    registry: listSceneContentRegistry(),
    frames: authoredFrames,
    skeleton: mealBatch03Skeleton,
    cluster: MEAL_SCENE_CLUSTER,
    loadLexeme: bundledSceneLexemeLoader,
    blockedPlannedLemmas: ["napkin"],
    ...overrides,
  });
}

describe("batch promotion readiness", () => {
  it("rejects pending, partial, rejected, and stale reviews", () => {
    expect(readiness().ok).toBe(false);
    expect(readiness().issues.some((item) => item.code === "PROMOTION_REVIEW_PENDING")).toBe(true);
    const twoApproved = approvedRecords().slice(0, 2);
    expect(readiness({ reviewRecords: twoApproved }).ok).toBe(false);
    const rejected = approvedRecords().map((item, index) =>
      index === 0 ? { ...item, decision: "REJECTED" } : item,
    );
    expect(readiness({ reviewRecords: rejected }).issues.some((item) => item.code === "PROMOTION_REVIEW_REJECTED")).toBe(
      true,
    );
    const stale = approvedRecords().map((item, index) =>
      index === 0 ? { ...item, contentFingerprint: "stale" } : item,
    );
    expect(readiness({ reviewRecords: stale }).issues.some((item) => item.code === "PROMOTION_REVIEW_STALE")).toBe(true);
  });

  it("is ready when knife/bread/water are APPROVED and napkin stays blocked outside the pack", () => {
    const result = readiness({ reviewRecords: approvedRecords() });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    expect(result.bindings).toHaveLength(3);
    expect(result.bindings.every((item) => item.reviewDecision === "APPROVED")).toBe(true);
    expect(MEAL_SCENE_EXPANSION_BATCH_03_PACK.lexemes.some((item) => /napkin/i.test(item.id))).toBe(false);
  });

  it("fail-closes on identity mismatch, missing registration, duplicate keys, drift, and cycles", () => {
    const mismatch = approvedRecords().map((item, index) =>
      index === 0 ? { ...item, target: { lexemeId: "other", senseId: item.target.senseId } } : item,
    );
    expect(readiness({ reviewRecords: mismatch }).issues.some((item) => item.code === "PROMOTION_REVIEW_MISMATCH")).toBe(
      true,
    );
    expect(
      readiness({
        reviewRecords: approvedRecords(),
        reviewTargets: reviewTargets.filter((item) => item.reviewKey !== "meal-expansion-batch-03-knife"),
      }).issues.some((item) => item.code === "PROMOTION_REVIEW_MISSING"),
    ).toBe(true);
    const knife = reviewTargets.find((item) => item.reviewKey === "meal-expansion-batch-03-knife")!;
    expect(
      readiness({
        reviewRecords: approvedRecords(),
        reviewTargets: [...reviewTargets, { ...knife, packId: knife.packId }],
      }).issues.some((item) => item.code === "PROMOTION_REVIEW_DUPLICATE"),
    ).toBe(true);
    const drifted = structuredClone(MEAL_SCENE_EXPANSION_BATCH_03_PACK);
    drifted.lexemes.find((item) => item.id === "meal-cup")!.build.teachInstruction += " x";
    expect(
      readiness({ pack: drifted, reviewRecords: approvedRecords() }).issues.some(
        (item) => item.code === "PROMOTION_INHERITED_DRIFT",
      ),
    ).toBe(true);
    const cycled = listSceneContentRegistry().map((entry) =>
      entry.packId === MEAL_SCENE_EXPANSION_BATCH_03_PACK.id
        ? { ...entry, parentPackId: MEAL_SCENE_EXPANSION_BATCH_03_PACK.id }
        : entry,
    );
    expect(
      readiness({
        reviewRecords: approvedRecords(),
        registry: cycled,
        registryEntry: { ...registryEntryFor(MEAL_SCENE_EXPANSION_BATCH_03_PACK.id)!, parentPackId: MEAL_SCENE_EXPANSION_BATCH_03_PACK.id },
      }).issues.some((item) => item.code === "PROMOTION_LINEAGE_CYCLE"),
    ).toBe(true);
  });
});
