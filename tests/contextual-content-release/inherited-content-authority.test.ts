import { describe, expect, it } from "vitest";
import {
  currentPackTargetFingerprint,
  experimentalMealContextLabPack,
  MEAL_LEGACY_EXPERIMENT_BASELINE,
  MEAL_SCENE_CONTENT_PACK,
  MEAL_SCENE_EXPANSION_BATCH_01_CUP_TARGET,
  MEAL_SCENE_EXPANSION_BATCH_01_PACK,
  MEAL_SCENE_EXPANSION_BATCH_02_PACK,
  MEAL_SCENE_EXPANSION_BATCH_02_PLATE_TARGET,
} from "@/contextual-learning/candidate-v0/content";
import { sameLexemeSense } from "@/contextual-learning/candidate-v0/domain/lexeme-sense";
import {
  fingerprintTargetAgainstApprovalSource,
  requiredCapabilityIdsForReleaseTargets,
  validateMealReleaseCapabilities,
} from "@/contextual-learning/candidate-v0/release";
import { fileContentReviewRepository } from "@/server/contextual-content-review/file-content-review-repository";
import { buildMealMigrationAuthority } from "@/server/contextual-content-release/authority";
import { createMealMigrationDraft } from "@/server/contextual-content-release/create-migration-draft";
import { InMemoryContextualContentReleaseRepository } from "@/server/contextual-content-release/in-memory-release-repository";
import { preflightContextualContentRelease } from "@/server/contextual-content-release/preflight-contextual-content-release";

const WRITE_ENV = {
  CONTEXTUAL_CONTENT_RELEASE_ENABLED: "1",
  CONTEXTUAL_CONTENT_RELEASE_WRITE_ENABLED: "1",
  CONTEXTUAL_RELEASE_RUNTIME: "memory",
};

function cloneCurrentPack() {
  return structuredClone(experimentalMealContextLabPack());
}

function driftLexeme(
  pack: ReturnType<typeof cloneCurrentPack>,
  id: string,
  mutate: (lexeme: (typeof pack)["lexemes"][number]) => void,
) {
  const lexeme = pack.lexemes.find((item) => item.id === id);
  if (!lexeme) {
    throw new Error(`missing ${id}`);
  }
  mutate(lexeme);
  return pack;
}

describe("inherited content must stay bound to historical approval fingerprints", () => {
  it("still creates and preflights the real six-word Meal snapshot", async () => {
    const repository = new InMemoryContextualContentReleaseRepository();
    const created = await createMealMigrationDraft({
      env: WRITE_ENV,
      repository,
      now: "2026-09-22T03:00:00.000Z",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      throw new Error(created.message);
    }
    const cupReview = await fileContentReviewRepository.get("meal-expansion-batch-01-cup");
    const plateReview = await fileContentReviewRepository.get("meal-expansion-batch-02-plate");
    for (const entry of created.record.targetEntries) {
      if (entry.approvalBasis === "LEGACY_EXPERIMENT_BASELINE") {
        const baseline = MEAL_SCENE_CONTENT_PACK.lexemes.find((item) =>
          sameLexemeSense(item.target, entry.target),
        )!;
        const current = created.record.packSnapshot.lexemes.find((item) =>
          sameLexemeSense(item.target, entry.target),
        )!;
        const baselineFp = currentPackTargetFingerprint(MEAL_SCENE_CONTENT_PACK, entry.target);
        const currentFp = fingerprintTargetAgainstApprovalSource({
          lexeme: current,
          approvalPackId: MEAL_LEGACY_EXPERIMENT_BASELINE.packId,
          approvalSourceRefs: MEAL_SCENE_CONTENT_PACK.provenance.sourceRefs,
        });
        expect(entry.contentFingerprint).toBe(baselineFp);
        expect(entry.contentFingerprint).toBe(currentFp);
        expect(sameLexemeSense(baseline.target, current.target)).toBe(true);
      }
      if (entry.reviewKey === "meal-expansion-batch-01-cup") {
        const current = created.record.packSnapshot.lexemes.find((item) =>
          sameLexemeSense(item.target, MEAL_SCENE_EXPANSION_BATCH_01_CUP_TARGET),
        )!;
        const reviewed = currentPackTargetFingerprint(
          MEAL_SCENE_EXPANSION_BATCH_01_PACK,
          MEAL_SCENE_EXPANSION_BATCH_01_CUP_TARGET,
        );
        const snapshot = fingerprintTargetAgainstApprovalSource({
          lexeme: current,
          approvalPackId: MEAL_SCENE_EXPANSION_BATCH_01_PACK.id,
          approvalSourceRefs: MEAL_SCENE_EXPANSION_BATCH_01_PACK.provenance.sourceRefs,
        });
        expect(entry.contentFingerprint).toBe(cupReview?.contentFingerprint);
        expect(entry.contentFingerprint).toBe(reviewed);
        expect(entry.contentFingerprint).toBe(snapshot);
      }
      if (entry.reviewKey === "meal-expansion-batch-02-plate") {
        const current = created.record.packSnapshot.lexemes.find((item) =>
          sameLexemeSense(item.target, MEAL_SCENE_EXPANSION_BATCH_02_PLATE_TARGET),
        )!;
        const reviewed = currentPackTargetFingerprint(
          MEAL_SCENE_EXPANSION_BATCH_02_PACK,
          MEAL_SCENE_EXPANSION_BATCH_02_PLATE_TARGET,
        );
        const snapshot = fingerprintTargetAgainstApprovalSource({
          lexeme: current,
          approvalPackId: MEAL_SCENE_EXPANSION_BATCH_02_PACK.id,
          approvalSourceRefs: MEAL_SCENE_EXPANSION_BATCH_02_PACK.provenance.sourceRefs,
        });
        expect(entry.contentFingerprint).toBe(plateReview?.contentFingerprint);
        expect(entry.contentFingerprint).toBe(reviewed);
        expect(entry.contentFingerprint).toBe(snapshot);
      }
    }
    const preflight = await preflightContextualContentRelease({
      releaseId: created.record.releaseId,
      revision: created.record.revision,
      env: WRITE_ENV,
      repository,
    });
    expect(preflight.ok).toBe(true);
    if (preflight.ok) {
      expect(preflight.record.status).toBe("PREFLIGHT_VALIDATED");
    }
  });

  it("rejects soup BUILD drift while keeping the same LexemeSenseRef", async () => {
    const pack = driftLexeme(cloneCurrentPack(), "meal-soup", (lexeme) => {
      lexeme.build.teachInstruction = `${lexeme.build.teachInstruction} drifted`;
    });
    const soup = pack.lexemes.find((item) => item.id === "meal-soup")!;
    const baseline = MEAL_SCENE_CONTENT_PACK.lexemes.find((item) => item.id === "meal-soup")!;
    expect(sameLexemeSense(soup.target, baseline.target)).toBe(true);
    const authority = await buildMealMigrationAuthority({ pack });
    expect(authority.issues.some((item) => item.code === "RELEASE_FINGERPRINT_DRIFT")).toBe(true);
    const created = await createMealMigrationDraft({
      env: WRITE_ENV,
      repository: new InMemoryContextualContentReleaseRepository(),
      pack,
    });
    expect(created.ok).toBe(false);
    expect(created.ok ? "" : created.message).toMatch(/soup|drift/i);
  });

  it("rejects bowl selector, contrast, or frame-binding drift", async () => {
    const selector = driftLexeme(cloneCurrentPack(), "meal-bowl", (lexeme) => {
      lexeme.lexicalPresentation.meaningGlossSelector = {
        kind: "EXACT_BUNDLED_VALUE",
        value: "不是碗",
      };
    });
    const contrast = driftLexeme(cloneCurrentPack(), "meal-bowl", (lexeme) => {
      lexeme.contrastBindings = lexeme.contrastBindings.map((item) => ({
        ...item,
        instruction: `${item.instruction} drifted`,
      }));
    });
    const binding = driftLexeme(cloneCurrentPack(), "meal-bowl", (lexeme) => {
      lexeme.membership.frameBindings = lexeme.membership.frameBindings.map((item) => ({
        ...item,
        sceneOrder: item.sceneOrder + 9,
      }));
    });
    for (const pack of [selector, contrast, binding]) {
      const authority = await buildMealMigrationAuthority({ pack });
      expect(authority.issues.some((item) => item.code === "RELEASE_FINGERPRINT_DRIFT")).toBe(true);
      const created = await createMealMigrationDraft({
        env: WRITE_ENV,
        repository: new InMemoryContextualContentReleaseRepository(),
        pack,
      });
      expect(created.ok).toBe(false);
    }
  });

  it("does not inherit a stale cup APPROVED when only the current snapshot changed", async () => {
    const pack = driftLexeme(cloneCurrentPack(), "meal-cup", (lexeme) => {
      lexeme.build.teachInstruction = `${lexeme.build.teachInstruction} inherited drift`;
    });
    const cup = pack.lexemes.find((item) => item.id === "meal-cup")!;
    expect(sameLexemeSense(cup.target, MEAL_SCENE_EXPANSION_BATCH_01_CUP_TARGET)).toBe(true);
    expect(
      currentPackTargetFingerprint(MEAL_SCENE_EXPANSION_BATCH_01_PACK, MEAL_SCENE_EXPANSION_BATCH_01_CUP_TARGET),
    ).toBe((await fileContentReviewRepository.get("meal-expansion-batch-01-cup"))?.contentFingerprint);
    const authority = await buildMealMigrationAuthority({ pack });
    const codes = authority.issues.map((item) => item.code);
    expect(codes).toContain("RELEASE_FINGERPRINT_DRIFT");
    expect(codes).toContain("RELEASE_REVIEW_STALE");
    expect(authority.targetEntries.some((item) => item.reviewKey === "meal-expansion-batch-01-cup")).toBe(false);
    const created = await createMealMigrationDraft({
      env: WRITE_ENV,
      repository: new InMemoryContextualContentReleaseRepository(),
      pack,
    });
    expect(created.ok).toBe(false);
  });

  it("rejects cup fingerprint-input drift such as source-bound presentation content", async () => {
    const pack = driftLexeme(cloneCurrentPack(), "meal-cup", (lexeme) => {
      lexeme.probe.recallInstruction = `${lexeme.probe.recallInstruction} drifted`;
    });
    const authority = await buildMealMigrationAuthority({ pack });
    expect(authority.issues.some((item) => item.code === "RELEASE_FINGERPRINT_DRIFT")).toBe(true);
    expect(
      (
        await createMealMigrationDraft({
          env: WRITE_ENV,
          repository: new InMemoryContextualContentReleaseRepository(),
          pack,
        })
      ).ok,
    ).toBe(false);
  });

  it("rejects plate inherited-content drift", async () => {
    const pack = driftLexeme(cloneCurrentPack(), "meal-plate", (lexeme) => {
      lexeme.strengthen.verifyInstruction = `${lexeme.strengthen.verifyInstruction} drifted`;
    });
    const authority = await buildMealMigrationAuthority({ pack });
    const codes = authority.issues.map((item) => item.code);
    expect(codes).toContain("RELEASE_FINGERPRINT_DRIFT");
    expect(codes).toContain("RELEASE_REVIEW_STALE");
    expect(
      (
        await createMealMigrationDraft({
          env: WRITE_ENV,
          repository: new InMemoryContextualContentReleaseRepository(),
          pack,
        })
      ).ok,
    ).toBe(false);
  });

  it("proves same LexemeSenseRef does not imply approved content equality", async () => {
    const pack = driftLexeme(cloneCurrentPack(), "meal-spoon", (lexeme) => {
      lexeme.build.connectInstruction = `${lexeme.build.connectInstruction} drifted`;
    });
    const current = pack.lexemes.find((item) => item.id === "meal-spoon")!;
    const baseline = MEAL_SCENE_CONTENT_PACK.lexemes.find((item) => item.id === "meal-spoon")!;
    expect(sameLexemeSense(current.target, baseline.target)).toBe(true);
    const authority = await buildMealMigrationAuthority({ pack });
    expect(authority.issues.length).toBeGreaterThan(0);
    expect(authority.issues.some((item) => item.code === "RELEASE_FINGERPRINT_DRIFT")).toBe(true);
    expect(authority.targetEntries.some((item) => item.reviewKey === "legacy-meal-baseline-spoon")).toBe(false);
  });

  it("refuses to mark a drifted snapshot PREFLIGHT_VALIDATED", async () => {
    const repository = new InMemoryContextualContentReleaseRepository();
    const created = await createMealMigrationDraft({
      env: WRITE_ENV,
      repository,
      now: "2026-09-22T03:00:01.000Z",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      throw new Error(created.message);
    }
    const drifted = driftLexeme(cloneCurrentPack(), "meal-fork", (lexeme) => {
      lexeme.build.fadeInstruction = `${lexeme.build.fadeInstruction} drifted`;
    });
    const result = await preflightContextualContentRelease({
      releaseId: created.record.releaseId,
      revision: created.record.revision,
      env: WRITE_ENV,
      repository,
      pack: drifted,
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("drifted preflight must fail");
    }
    expect(result.issues.some((item) => item.code === "RELEASE_FINGERPRINT_DRIFT")).toBe(true);
    const stored = await repository.get(created.record.releaseId);
    expect(stored?.status).toBe("DRAFT");
  });

  it("requires every Meal Probe/BUILD/STRENGTHEN capability, not a non-empty registry", () => {
    const pack = experimentalMealContextLabPack();
    const targets = pack.lexemes.map((item) => item.target);
    const required = requiredCapabilityIdsForReleaseTargets(targets);
    expect(required).toContain("frozen-text-input:TYPE");
    expect(required).toContain("frozen-text-input:RECALL");
    expect(required).toContain("frozen-choice:IDENTIFY");
    expect(validateMealReleaseCapabilities({ targets }).ok).toBe(true);
    expect(
      validateMealReleaseCapabilities({
        targets,
        capabilities: [
          {
            id: "frozen-choice:IDENTIFY",
            supportsAction: "IDENTIFY",
            responseKinds: ["ENTITY_REF"],
            supportsContextSnapshot: false,
            supportsHintReveal: true,
            compilerId: "candidate-v0-choice-adapter",
          },
        ],
      }).ok,
    ).toBe(false);
  });
});
