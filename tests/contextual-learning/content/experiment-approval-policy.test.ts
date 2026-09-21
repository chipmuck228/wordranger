import { describe, expect, it } from "vitest";
import {
  MEAL_SCENE_CONTENT_PACK,
  MEAL_SCENE_EXPANSION_BATCH_01_CUP_PROMOTION,
  MEAL_SCENE_EXPANSION_BATCH_01_PACK,
  MEAL_SCENE_EXPANSION_BATCH_01_PACK_ID,
  MEAL_SCENE_EXPANSION_BATCH_02_PACK,
  MEAL_SCENE_EXPANSION_BATCH_02_PACK_ID,
  getApprovedExperimentSceneContent,
  listSceneContentRegistry,
} from "@/contextual-learning/candidate-v0/content";
import { compileSceneContentRegistryForTests } from "@/contextual-learning/candidate-v0/content/scene-content-registry";

const legacy = {
  packId: MEAL_SCENE_CONTENT_PACK.id,
  status: "APPROVED_FOR_EXPERIMENT" as const,
  approvalBasis: "LEGACY_EXPERIMENT_BASELINE" as const,
  pack: MEAL_SCENE_CONTENT_PACK,
};

const promoted = {
  packId: MEAL_SCENE_EXPANSION_BATCH_01_PACK_ID,
  status: "APPROVED_FOR_EXPERIMENT" as const,
  approvalBasis: "HUMAN_REVIEW_PROMOTION" as const,
  pack: MEAL_SCENE_EXPANSION_BATCH_01_PACK,
  promotion: MEAL_SCENE_EXPANSION_BATCH_01_CUP_PROMOTION,
};

describe("generic experiment approval policy", () => {
  it("loads an explicit legacy baseline and a fingerprint-bound promotion", () => {
    const compiled = compileSceneContentRegistryForTests([legacy, promoted]);
    expect(compiled).toHaveLength(2);
    expect(compiled[0]?.approvalBasis).toBe("LEGACY_EXPERIMENT_BASELINE");
    expect(compiled[1]?.approvalBasis).toBe("HUMAN_REVIEW_PROMOTION");
  });

  it("rejects an approved entry that does not declare an approval basis", () => {
    expect(
      compileSceneContentRegistryForTests([
        {
          packId: MEAL_SCENE_CONTENT_PACK.id,
          status: "APPROVED_FOR_EXPERIMENT",
          pack: MEAL_SCENE_CONTENT_PACK,
        },
      ]),
    ).toEqual([]);
  });

  it("rejects human-review approval without an attestation", () => {
    expect(
      compileSceneContentRegistryForTests([
        legacy,
        {
          packId: MEAL_SCENE_EXPANSION_BATCH_01_PACK_ID,
          status: "APPROVED_FOR_EXPERIMENT",
          approvalBasis: "HUMAN_REVIEW_PROMOTION",
          pack: MEAL_SCENE_EXPANSION_BATCH_01_PACK,
        },
      ]),
    ).toEqual([]);
  });

  it("allows CANDIDATE without attestation and rejects a future pack that skips promotion", () => {
    expect(
      compileSceneContentRegistryForTests([
        {
          packId: MEAL_SCENE_EXPANSION_BATCH_02_PACK_ID,
          status: "CANDIDATE",
          pack: MEAL_SCENE_EXPANSION_BATCH_02_PACK,
        },
      ]),
    ).toHaveLength(1);
    const future = structuredClone(MEAL_SCENE_EXPANSION_BATCH_02_PACK);
    future.id = "meal-scene-expansion-batch-99";
    future.provenance = { ...future.provenance, status: "APPROVED_FOR_EXPERIMENT" };
    expect(
      compileSceneContentRegistryForTests([
        {
          packId: future.id,
          status: "APPROVED_FOR_EXPERIMENT",
          pack: future,
        },
      ]),
    ).toEqual([]);
    expect(
      compileSceneContentRegistryForTests([
        {
          packId: future.id,
          status: "APPROVED_FOR_EXPERIMENT",
          approvalBasis: "LEGACY_EXPERIMENT_BASELINE",
          pack: future,
        },
      ]),
    ).toHaveLength(1);
    expect(
      compileSceneContentRegistryForTests([
        {
          packId: future.id,
          status: "APPROVED_FOR_EXPERIMENT",
          approvalBasis: "HUMAN_REVIEW_PROMOTION",
          pack: future,
        },
      ]),
    ).toEqual([]);
  });

  it("rejects fingerprint drift and duplicate IDs, and keeps the live registry immutable", () => {
    const drifted = structuredClone(MEAL_SCENE_EXPANSION_BATCH_01_PACK);
    const cup = drifted.lexemes.find((lexeme) => lexeme.id === "meal-cup")!;
    cup.build.teachInstruction += " x";
    expect(
      compileSceneContentRegistryForTests([
        legacy,
        { ...promoted, pack: drifted },
      ]),
    ).toEqual([]);
    expect(compileSceneContentRegistryForTests([legacy, legacy])).toEqual([]);
    const listed = listSceneContentRegistry();
    expect(listed.some((entry) => entry.packId === MEAL_SCENE_EXPANSION_BATCH_02_PACK_ID)).toBe(
      true,
    );
    expect(() => {
      (listed as unknown as { packId: string }[])[0]!.packId = "mutated";
    }).toThrow();
    expect(getApprovedExperimentSceneContent(MEAL_SCENE_EXPANSION_BATCH_02_PACK_ID).ok).toBe(
      false,
    );
  });
});
