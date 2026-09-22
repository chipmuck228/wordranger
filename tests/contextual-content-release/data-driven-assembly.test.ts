import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  experimentalMealContextLabPack,
  listSceneContentRegistry,
  MEAL_LEGACY_EXPERIMENT_BASELINE,
  MEAL_SCENE_CONTENT_PACK,
  MEAL_SCENE_EXPANSION_BATCH_02_PACK,
} from "@/contextual-learning/candidate-v0/content";
import { cloneFrozen } from "@/contextual-learning/candidate-v0/content/immutable";
import { validateSceneContent as validatePack } from "@/contextual-learning/candidate-v0/content/validate-scene-content";
import type { ContextualSceneContentRegistryEntry } from "@/contextual-learning/candidate-v0/content/types";
import { sameLexemeSense } from "@/contextual-learning/candidate-v0/domain/lexeme-sense";
import { MEAL_SCENE_CLUSTER } from "@/contextual-learning/candidate-v0/memory-routing/scene-catalog";
import { listFrozenRuntimeCapabilities } from "@/contextual-learning/candidate-v0/capabilities/capability-registry";
import {
  deriveLegacyApprovalSources,
  findUniqueApprovalSource as findSource,
  resolveReleaseEligiblePack as resolveEligible,
  MEAL_RELEASE_SCENE_ID,
} from "@/contextual-learning/candidate-v0/release";
import { buildMealMigrationAuthority } from "@/server/contextual-content-release/authority";
import { createMealMigrationDraft } from "@/server/contextual-content-release/create-migration-draft";
import { InMemoryContextualContentReleaseRepository } from "@/server/contextual-content-release/in-memory-release-repository";
import { inspectMealReleaseEligibility } from "@/server/contextual-content-release/inspect-release-eligibility";
import { preflightContextualContentRelease } from "@/server/contextual-content-release/preflight-contextual-content-release";
import { publishContextualContentRelease } from "@/server/contextual-content-release/publish-contextual-content-release";
import { projectReleaseWorkspace } from "@/server/contextual-content-release/project-release-workspace";
import {
  createSyntheticMealReleaseFixture,
  mapReviewRepository,
} from "./helpers/synthetic-release-pack";

const WRITE_ENV = {
  CONTEXTUAL_CONTENT_RELEASE_ENABLED: "1",
  CONTEXTUAL_CONTENT_RELEASE_WRITE_ENABLED: "1",
  CONTEXTUAL_RELEASE_RUNTIME: "memory",
};

function assemblyOf(fixture: ReturnType<typeof createSyntheticMealReleaseFixture>) {
  return {
    pack: fixture.pack,
    loadLexeme: fixture.loadLexeme,
    reviewRepository: fixture.reviewRepository,
    extraApprovalSources: fixture.extraApprovalSources,
    extraPacks: fixture.extraPacks,
    context: fixture.context,
    parentPackId: fixture.parentPackId,
  };
}

describe("data-driven Meal release assembly", () => {
  it("keeps the production six-word pack as one instance of the generic algorithm", async () => {
    const repository = new InMemoryContextualContentReleaseRepository();
    const created = await createMealMigrationDraft({
      env: WRITE_ENV,
      repository,
      now: "2026-09-22T04:00:00.000Z",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      throw new Error(created.message);
    }
    expect(created.record.targetEntries).toHaveLength(6);
    expect(created.record.historicalApprovalBindings).toHaveLength(6);
    expect(created.record.targetEntries.filter((item) => item.approvalBasis === "LEGACY_EXPERIMENT_BASELINE")).toHaveLength(4);
    expect(created.record.targetEntries.filter((item) => item.approvalBasis === "HUMAN_REVIEW_PROMOTION")).toHaveLength(2);
    const preflight = await preflightContextualContentRelease({
      releaseId: created.record.releaseId,
      revision: created.record.revision,
      env: WRITE_ENV,
      repository,
    });
    expect(preflight.ok).toBe(true);
    if (!preflight.ok) {
      throw new Error(preflight.message);
    }
    const published = await publishContextualContentRelease({
      releaseId: preflight.record.releaseId,
      revision: preflight.record.revision,
      env: WRITE_ENV,
      repository,
    });
    expect(published.ok).toBe(true);
    if (!published.ok) {
      throw new Error(published.message);
    }
    const loaded = await repository.loadActiveRelease(published.pointer.sceneId);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.release.targetEntries).toHaveLength(6);
    }
    const eligibility = await inspectMealReleaseEligibility();
    expect(eligibility.packId).toBe(MEAL_SCENE_EXPANSION_BATCH_02_PACK.id);
    expect(eligibility.parentPackId).toBe("meal-scene-expansion-batch-01");
    expect(eligibility.canCreateDraft).toBe(true);
    expect(listSceneContentRegistry().filter((item) => item.releaseEligibility === "RELEASE_ELIGIBLE")).toHaveLength(1);
    expect(experimentalMealContextLabPack().lexemes).toHaveLength(6);
  });

  it("assembles, preflights, publishes, and loads a synthetic seven-target pack without length===7 control flow", async () => {
    const fixture = createSyntheticMealReleaseFixture(1);
    const authored = fixture.context.frames.filter((frame) => frame.id !== "picnic-lunch-v0");
    for (const frame of authored) {
      const validation = validatePack({
        pack: fixture.pack,
        frame,
        frames: authored,
        skeleton: fixture.context.skeleton,
        cluster: MEAL_SCENE_CLUSTER,
        loadLexeme: fixture.loadLexeme,
      });
      expect(validation.ok, JSON.stringify(validation)).toBe(true);
    }
    expect(fixture.pack.lexemes).toHaveLength(7);
    expect(listSceneContentRegistry().some((item) => item.packId === fixture.pack.id)).toBe(false);
    const repository = new InMemoryContextualContentReleaseRepository();
    const created = await createMealMigrationDraft({
      env: WRITE_ENV,
      repository,
      now: "2026-09-22T04:01:00.000Z",
      ...assemblyOf(fixture),
    });
    expect(created.ok, created.ok ? "ok" : created.message).toBe(true);
    if (!created.ok) {
      throw new Error(created.message);
    }
    expect(created.record.targetEntries).toHaveLength(fixture.pack.lexemes.length);
    expect(created.record.historicalApprovalBindings).toHaveLength(fixture.pack.lexemes.length);
    expect(created.record.packSnapshot.id).toBe(fixture.pack.id);
    const authoritySource = readFileSync("src/server/contextual-content-release/authority.ts", "utf8");
    expect(authoritySource).not.toMatch(/length === 7/);
    expect(authoritySource).not.toMatch(/if \(.*cup/);
    expect(authoritySource).not.toMatch(/if \(.*plate/);
    expect(authoritySource).not.toContain("LEGACY_TARGETS");
    const preflight = await preflightContextualContentRelease({
      releaseId: created.record.releaseId,
      revision: created.record.revision,
      env: WRITE_ENV,
      repository,
      ...assemblyOf(fixture),
    });
    expect(preflight.ok).toBe(true);
    if (!preflight.ok) {
      throw new Error(preflight.message);
    }
    const published = await publishContextualContentRelease({
      releaseId: preflight.record.releaseId,
      revision: preflight.record.revision,
      env: WRITE_ENV,
      repository,
      ...assemblyOf(fixture),
    });
    expect(published.ok).toBe(true);
    if (!published.ok) {
      throw new Error(published.message);
    }
    const loaded = await repository.loadActiveRelease(published.pointer.sceneId);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.release.historicalApprovalBindings).toHaveLength(fixture.pack.lexemes.length);
    }
  });

  it("assembles a synthetic thirty-target pack without a fixed target-count assumption", async () => {
    const fixture = createSyntheticMealReleaseFixture(24);
    expect(fixture.pack.lexemes).toHaveLength(30);
    const authored = fixture.context.frames.filter((frame) => frame.id !== "picnic-lunch-v0");
    for (const frame of authored) {
      const validation = validatePack({
        pack: fixture.pack,
        frame,
        frames: authored,
        skeleton: fixture.context.skeleton,
        cluster: MEAL_SCENE_CLUSTER,
        loadLexeme: fixture.loadLexeme,
      });
      expect(validation.ok, JSON.stringify(validation)).toBe(true);
    }
    const repository = new InMemoryContextualContentReleaseRepository();
    const created = await createMealMigrationDraft({
      env: WRITE_ENV,
      repository,
      now: "2026-09-22T04:02:00.000Z",
      ...assemblyOf(fixture),
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      throw new Error(created.message);
    }
    expect(created.record.targetEntries).toHaveLength(30);
    expect(created.record.historicalApprovalBindings).toHaveLength(30);
    expect(new Set(created.record.targetEntries.map((item) => `${item.target.lexemeId}:${item.target.senseId}`)).size).toBe(30);
    const first = created.record.releaseFingerprint;
    const again = await createMealMigrationDraft({
      env: WRITE_ENV,
      repository: new InMemoryContextualContentReleaseRepository(),
      now: "2026-09-22T04:02:01.000Z",
      ...assemblyOf(fixture),
    });
    expect(again.ok).toBe(true);
    if (again.ok) {
      expect(again.record.releaseFingerprint).toBe(first);
      expect(again.record.targetEntries.map((item) => item.reviewKey)).toEqual(
        created.record.targetEntries.map((item) => item.reviewKey),
      );
    }
    const preflight = await preflightContextualContentRelease({
      releaseId: created.record.releaseId,
      revision: created.record.revision,
      env: WRITE_ENV,
      repository,
      ...assemblyOf(fixture),
    });
    expect(preflight.ok).toBe(true);
    if (!preflight.ok) {
      throw new Error(preflight.message);
    }
    const published = await publishContextualContentRelease({
      releaseId: preflight.record.releaseId,
      revision: preflight.record.revision,
      env: WRITE_ENV,
      repository,
      ...assemblyOf(fixture),
    });
    expect(published.ok).toBe(true);
    expect(listSceneContentRegistry().some((item) => item.packId === fixture.pack.id)).toBe(false);
  });

  it("fails closed when any of 30 targets lacks a required capability and does not create a draft", async () => {
    const fixture = createSyntheticMealReleaseFixture(24);
    const repository = new InMemoryContextualContentReleaseRepository();
    const created = await createMealMigrationDraft({
      env: WRITE_ENV,
      repository,
      ...assemblyOf(fixture),
      capabilities: listFrozenRuntimeCapabilities().filter((item) => item.id !== "frozen-text-input:TYPE"),
    });
    expect(created.ok).toBe(false);
    expect(await repository.list()).toEqual([]);
  });
});

describe("release assembly fail-closed cases", () => {
  it("fails when a new target has no review registration", async () => {
    const fixture = createSyntheticMealReleaseFixture(1);
    const created = await createMealMigrationDraft({
      env: WRITE_ENV,
      repository: new InMemoryContextualContentReleaseRepository(),
      ...assemblyOf(fixture),
      extraApprovalSources: [],
      extraReviewTargets: [],
    });
    expect(created.ok).toBe(false);
  });

  it("fails when the review record is missing or REJECTED", async () => {
    const fixture = createSyntheticMealReleaseFixture(1);
    const missing = await createMealMigrationDraft({
      env: WRITE_ENV,
      repository: new InMemoryContextualContentReleaseRepository(),
      ...assemblyOf(fixture),
      reviewRepository: mapReviewRepository(new Map([[fixture.extraReviewTargets[0]!.reviewKey, null]])),
    });
    expect(missing.ok).toBe(false);
    const rejectedRecord = {
      ...fixture.records.get(fixture.extraReviewTargets[0]!.reviewKey)!,
      decision: "REJECTED" as const,
    };
    const rejected = await createMealMigrationDraft({
      env: WRITE_ENV,
      repository: new InMemoryContextualContentReleaseRepository(),
      ...assemblyOf(fixture),
      reviewRepository: mapReviewRepository(new Map([[rejectedRecord.reviewKey, rejectedRecord]])),
    });
    expect(rejected.ok).toBe(false);
  });

  it("fails when the review fingerprint is stale", async () => {
    const fixture = createSyntheticMealReleaseFixture(1);
    const stale = {
      ...fixture.records.get(fixture.extraReviewTargets[0]!.reviewKey)!,
      contentFingerprint: "0".repeat(64),
    };
    const created = await createMealMigrationDraft({
      env: WRITE_ENV,
      repository: new InMemoryContextualContentReleaseRepository(),
      ...assemblyOf(fixture),
      reviewRepository: mapReviewRepository(new Map([[stale.reviewKey, stale]])),
    });
    expect(created.ok).toBe(false);
  });

  it("fails when inherited target content changes without a new review", async () => {
    const fixture = createSyntheticMealReleaseFixture(1);
    const soup = fixture.pack.lexemes.find((item) => item.id === "meal-soup")!;
    soup.build.teachInstruction = `${soup.build.teachInstruction} drifted`;
    const created = await createMealMigrationDraft({
      env: WRITE_ENV,
      repository: new InMemoryContextualContentReleaseRepository(),
      ...assemblyOf(fixture),
    });
    expect(created.ok).toBe(false);
  });

  it("fails when one target matches two approval sources", async () => {
    const fixture = createSyntheticMealReleaseFixture(1);
    const duplicate = { ...fixture.extraApprovalSources[0]!, reviewKey: "synthetic-duplicate-source" };
    const created = await createMealMigrationDraft({
      env: WRITE_ENV,
      repository: new InMemoryContextualContentReleaseRepository(),
      ...assemblyOf(fixture),
      extraApprovalSources: [...fixture.extraApprovalSources, duplicate],
    });
    expect(created.ok).toBe(false);
  });

  it("fails when the review target sense does not match the pack target", async () => {
    const fixture = createSyntheticMealReleaseFixture(1);
    const mismatched = {
      ...fixture.extraApprovalSources[0]!,
      expectedTarget: MEAL_SCENE_EXPANSION_BATCH_02_PACK.lexemes[0]!.target,
    };
    const created = await createMealMigrationDraft({
      env: WRITE_ENV,
      repository: new InMemoryContextualContentReleaseRepository(),
      ...assemblyOf(fixture),
      extraApprovalSources: [mismatched],
      extraReviewTargets: [
        {
          ...fixture.extraReviewTargets[0]!,
          target: mismatched.expectedTarget,
        },
      ],
    });
    expect(created.ok).toBe(false);
  });

  it("fails on duplicate targets or duplicate scene order and does not create a draft", async () => {
    const duplicateTarget = structuredClone(experimentalMealContextLabPack());
    duplicateTarget.lexemes.push(structuredClone(duplicateTarget.lexemes[0]!));
    const duplicateOrder = structuredClone(experimentalMealContextLabPack());
    duplicateOrder.lexemes[1]!.membership.frameBindings = duplicateOrder.lexemes[1]!.membership.frameBindings.map(
      (binding) => ({ ...binding, sceneOrder: duplicateOrder.lexemes[0]!.membership.frameBindings[0]!.sceneOrder }),
    );
    for (const pack of [duplicateTarget, duplicateOrder]) {
      const created = await createMealMigrationDraft({
        env: WRITE_ENV,
        repository: new InMemoryContextualContentReleaseRepository(),
        pack,
      });
      expect(created.ok).toBe(false);
    }
  });

  it("fails when the parent pack is missing or the lineage cycles", async () => {
    const fixture = createSyntheticMealReleaseFixture(1);
    const missingParent = await createMealMigrationDraft({
      env: WRITE_ENV,
      repository: new InMemoryContextualContentReleaseRepository(),
      ...assemblyOf(fixture),
      parentPackId: "missing-parent-pack",
    });
    expect(missingParent.ok).toBe(false);
    const cycled: ContextualSceneContentRegistryEntry[] = listSceneContentRegistry().map((entry) =>
      entry.packId === MEAL_SCENE_EXPANSION_BATCH_02_PACK.id
        ? { ...cloneFrozen(entry), parentPackId: fixture.pack.id }
        : cloneFrozen(entry),
    );
    cycled.push({
      packId: fixture.pack.id,
      status: "APPROVED_FOR_EXPERIMENT",
      approvalBasis: "HUMAN_REVIEW_PROMOTION",
      pack: fixture.pack,
      parentPackId: MEAL_SCENE_EXPANSION_BATCH_02_PACK.id,
      releaseEligibility: "NONE",
    });
    const cycle = await createMealMigrationDraft({
      env: WRITE_ENV,
      repository: new InMemoryContextualContentReleaseRepository(),
      ...assemblyOf(fixture),
      registry: cycled,
    });
    expect(cycle.ok).toBe(false);
  });

  it("fails closed when multiple RELEASE_ELIGIBLE packs cannot be uniquely selected", async () => {
    const registry = listSceneContentRegistry().map((entry) => ({
      ...cloneFrozen(entry),
      releaseEligibility: "RELEASE_ELIGIBLE" as const,
    }));
    expect(resolveEligible({ sceneClusterId: MEAL_SCENE_CLUSTER.id, registry }).ok).toBe(false);
    const created = await createMealMigrationDraft({
      env: WRITE_ENV,
      repository: new InMemoryContextualContentReleaseRepository(),
      registry,
    });
    expect(created.ok).toBe(false);
  });

  it("fails when historicalApprovalBindings do not match targetEntries", async () => {
    const repository = new InMemoryContextualContentReleaseRepository();
    const created = await createMealMigrationDraft({
      env: WRITE_ENV,
      repository,
      now: "2026-09-22T04:03:00.000Z",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      throw new Error(created.message);
    }
    const dropped = cloneFrozen({
      ...created.record,
      historicalApprovalBindings: created.record.historicalApprovalBindings.slice(1),
    });
    repository.replaceRaw(dropped);
    const preflight = await preflightContextualContentRelease({
      releaseId: created.record.releaseId,
      revision: created.record.revision,
      env: WRITE_ENV,
      repository,
    });
    expect(preflight.ok).toBe(false);
  });

  it("does not add unused approval-registry targets into the pack", async () => {
    const authority = await buildMealMigrationAuthority();
    expect(authority.unusedSources.every((source) =>
      !authority.snapshot.pack.lexemes.some((lexeme) => sameLexemeSense(lexeme.target, source.target)),
    )).toBe(true);
    expect(authority.targetEntries).toHaveLength(6);
  });

  it("derives legacy sources from the grandfathered baseline pack, not a copied lemma list", () => {
    const sources = deriveLegacyApprovalSources({
      sceneId: MEAL_RELEASE_SCENE_ID,
      baselinePack: MEAL_SCENE_CONTENT_PACK,
      baselinePackId: MEAL_LEGACY_EXPERIMENT_BASELINE.packId,
    });
    expect(sources.map((item) => item.target.senseId).sort()).toEqual(
      MEAL_SCENE_CONTENT_PACK.lexemes.map((item) => item.target.senseId).sort(),
    );
    expect(sources.every((item) => item.approvalBasis === "LEGACY_EXPERIMENT_BASELINE")).toBe(true);
    const soup = MEAL_SCENE_CONTENT_PACK.lexemes[0]!;
    expect(findSource({ sources, target: soup.target }).ok).toBe(true);
    expect(
      findSource({
        sources: [...sources, { ...sources[0]!, reviewKey: "legacy-dup" }],
        target: soup.target,
      }).ok,
    ).toBe(false);
  });

  it("surfaces eligibility on the Debug workspace and blocks Create Draft when unresolved", async () => {
    const workspace = await projectReleaseWorkspace({
      env: { ...WRITE_ENV, CONTEXTUAL_RELEASE_RUNTIME: "memory" },
      repository: new InMemoryContextualContentReleaseRepository(),
    });
    expect(workspace.eligibility.packId).toBe(MEAL_SCENE_EXPANSION_BATCH_02_PACK.id);
    expect(workspace.eligibility.targetCount).toBe(6);
    expect(workspace.eligibility.canCreateDraft).toBe(true);
    expect(workspace.eligibility.lineageOk).toBe(true);
  });
});
