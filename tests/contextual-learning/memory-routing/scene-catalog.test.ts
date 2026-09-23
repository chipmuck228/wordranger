import { describe, expect, it } from "vitest";
import { loadVocabularyDataset } from "@/server/vocabulary/load-vocabulary-dataset";
import { lexemeIdFromCanonicalKey } from "@/lib/canonical-id";
import { lexemeSenseKey } from "@/contextual-learning/candidate-v0/domain/lexeme-sense";
import {
  BUNDLED_LEXEME_BINDINGS,
  bundledBindingLexemeId,
} from "@/contextual-learning/candidate-v0/memory-routing/bundled-lexeme-bindings";
import {
  MEAL_SCENE_CLUSTER,
  MEAL_UTENSIL_CONTRAST_CLUSTER,
  SCENE_VOCABULARY_CLUSTERS,
} from "@/contextual-learning/candidate-v0/memory-routing/scene-catalog";
import { validateSceneVocabularyCatalog } from "@/contextual-learning/candidate-v0/memory-routing/validate-scene-catalog";
import { SCENE_VOCABULARY_CATALOG_VERSION } from "@/contextual-learning/candidate-v0/memory-routing/types";
import type {
  SceneVocabularyCluster,
  VocabularyLexemeIdentity,
} from "@/contextual-learning/candidate-v0/memory-routing/types";

function vocabulary(): VocabularyLexemeIdentity[] {
  return loadVocabularyDataset().lexemes;
}

describe("scene vocabulary catalog", () => {
  it("registers only real bundled UUIDs with matching canonical keys and explicit senseIds", () => {
    const issues = validateSceneVocabularyCatalog(
      SCENE_VOCABULARY_CLUSTERS,
      vocabulary(),
    );
    expect(issues).toEqual([]);

    for (const cluster of SCENE_VOCABULARY_CLUSTERS) {
      const seen = new Set<string>();
      for (const member of cluster.members) {
        expect(member.target.senseId.length).toBeGreaterThan(0);
        expect(member.target.lexemeId).toBe(
          lexemeIdFromCanonicalKey(member.lexemeCanonicalKey),
        );
        const identity = lexemeSenseKey(member.target);
        expect(seen.has(identity), `${cluster.id} ${identity}`).toBe(false);
        seen.add(identity);
      }
    }
  });

  it("allows the same spoon target to appear in two clusters", () => {
    const spoonId = bundledBindingLexemeId(BUNDLED_LEXEME_BINDINGS.spoon);
    const mealSpoon = MEAL_SCENE_CLUSTER.members.find(
      (member) => member.target.lexemeId === spoonId,
    );
    const contrastSpoon = MEAL_UTENSIL_CONTRAST_CLUSTER.members.find(
      (member) => member.target.lexemeId === spoonId,
    );
    expect(mealSpoon?.target).toEqual(contrastSpoon?.target);
  });

  it("fails an unknown lexeme", () => {
    const bogus: SceneVocabularyCluster = {
      ...MEAL_SCENE_CLUSTER,
      id: "bogus-unknown",
      members: [
        {
          target: { lexemeId: "not-a-real-lexeme", senseId: "spoon#eating-utensil" },
          lexemeCanonicalKey: "lex-9999-1",
          roleId: "EATING_TOOL",
          roleDescription: "unknown",
        },
      ],
    };
    const issues = validateSceneVocabularyCatalog([bogus], vocabulary());
    expect(issues.some((issue) => issue.code === "SCENE_MEMBER_UNKNOWN_LEXEME")).toBe(
      true,
    );
  });

  it("marks a polysemous member without senseId as AMBIGUOUS_SENSE", () => {
    const plate = {
      ...BUNDLED_LEXEME_BINDINGS.plate,
      lexemeId: bundledBindingLexemeId(BUNDLED_LEXEME_BINDINGS.plate),
    };
    const ambiguous: SceneVocabularyCluster = {
      ...MEAL_SCENE_CLUSTER,
      id: "bogus-ambiguous",
      members: [
        {
          target: { lexemeId: plate.lexemeId, senseId: "" },
          lexemeCanonicalKey: plate.canonicalKey,
          roleId: "FOOD_SUPPORT",
          roleDescription: "plate without sense",
        },
      ],
    };
    const issues = validateSceneVocabularyCatalog([ambiguous], vocabulary());
    expect(issues.some((issue) => issue.code === "SCENE_MEMBER_AMBIGUOUS_SENSE")).toBe(
      true,
    );
  });

  it("rejects duplicate identity inside one cluster", () => {
    const duplicate: SceneVocabularyCluster = {
      ...MEAL_UTENSIL_CONTRAST_CLUSTER,
      id: "bogus-duplicate",
      members: [
        MEAL_UTENSIL_CONTRAST_CLUSTER.members[0],
        MEAL_UTENSIL_CONTRAST_CLUSTER.members[0],
      ],
    };
    const issues = validateSceneVocabularyCatalog([duplicate], vocabulary());
    expect(
      issues.some((issue) => issue.code === "SCENE_MEMBER_DUPLICATE_IDENTITY"),
    ).toBe(true);
  });

  it("rejects an unsupported catalog version", () => {
    const wrongVersion: SceneVocabularyCluster = {
      ...MEAL_UTENSIL_CONTRAST_CLUSTER,
      id: "bogus-version",
      version: "not-a-supported-version",
    };
    const issues = validateSceneVocabularyCatalog([wrongVersion], vocabulary());
    expect(
      issues.some((issue) => issue.code === "SCENE_CATALOG_UNSUPPORTED_VERSION"),
    ).toBe(true);
    expect(SCENE_VOCABULARY_CATALOG_VERSION).toBe("candidate-v0.1");
  });
});
