import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  MEAL_EXPANSION_BATCH_01_CUP_APPROVED_FINGERPRINT,
  MEAL_EXPANSION_BATCH_01_CUP_APPROVED_REVISION,
  MEAL_SCENE_CONTENT_PACK,
  MEAL_SCENE_EXPANSION_BATCH_01_CUP_PROMOTION,
  MEAL_SCENE_EXPANSION_BATCH_01_CUP_TARGET,
  MEAL_SCENE_EXPANSION_BATCH_01_PACK,
  MEAL_SCENE_EXPANSION_BATCH_01_PACK_ID,
  currentPackTargetFingerprint,
  getApprovedExperimentSceneContent,
  promotionAttestationMatchesPack,
  listSceneContentRegistry,
  registryEntryFor,
  registryStatusFor,
  validateExperimentPromotion,
} from "@/contextual-learning/candidate-v0/content";
import { compileSceneContentRegistryForTests } from "@/contextual-learning/candidate-v0/content/scene-content-registry";
import type { ContextualSceneContentRegistryEntry } from "@/contextual-learning/candidate-v0/content/types";

const RECORD_PATH =
  "docs/contextual-content-reviews/meal-expansion-batch-01-cup/human-review.record.json";
const MANIFEST_PATH =
  "docs/contextual-content-reviews/meal-expansion-batch-01-cup/REVIEW_MANIFEST.json";
const HUMAN_PATH =
  "docs/contextual-content-reviews/meal-expansion-batch-01-cup/HUMAN_REVIEW.md";
const PACKET_PATH =
  "docs/contextual-content-reviews/meal-expansion-batch-01-cup/REVIEW_PACKET.md";

function committedArtifacts() {
  return {
    reviewRecord: JSON.parse(readFileSync(RECORD_PATH, "utf8")),
    manifest: JSON.parse(readFileSync(MANIFEST_PATH, "utf8")),
    humanMarkdown: readFileSync(HUMAN_PATH, "utf8"),
    packetMarkdown: readFileSync(PACKET_PATH, "utf8"),
  };
}

function expansionEntry(): ContextualSceneContentRegistryEntry {
  return registryEntryFor(MEAL_SCENE_EXPANSION_BATCH_01_PACK_ID)!;
}

describe("fingerprint-bound cup experiment promotion", () => {
  it("accepts the exact approved fingerprint and committed review artifacts", () => {
    const entry = expansionEntry();
    const current = currentPackTargetFingerprint(
      MEAL_SCENE_EXPANSION_BATCH_01_PACK,
      MEAL_SCENE_EXPANSION_BATCH_01_CUP_TARGET,
    );
    expect(current).toBe(MEAL_EXPANSION_BATCH_01_CUP_APPROVED_FINGERPRINT);
    expect(
      validateExperimentPromotion({
        entry,
        expectedAttestation: MEAL_SCENE_EXPANSION_BATCH_01_CUP_PROMOTION,
        artifacts: committedArtifacts(),
      }),
    ).toEqual({ ok: true });
    expect(registryStatusFor(MEAL_SCENE_EXPANSION_BATCH_01_PACK_ID)).toBe(
      "APPROVED_FOR_EXPERIMENT",
    );
    expect(MEAL_SCENE_EXPANSION_BATCH_01_PACK.provenance.status).toBe(
      "APPROVED_FOR_EXPERIMENT",
    );
  });

  it("fails when pack content, target, packId, reviewKey, decision, fingerprint, or revision change", () => {
    const entry = expansionEntry();
    const artifacts = committedArtifacts();
    const changedPack = structuredClone(MEAL_SCENE_EXPANSION_BATCH_01_PACK);
    const cup = changedPack.lexemes.find((lexeme) => lexeme.id === "meal-cup")!;
    cup.build.teachInstruction = `${cup.build.teachInstruction} x`;
    expect(
      validateExperimentPromotion({
        entry: { ...entry, pack: changedPack },
        expectedAttestation: MEAL_SCENE_EXPANSION_BATCH_01_CUP_PROMOTION,
        artifacts,
      }).ok,
    ).toBe(false);
    expect(
      validateExperimentPromotion({
        entry,
        expectedAttestation: {
          ...MEAL_SCENE_EXPANSION_BATCH_01_CUP_PROMOTION,
          target: { ...MEAL_SCENE_EXPANSION_BATCH_01_CUP_TARGET, senseId: "other" },
        },
        artifacts,
      }).ok,
    ).toBe(false);
    expect(
      validateExperimentPromotion({
        entry,
        expectedAttestation: {
          ...MEAL_SCENE_EXPANSION_BATCH_01_CUP_PROMOTION,
          packId: "other-pack",
        },
        artifacts,
      }).ok,
    ).toBe(false);
    expect(
      validateExperimentPromotion({
        entry,
        expectedAttestation: {
          ...MEAL_SCENE_EXPANSION_BATCH_01_CUP_PROMOTION,
          reviewKey: "other-key",
        },
        artifacts,
      }).ok,
    ).toBe(false);
    expect(
      validateExperimentPromotion({
        entry,
        expectedAttestation: MEAL_SCENE_EXPANSION_BATCH_01_CUP_PROMOTION,
        artifacts: {
          ...artifacts,
          reviewRecord: { ...artifacts.reviewRecord, decision: "REVISE" },
        },
      }).ok,
    ).toBe(false);
    expect(
      validateExperimentPromotion({
        entry,
        expectedAttestation: MEAL_SCENE_EXPANSION_BATCH_01_CUP_PROMOTION,
        artifacts: {
          ...artifacts,
          reviewRecord: { ...artifacts.reviewRecord, contentFingerprint: "0".repeat(64) },
        },
      }).ok,
    ).toBe(false);
    expect(
      validateExperimentPromotion({
        entry,
        expectedAttestation: MEAL_SCENE_EXPANSION_BATCH_01_CUP_PROMOTION,
        artifacts: {
          ...artifacts,
          reviewRecord: { ...artifacts.reviewRecord, revision: 2 },
        },
      }).ok,
    ).toBe(false);
    expect(
      validateExperimentPromotion({
        entry,
        expectedAttestation: MEAL_SCENE_EXPANSION_BATCH_01_CUP_PROMOTION,
        artifacts: { reviewRecord: null },
      }).ok,
    ).toBe(false);
  });

  it("fails when any committed artifact is missing, empty, or contradictory", () => {
    const entry = expansionEntry();
    const artifacts = committedArtifacts();
    const missingRecord = validateExperimentPromotion({
      entry,
      expectedAttestation: MEAL_SCENE_EXPANSION_BATCH_01_CUP_PROMOTION,
      artifacts: { ...artifacts, reviewRecord: null },
    });
    const missingManifest = validateExperimentPromotion({
      entry,
      expectedAttestation: MEAL_SCENE_EXPANSION_BATCH_01_CUP_PROMOTION,
      artifacts: { ...artifacts, manifest: null },
    });
    const missingHuman = validateExperimentPromotion({
      entry,
      expectedAttestation: MEAL_SCENE_EXPANSION_BATCH_01_CUP_PROMOTION,
      artifacts: { ...artifacts, humanMarkdown: null },
    });
    const missingPacket = validateExperimentPromotion({
      entry,
      expectedAttestation: MEAL_SCENE_EXPANSION_BATCH_01_CUP_PROMOTION,
      artifacts: { ...artifacts, packetMarkdown: undefined },
    });
    const emptyHuman = validateExperimentPromotion({
      entry,
      expectedAttestation: MEAL_SCENE_EXPANSION_BATCH_01_CUP_PROMOTION,
      artifacts: { ...artifacts, humanMarkdown: "   " },
    });
    const contradictory = validateExperimentPromotion({
      entry,
      expectedAttestation: MEAL_SCENE_EXPANSION_BATCH_01_CUP_PROMOTION,
      artifacts: {
        ...artifacts,
        manifest: { ...artifacts.manifest, registryStatus: "CANDIDATE" },
      },
    });
    expect(missingRecord).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        { code: "PROMOTION_ARTIFACT_MISSING", path: "reviewRecord" },
      ]),
    });
    expect(missingManifest).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        { code: "PROMOTION_ARTIFACT_MISSING", path: "manifest" },
      ]),
    });
    expect(missingHuman).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        { code: "PROMOTION_ARTIFACT_MISSING", path: "HUMAN_REVIEW.md" },
      ]),
    });
    expect(missingPacket).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        { code: "PROMOTION_ARTIFACT_MISSING", path: "REVIEW_PACKET.md" },
      ]),
    });
    expect(emptyHuman).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        { code: "PROMOTION_ARTIFACT_MISSING", path: "HUMAN_REVIEW.md" },
      ]),
    });
    expect(contradictory).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        { code: "PROMOTION_ARTIFACT_CONFLICT", path: "manifest" },
      ]),
    });
    expect(
      validateExperimentPromotion({
        entry,
        expectedAttestation: MEAL_SCENE_EXPANSION_BATCH_01_CUP_PROMOTION,
        artifacts,
      }),
    ).toEqual({ ok: true });
  });

  it("fails closed without an attestation and keeps the registry immutable", () => {
    const compiled = compileSceneContentRegistryForTests([
      {
        packId: MEAL_SCENE_CONTENT_PACK.id,
        status: "APPROVED_FOR_EXPERIMENT",
        pack: MEAL_SCENE_CONTENT_PACK,
      },
      {
        packId: MEAL_SCENE_EXPANSION_BATCH_01_PACK_ID,
        status: "APPROVED_FOR_EXPERIMENT",
        pack: MEAL_SCENE_EXPANSION_BATCH_01_PACK,
      },
    ]);
    expect(compiled).toEqual([]);
    const listed = listSceneContentRegistry();
    expect(() => {
      (listed as unknown as { packId: string }[])[0]!.packId = "mutated";
    }).toThrow();
    expect(listed.some((entry) => entry.packId === MEAL_SCENE_CONTENT_PACK.id)).toBe(true);
    expect(
      compileSceneContentRegistryForTests([
        {
          packId: MEAL_SCENE_CONTENT_PACK.id,
          status: "APPROVED_FOR_EXPERIMENT",
          pack: MEAL_SCENE_CONTENT_PACK,
        },
        {
          packId: MEAL_SCENE_CONTENT_PACK.id,
          status: "APPROVED_FOR_EXPERIMENT",
          pack: MEAL_SCENE_CONTENT_PACK,
        },
      ]),
    ).toEqual([]);
  });

  it("keeps the original four-word pack identifiable beside the five-word expansion", () => {
    const original = getApprovedExperimentSceneContent(MEAL_SCENE_CONTENT_PACK.id);
    const expansion = getApprovedExperimentSceneContent(MEAL_SCENE_EXPANSION_BATCH_01_PACK_ID);
    expect(original.ok && original.pack.lexemes).toHaveLength(4);
    expect(original.ok && original.pack.lexemes.map((item) => item.id)).not.toContain("meal-cup");
    expect(expansion.ok && expansion.pack.lexemes).toHaveLength(5);
    expect(expansion.ok && expansion.pack.lexemes.map((item) => item.id)).toEqual([
      ...((original.ok && original.pack.lexemes.map((item) => item.id)) || []),
      "meal-cup",
    ]);
    expect(MEAL_SCENE_EXPANSION_BATCH_01_CUP_PROMOTION.promotionScope).toBe("EXPERIMENT_ONLY");
    expect(MEAL_SCENE_EXPANSION_BATCH_01_CUP_PROMOTION.approvedReviewRevision).toBe(
      MEAL_EXPANSION_BATCH_01_CUP_APPROVED_REVISION,
    );
  });
});

function compileExpansion(
  pack = MEAL_SCENE_EXPANSION_BATCH_01_PACK,
  promotion = MEAL_SCENE_EXPANSION_BATCH_01_CUP_PROMOTION,
) {
  return compileSceneContentRegistryForTests([
    {
      packId: MEAL_SCENE_CONTENT_PACK.id,
      status: "APPROVED_FOR_EXPERIMENT",
      approvalBasis: "LEGACY_EXPERIMENT_BASELINE",
      pack: MEAL_SCENE_CONTENT_PACK,
    },
    {
      packId: MEAL_SCENE_EXPANSION_BATCH_01_PACK_ID,
      status: "APPROVED_FOR_EXPERIMENT",
      approvalBasis: "HUMAN_REVIEW_PROMOTION",
      pack,
      promotion,
    },
  ]);
}

describe("registry compile fingerprint binding", () => {
  it("accepts the unchanged pack with the exact attestation", () => {
    const compiled = compileExpansion();
    expect(compiled).toHaveLength(2);
    expect(
      compiled.find((entry) => entry.packId === MEAL_SCENE_EXPANSION_BATCH_01_PACK_ID)
        ?.status,
    ).toBe("APPROVED_FOR_EXPERIMENT");
    const approved = getApprovedExperimentSceneContent(MEAL_SCENE_EXPANSION_BATCH_01_PACK_ID);
    expect(approved.ok).toBe(true);
    if (approved.ok) {
      expect(
        currentPackTargetFingerprint(
          approved.pack,
          MEAL_SCENE_EXPANSION_BATCH_01_CUP_TARGET,
        ),
      ).toBe(MEAL_EXPANSION_BATCH_01_CUP_APPROVED_FINGERPRINT);
    }
  });

  it("fail-closes compile when pack content, target, sourceRefs, or fingerprint drift", () => {
    const changedCopy = structuredClone(MEAL_SCENE_EXPANSION_BATCH_01_PACK);
    const cup = changedCopy.lexemes.find((lexeme) => lexeme.id === "meal-cup")!;
    cup.build.teachInstruction = `${cup.build.teachInstruction} x`;
    expect(compileExpansion(changedCopy)).toEqual([]);

    const changedTarget = structuredClone(MEAL_SCENE_EXPANSION_BATCH_01_PACK);
    const moved = changedTarget.lexemes.find((lexeme) => lexeme.id === "meal-cup")!;
    moved.target = { ...moved.target, senseId: "other-sense" };
    expect(compileExpansion(changedTarget)).toEqual([]);

    const missingTarget = structuredClone(MEAL_SCENE_EXPANSION_BATCH_01_PACK);
    missingTarget.lexemes = missingTarget.lexemes.filter((lexeme) => lexeme.id !== "meal-cup");
    expect(compileExpansion(missingTarget)).toEqual([]);

    const duplicateTarget = structuredClone(MEAL_SCENE_EXPANSION_BATCH_01_PACK);
    const duplicatedCup = structuredClone(
      duplicateTarget.lexemes.find((lexeme) => lexeme.id === "meal-cup")!,
    );
    duplicatedCup.id = "meal-cup-duplicate";
    duplicateTarget.lexemes.push(duplicatedCup);
    expect(compileExpansion(duplicateTarget)).toEqual([]);

    const changedRefs = structuredClone(MEAL_SCENE_EXPANSION_BATCH_01_PACK);
    changedRefs.provenance = {
      ...changedRefs.provenance,
      sourceRefs: [...changedRefs.provenance.sourceRefs, "docs/extra.md"],
    };
    expect(compileExpansion(changedRefs)).toEqual([]);

    expect(
      compileExpansion(MEAL_SCENE_EXPANSION_BATCH_01_PACK, {
        ...MEAL_SCENE_EXPANSION_BATCH_01_CUP_PROMOTION,
        approvedContentFingerprint: "0".repeat(64),
      }),
    ).toEqual([]);

    expect(
      promotionAttestationMatchesPack({
        ...expansionEntry(),
        pack: changedCopy,
      }),
    ).toBe(false);
    const live = getApprovedExperimentSceneContent(MEAL_SCENE_EXPANSION_BATCH_01_PACK_ID);
    expect(live.ok).toBe(true);
    if (live.ok) {
      expect(
        currentPackTargetFingerprint(
          live.pack,
          MEAL_SCENE_EXPANSION_BATCH_01_CUP_TARGET,
        ),
      ).toBe(MEAL_EXPANSION_BATCH_01_CUP_APPROVED_FINGERPRINT);
      expect(live.pack.lexemes.find((lexeme) => lexeme.id === "meal-cup")?.build.teachInstruction).toBe(
        MEAL_SCENE_EXPANSION_BATCH_01_PACK.lexemes.find((lexeme) => lexeme.id === "meal-cup")
          ?.build.teachInstruction,
      );
    }
  });
});

describe("review-record gitignore protection", () => {
  it("ignores future untracked review JSON and keeps the committed cup record", () => {
    const ignore = readFileSync(".gitignore", "utf8");
    expect(ignore).toContain("docs/contextual-content-reviews/**/human-review.record.json");
    expect(existsSync(RECORD_PATH)).toBe(true);
    const tracked = execFileSync("git", ["ls-files", RECORD_PATH], { encoding: "utf8" }).trim();
    expect(tracked).toBe(RECORD_PATH);
    const ignored = execFileSync(
      "git",
      ["check-ignore", "-q", "docs/contextual-content-reviews/future-target/human-review.record.json"],
      { encoding: "utf8" },
    );
    expect(ignored).toBe("");
  });
});
