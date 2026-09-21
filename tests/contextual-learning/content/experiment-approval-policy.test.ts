import { describe, expect, it } from "vitest";
import {
  MEAL_LEGACY_EXPERIMENT_BASELINE,
  MEAL_SCENE_CONTENT_PACK,
  MEAL_SCENE_EXPANSION_BATCH_01_CUP_PROMOTION,
  MEAL_SCENE_EXPANSION_BATCH_01_PACK,
  MEAL_SCENE_EXPANSION_BATCH_01_PACK_ID,
  MEAL_SCENE_EXPANSION_BATCH_02_PACK,
  getApprovedExperimentSceneContent,
  listSceneContentRegistry,
  matchesLegacyExperimentBaseline,
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

function futurePack(id = "meal-scene-expansion-batch-99") {
  const pack = structuredClone(MEAL_SCENE_EXPANSION_BATCH_02_PACK);
  pack.id = id;
  pack.provenance = { ...pack.provenance, status: "APPROVED_FOR_EXPERIMENT" };
  return pack;
}

describe("generic experiment approval policy", () => {
  it("accepts the exact four-word legacy baseline", () => {
    expect(matchesLegacyExperimentBaseline(legacy)).toBe(true);
    const compiled = compileSceneContentRegistryForTests([legacy]);
    expect(compiled).toHaveLength(1);
    expect(compiled[0]?.approvalBasis).toBe("LEGACY_EXPERIMENT_BASELINE");
    expect(compiled[0]?.packId).toBe(MEAL_LEGACY_EXPERIMENT_BASELINE.packId);
    expect(getApprovedExperimentSceneContent(MEAL_SCENE_CONTENT_PACK.id).ok).toBe(true);
  });

  it("rejects the four-word pack id when authored content changes", () => {
    const drifted = structuredClone(MEAL_SCENE_CONTENT_PACK);
    drifted.lexemes[0]!.build.teachInstruction += " x";
    expect(
      compileSceneContentRegistryForTests([
        {
          ...legacy,
          pack: drifted,
        },
      ]),
    ).toEqual([]);
  });

  it("rejects a future pack that claims LEGACY_EXPERIMENT_BASELINE", () => {
    const future = futurePack();
    expect(
      compileSceneContentRegistryForTests([
        {
          packId: future.id,
          status: "APPROVED_FOR_EXPERIMENT",
          approvalBasis: "LEGACY_EXPERIMENT_BASELINE",
          pack: future,
        },
      ]),
    ).toEqual([]);
  });

  it("rejects a future approved pack with no approval basis", () => {
    const future = futurePack();
    expect(
      compileSceneContentRegistryForTests([
        {
          packId: future.id,
          status: "APPROVED_FOR_EXPERIMENT",
          pack: future,
        },
      ]),
    ).toEqual([]);
  });

  it("accepts a fingerprint-bound human-review promotion", () => {
    const compiled = compileSceneContentRegistryForTests([legacy, promoted]);
    expect(compiled).toHaveLength(2);
    expect(compiled[1]?.approvalBasis).toBe("HUMAN_REVIEW_PROMOTION");
    expect(getApprovedExperimentSceneContent(MEAL_SCENE_EXPANSION_BATCH_01_PACK_ID).ok).toBe(
      true,
    );
  });

  it("accepts CANDIDATE without attestation but does not load it at runtime", () => {
    const future = futurePack();
    future.provenance = { ...future.provenance, status: "CANDIDATE" };
    const compiled = compileSceneContentRegistryForTests([
      {
        packId: future.id,
        status: "CANDIDATE",
        pack: future,
      },
    ]);
    expect(compiled).toHaveLength(1);
    expect(compiled[0]?.status).toBe("CANDIDATE");
    expect(getApprovedExperimentSceneContent(future.id).ok).toBe(false);
  });

  it("fail-closes the entire compile on duplicate IDs", () => {
    expect(compileSceneContentRegistryForTests([legacy, legacy])).toEqual([]);
  });

  it("rejects human-review approval without an attestation and keeps the live registry immutable", () => {
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
    const drifted = structuredClone(MEAL_SCENE_EXPANSION_BATCH_01_PACK);
    const cup = drifted.lexemes.find((lexeme) => lexeme.id === "meal-cup")!;
    cup.build.teachInstruction += " x";
    expect(
      compileSceneContentRegistryForTests([legacy, { ...promoted, pack: drifted }]),
    ).toEqual([]);
    const listed = listSceneContentRegistry();
    expect(() => {
      (listed as unknown as { packId: string }[])[0]!.packId = "mutated";
    }).toThrow();
  });
});
