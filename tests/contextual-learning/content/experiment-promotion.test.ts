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
